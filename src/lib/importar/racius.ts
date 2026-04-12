/**
 * racius.ts — Scraper de contactos via Racius.com
 *
 * Pesquisa por NIF, extrai telefone e website da página da empresa.
 * Usa delays aleatórios para evitar bloqueio.
 */

export type EnrichData = {
  telefone: string | null;
  website: string | null;
  found: boolean;
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

function randomAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractPhone(html: string): string | null {
  // Racius mostra telefone em vários padrões
  const patterns = [
    /tel[eé]fone[^<]*<[^>]+>([^<]{7,20})</i,
    /class="[^"]*phone[^"]*"[^>]*>([^<]{7,20})</i,
    /class="[^"]*tel[^"]*"[^>]*>([^<]{7,20})</i,
    /"telephone"\s*:\s*"([^"]{7,20})"/i,
    /(\+351[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{3})/,
    /\b(2\d{2}[\s\-]?\d{3}[\s\-]?\d{3})\b/,
    /\b(9[1236]\d[\s\-]?\d{3}[\s\-]?\d{3})\b/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const candidate = m[1].replace(/&nbsp;/g, " ").trim();
      // Valida que parece um número de telefone português
      const digits = candidate.replace(/\D/g, "");
      if (digits.length >= 9 && digits.length <= 13) return candidate;
    }
  }
  return null;
}

function extractWebsite(html: string): string | null {
  const patterns = [
    /site[^<]*<[^>]+href="(https?:\/\/[^"]{4,80})"/i,
    /website[^<]*<[^>]+href="(https?:\/\/[^"]{4,80})"/i,
    /"url"\s*:\s*"(https?:\/\/[^"]{4,80})"/i,
    /class="[^"]*website[^"]*"[^>]*href="(https?:\/\/[^"]{4,80})"/i,
    /rel="[^"]*noopener[^"]*"[^>]*href="(https?:\/\/(?!racius\.com)[^"]{4,80})"/i,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const url = m[1].trim();
      // Exclui URLs do próprio Racius ou redes sociais genéricas
      if (url.includes("racius.com")) continue;
      if (url.includes("facebook.com") && !url.includes("?")) continue;
      return url;
    }
  }
  return null;
}

function extractCompanyUrl(searchHtml: string): string | null {
  // Encontra o primeiro link para uma empresa na página de pesquisa
  const patterns = [
    /href="(https:\/\/www\.racius\.com\/[a-z0-9\-]+\/)"/i,
    /href="(\/[a-z0-9\-]+\/)" class="[^"]*result[^"]*"/i,
  ];

  for (const pattern of patterns) {
    const m = searchHtml.match(pattern);
    if (m) {
      const url = m[1].startsWith("http") ? m[1] : `https://www.racius.com${m[1]}`;
      return url;
    }
  }
  return null;
}

/**
 * Pesquisa um NIF no Racius e retorna telefone + website.
 * Inclui delay configurável para não sobrecarregar o servidor.
 */
export async function enrichNif(
  nif: string,
  delayMs = 0,
): Promise<EnrichData> {
  if (delayMs > 0) await randomDelay(delayMs * 0.8, delayMs * 1.2);

  // 1. Página de pesquisa por NIF
  const searchUrl = `https://www.racius.com/pesquisa/?q=${encodeURIComponent(nif)}`;
  const searchHtml = await fetchHtml(searchUrl);
  if (!searchHtml) return { telefone: null, website: null, found: false };

  // Verifica se houve resultados
  if (searchHtml.includes("Sem resultados") || searchHtml.includes("sem resultados")) {
    return { telefone: null, website: null, found: false };
  }

  // 2. Tenta extrair directamente da página de pesquisa
  const directPhone = extractPhone(searchHtml);
  const directWebsite = extractWebsite(searchHtml);
  if (directPhone || directWebsite) {
    return { telefone: directPhone, website: directWebsite, found: true };
  }

  // 3. Segue para a página da empresa
  const companyUrl = extractCompanyUrl(searchHtml);
  if (!companyUrl) return { telefone: null, website: null, found: false };

  await randomDelay(1500, 3000); // delay extra antes da segunda página
  const companyHtml = await fetchHtml(companyUrl);
  if (!companyHtml) return { telefone: null, website: null, found: false };

  return {
    telefone: extractPhone(companyHtml),
    website: extractWebsite(companyHtml),
    found: true,
  };
}
