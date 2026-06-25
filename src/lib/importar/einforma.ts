/**
 * einforma.ts — Enriquecimento de contactos via eInforma.pt
 *
 * O eInforma bloqueia login programático com CAPTCHA.
 * A sessão é obtida manualmente: o utilizador faz login no browser,
 * copia o id_sess do URL e guarda em EINFORMA_ID_SESS no .env.
 * O token dura ~30 dias (Max-Age=2592000).
 *
 * Como obter o id_sess:
 *   1. Abrir einforma.pt e fazer login
 *   2. Copiar a parte após /id_sess/ e antes do / seguinte no URL
 *   3. Colar em EINFORMA_ID_SESS=<valor> no .env
 *
 * Variável de ambiente:
 *   EINFORMA_ID_SESS  — token de sessão (obrigatório)
 */

export type EnrichData = {
  telefone: string | null;
  email: string | null;
  website: string | null;
  found: boolean;
};

const BASE = "https://www.einforma.pt/servlet/app/portal/ENTP";
const UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getIdSess(): string {
  const idSess = process.env.EINFORMA_ID_SESS?.trim();
  if (!idSess) {
    throw new Error(
      "EINFORMA_ID_SESS não configurado. " +
      "Faça login em einforma.pt, copie o valor após /id_sess/ no URL e guarde no .env"
    );
  }
  return idSess;
}

// ── Extracção via JSON-LD (Schema.org) ───────────────────────────────────
//
// O eInforma embede um bloco <script type="application/ld+json"> com os
// dados estruturados da empresa, incluindo telephone, email e sameAs (website).
// Esta é a fonte mais fiável — evita parsing de HTML frágil.

function extractFromJsonLd(html: string): {
  telephone: string | null;
  email: string | null;
  website: string | null;
} {
  // O eInforma usa aspas simples ou duplas e trailing commas (JSON inválido)
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      // Remove trailing commas antes de } ou ] — o eInforma gera JSON inválido
      const fixed = m[1].replace(/,(\s*[}\]])/g, "$1");
      const data = JSON.parse(fixed);
      const telephone = typeof data.telephone === "string"
        ? data.telephone.replace(/\s/g, "") || null
        : null;
      const email = typeof data.email === "string"
        ? data.email.trim().toLowerCase() || null
        : null;
      const rawSite: unknown = data.sameAs ?? data.url ?? null;
      const website = typeof rawSite === "string" && rawSite && rawSite !== "null"
        ? (rawSite.startsWith("http") ? rawSite : `https://${rawSite}`)
        : null;
      if (telephone || email || website) return { telephone, email, website };
    } catch (e) {
      console.warn(`[einforma] JSON-LD parse falhou:`, e);
    }
  }
  return { telephone: null, email: null, website: null };
}

// ── Função principal ───────────────────────────────────────────────────────

export async function enrichNif(
  nif: string,
  delayMs = 0,
): Promise<EnrichData> {
  if (delayMs > 0) {
    const ms = delayMs * 0.8 + Math.random() * delayMs * 0.4;
    await new Promise((r) => setTimeout(r, ms));
  }

  // eInforma usa apenas os dígitos — remove prefixo PT se presente
  const nifDigits = nif.replace(/^PT/i, "");

  let idSess: string;
  try {
    idSess = getIdSess();
  } catch (err) {
    console.error(`[einforma] ${err instanceof Error ? err.message : err}`);
    return { telefone: null, email: null, website: null, found: false };
  }

  const url = `${BASE}/id_sess/${idSess}/prod/ETIQUETA_EMPRESA/nif/${nifDigits}/source/search/campaign/fichaemp/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":      UA,
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Referer":         "https://www.einforma.pt/",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) return { telefone: null, email: null, website: null, found: false };

    // Decodifica como ISO-8859-1 (charset declarado pelo eInforma)
    const buf  = await res.arrayBuffer();
    const html = new TextDecoder("iso-8859-1").decode(buf);

    // Sessão expirou — servidor redireccionou para login
    if (html.includes("form_login") || html.includes("LOGIN_XML") || res.url.includes("LOGIN")) {
      console.warn(`[einforma] SESSÃO EXPIRADA — renove EINFORMA_ID_SESS no .env`);
      return { telefone: null, email: null, website: null, found: false };
    }

    const { telephone, email: emailVal, website: websiteVal } = extractFromJsonLd(html);

    console.log(`[einforma] ${nifDigits}: tel=${telephone} email=${emailVal} web=${websiteVal}`);

    return {
      telefone: telephone,
      email:    emailVal,
      website:  websiteVal,
      found:    !!(telephone || emailVal || websiteVal),
    };
  } catch (err) {
    console.error(`[einforma] erro ${nifDigits}:`, err);
    return { telefone: null, email: null, website: null, found: false };
  }
}
