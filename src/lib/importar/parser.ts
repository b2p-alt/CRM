import { ParsedRecord } from "./types";

// ── Helpers ───────────────────────────────────────────────────
function parseDate(str: string): string {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function fixNipcPrefix(s: string): string {
  return s.replace(/PT([sSoOiIlD|])/g, (_, c: string) => {
    const map: Record<string, string> = { s:"5",S:"5",o:"0",O:"0",i:"1",I:"1","|":"1",l:"1",D:"0" };
    return "PT" + (map[c] || c);
  });
}

export function cleanNipc(v: string): string | null {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^PT\d{9}$/.test(c) ? c : null;
}

export function cleanCpe(v: string): string | null {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^PT[A-Z0-9]{14,22}$/.test(c) ? c : null;
}

export function cleanNivel(v: string): string | null {
  const map: Record<string, string> = { MAT:"MAT",MT:"MT",BTE:"BTE",BTN:"BTN",AT:"AT" };
  return map[v?.toUpperCase()] || null;
}

export function cleanLocalidade(v: string): string | null {
  if (!v) return null;
  const clean = v.trim()
    .split(/\s+/)
    .filter(w => /^[A-ZÀ-Üa-zà-ü\-\/]+$/.test(w))
    .join(" ").trim();
  return clean.length >= 2 ? clean : null;
}

export function cleanNome(v: string): string | null {
  if (!v) return null;
  return v.trim().replace(/\.\.\.$/, "").replace(/[|]/g, "I").replace(/\s+/g, " ").trim() || null;
}

// ── Line parser ───────────────────────────────────────────────
function parseLine(rawLine: string): Omit<ParsedRecord, "id"> | null {
  const line = rawLine.trim();
  if (!line || line.length < 30 || !/^PT/i.test(line)) return null;

  const firstToken = line.split(/\s+/)[0];
  const cpe = firstToken.toUpperCase().replace(/[oO]/g, "0").replace(/[|Il)]/g, "1");
  if (cpe.length < 16 || cpe.length > 28 || !/^PT[0-9A-Z]+$/.test(cpe)) return null;

  const rest  = line.slice(firstToken.length).trim();
  const restN = fixNipcPrefix(rest).replace(/[oO]/g, "0");

  const nipcMatch = restN.match(/\bPT(\d{9})\b/);
  const nipc      = nipcMatch ? `PT${nipcMatch[1]}` : "";
  const nipcPos   = nipcMatch ? restN.indexOf(nipcMatch[0]) : -1;

  const p1 = restN.match(/\b(\d{4}-\d{3})\b/);
  const p2 = restN.match(/\b([3-9]\d{3})(\d{3})\b/);
  const codPostal = p1 ? p1[1] : p2 ? `${p2[1]}-${p2[2]}` : "";

  const dateMatch  = restN.match(/\b(\d{2}-\d{2}-\d{4})\b/);
  const dataInicio = dateMatch ? parseDate(dateMatch[1]) : "";

  const nivelMatch  = rest.match(/\b(MAT|MT|BTE|BTN|AT)\b/i);
  const nivelTensao = nivelMatch ? nivelMatch[1].toUpperCase() : "";

  const afterNivel = nivelTensao
    ? rest.slice(rest.search(new RegExp("\\b" + nivelTensao + "\\b", "i")) + nivelTensao.length)
    : rest;
  const cmaMatches = afterNivel.replace(/[oO]/g, "0").match(/\b\d{1,10}\b/g) || [];
  const cma        = cmaMatches.length ? cmaMatches[cmaMatches.length - 1] : "";

  let nome = "";
  if (nipcPos > 0) {
    nome = rest.slice(0, nipcPos).trim().replace(/\.\.\.$/, "").replace(/[|]/g, "I").trim();
  }

  let rua = "";
  if (nipc && codPostal && nipcPos >= 0 && nipcMatch) {
    const nipcEnd   = nipcPos + nipcMatch[0].length;
    const postalPos = restN.search(new RegExp(codPostal.replace("-", "[-]?")));
    if (postalPos > nipcEnd) rua = rest.slice(nipcEnd, postalPos).trim();
  }

  let descPostal = "";
  if (codPostal) {
    const postalPos = restN.search(new RegExp(codPostal.replace("-", "[-]?")));
    if (postalPos >= 0) {
      const after = rest.slice(postalPos + codPostal.length).trim();
      const desc: string[] = [];
      for (const w of after.split(/\s+/)) {
        const wn = w.replace(/[oO]/g, "0");
        if (/^\d{4,}$/.test(wn)) break;
        if (/^(MAT|MT|BTE|BTN|AT|TETRA)$/i.test(w)) break;
        if (/^\d{2}-\d{2}-\d{4}$/.test(wn)) break;
        if (/^[-—]+$/.test(w)) continue;
        desc.push(w);
        if (desc.length >= 5) break;
      }
      descPostal = desc.join(" ").replace(/^[^A-Za-zÀ-ÿ]+/, "").trim();
    }
  }

  return { cpe, nipc, nome, rua, codPostal, descPostal, dataInicio, nivelTensao, cma };
}

// ── Parse full OCR text ───────────────────────────────────────
export function parseOcrText(text: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  for (const line of text.split("\n")) {
    const r = parseLine(line);
    if (!r || !r.nipc || !r.codPostal || !r.nivelTensao) continue;
    records.push({ ...r, id: crypto.randomUUID() });
  }
  return records;
}
