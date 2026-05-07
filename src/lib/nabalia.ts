const AGENT_ID = process.env.NABALIA_AGENT_ID!;
const PASSWORD  = process.env.NABALIA_PASSWORD!;

const AUTH_URL  = "https://nabalia-proxy-c0fngke2c5fvh5hg.westeurope-01.azurewebsites.net/api/auth/login";
const SOAP_URL  = "https://nabalia-proxy-c0fngke2c5fvh5hg.westeurope-01.azurewebsites.net/api/soap/Page/WSCpe_Ponto_Entrega";
const SOAP_ACT  = '"urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega:ReadMultiple"';
const XMLNS     = "urn:microsoft-dynamics-schemas/page/wscpe_ponto_entrega";
const PAGE_SIZE = 100;

// Token em memória — dura enquanto o processo Node.js estiver vivo
let _token: string | null = null;
let _tokenExp = 0;

function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number(data.exp) || 0;
  } catch { return 0; }
}

async function getToken(): Promise<string> {
  if (_token && Date.now() / 1000 < _tokenExp - 300) return _token;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: AGENT_ID, password: PASSWORD }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nabalia login falhou: ${res.status}`);

  const data = await res.json();
  const token: string =
    data.token ?? data.accessToken ?? data.access_token ??
    (Object.values(data) as string[]).find((v) => typeof v === "string" && v.length > 100) ?? "";
  if (!token) throw new Error("Token não encontrado na resposta de login");

  _token = token;
  _tokenExp = jwtExpiry(token);
  return token;
}

// ---------------------------------------------------------------------------
// XML helpers (sem dependências externas)
// ---------------------------------------------------------------------------

export type RawRecord = Record<string, string>;

function extractItems(xml: string): string[] {
  const tag = "WSCpe_Ponto_Entrega";
  const re  = new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)</[^>]*:?${tag}>`, "g");
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function extractFields(itemXml: string): RawRecord {
  const re = /<(?:[^:>]+:)?([A-Za-z_][A-Za-z0-9_]*)(?:\s[^>]*)?>([^<]*)<\/[^>]+>/g;
  const r: RawRecord = {};
  let m;
  while ((m = re.exec(itemXml))) r[m[1]] = m[2].trim();
  return r;
}

// ---------------------------------------------------------------------------
// Pesquisa paginada
// ---------------------------------------------------------------------------

function buildPostalCriteria(from: string, to: string): string {
  const f = from.trim();
  const t = to.trim();
  if (f && t) return `${f}..${t}`;   // range nativo do Dynamics NAV
  if (f)     return `${f}*`;         // prefixo (ex: 1000 → 1000-*)
  return "";
}

export async function searchCpe(
  codPostal: string,
  voltageCode: string,
  codPostalAte = "",
): Promise<RawRecord[]> {
  const token = await getToken();
  const postalCriteria = buildPostalCriteria(codPostal, codPostalAte);

  const filtersXml = [
    postalCriteria ? `<filter><Field>Postal_Cod</Field><Criteria>${postalCriteria}</Criteria></filter>` : "",
    voltageCode    ? `<filter><Field>Voltage_Code</Field><Criteria>${voltageCode.trim()}</Criteria></filter>` : "",
  ].join("");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "text/xml;charset=utf-8",
    SOAPAction: SOAP_ACT,
    Accept: "text/xml",
  };

  const all: RawRecord[] = [];
  let bookmarkKey: string | undefined;

  for (;;) {
    const bkXml = bookmarkKey ? `<bookmarkKey>${bookmarkKey}</bookmarkKey>` : "";
    const body = [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">`,
      `<soap:Body><ReadMultiple xmlns="${XMLNS}">`,
      filtersXml, bkXml, `<setSize>${PAGE_SIZE}</setSize>`,
      `</ReadMultiple></soap:Body></soap:Envelope>`,
    ].join("");

    const res = await fetch(SOAP_URL, { method: "POST", headers, body, cache: "no-store" });
    if (!res.ok) throw new Error(`SOAP erro: ${res.status} ${await res.text().then(t => t.slice(0, 200))}`);

    const xml     = await res.text();
    const items   = extractItems(xml).map(extractFields);
    all.push(...items);

    if (items.length < PAGE_SIZE) break;
    bookmarkKey = items[items.length - 1]["Key"];
    await new Promise((r) => setTimeout(r, 700));
  }

  return all;
}

// ---------------------------------------------------------------------------
// Mapeamento para modelos do CRM
// ---------------------------------------------------------------------------

export function normalizeNipc(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s.startsWith("PT") ? s : `PT${s}`;
}

const TIPO_MAP: Record<string, string> = {
  MT: "MT", BTE: "BTE", AT: "AT", MAT: "MAT", BTN: "BTN",
};

const CICLO_MAP: Record<string, string> = {
  TETRA: "TRI_HORARIO",
  SIMPLES: "SIMPLES",
  BI: "BI_HORARIO",
  "BI-HORARIO": "BI_HORARIO",
  TRI: "TRI_HORARIO",
  "TRI-HORARIO": "TRI_HORARIO",
  DIARIO: "DIARIO",
  SEMANAL: "SEMANAL",
  SEMANAL_OPCIONAL: "SEMANAL_OPCIONAL",
};

export function mapTipo(v: string) { return TIPO_MAP[v?.toUpperCase()] ?? null; }
export function mapCiclo(v: string) { return CICLO_MAP[v?.toUpperCase()] ?? null; }

export function buildMorada(r: RawRecord): string {
  const parts = [
    r.Rua ?? "",
    r.Porta ?? "",
    r.Postal_Cod ? `${r.Postal_Cod} ${r.Postal_Desc ?? r.Concelho_Desc ?? ""}`.trim() : "",
  ].map(p => (p as string).trim()).filter(Boolean);
  return parts.join(", ");
}

export function parseDateField(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function parseFloat2(val: string): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? null : n;
}
