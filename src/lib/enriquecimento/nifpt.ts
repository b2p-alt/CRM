export type NifPtResult = {
  found: boolean;
  telefone: string | null;
  email: string | null;
  website: string | null;
  nome: string | null;
  morada: string | null;
  localidade: string | null;
  raw?: unknown;
  error?: string;
};

export async function lookupNif(nif9: string): Promise<NifPtResult> {
  const key = process.env.NIF_PT_API_KEY;
  if (!key) return { found: false, telefone: null, email: null, website: null, nome: null, morada: null, localidade: null, error: "NIF_PT_API_KEY não configurada" };

  const url = `https://www.nif.pt/?json=1&q=${encodeURIComponent(nif9)}&key=${encodeURIComponent(key)}`;

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "B2P-CRM/1.0" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { found: false, telefone: null, email: null, website: null, nome: null, morada: null, localidade: null, error: `HTTP ${res.status}` };
    data = await res.json();
  } catch (e) {
    return { found: false, telefone: null, email: null, website: null, nome: null, morada: null, localidade: null, error: String(e) };
  }

  // API returns { resultado: "1"/"success", records: { ... } } or error
  const resultado = String(data.resultado ?? data.result ?? "");
  const isSuccess = resultado === "1" || resultado === "success";
  if (!isSuccess) {
    return { found: false, telefone: null, email: null, website: null, nome: null, morada: null, localidade: null, raw: data, error: `resultado=${resultado}` };
  }

  // Response: { resultado: "success", records: { "123456789": { contacts: { phone, email, website }, title, address, city } } }
  const recordsMap = (data.records ?? {}) as Record<string, Record<string, unknown>>;
  const record     = Object.values(recordsMap)[0] ?? {} as Record<string, unknown>;
  const contacts   = (record.contacts ?? {}) as Record<string, unknown>;

  const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  return {
    found: true,
    telefone: clean(contacts.phone)   ?? clean(contacts.telefone),
    email:    clean(contacts.email),
    website:  clean(contacts.website) ?? clean(contacts.url),
    nome:     clean(record.title)     ?? clean(record.nome),
    morada:   clean(record.address)   ?? clean(record.morada),
    localidade: clean(record.city)    ?? clean(record.localidade),
    raw: data,
  };
}
