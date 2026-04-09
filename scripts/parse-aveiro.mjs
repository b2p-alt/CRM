// Parses aveiro-ocr-full.txt → aveiro-instalacoes.csv
import fs from 'fs';

const IN_PATH  = 'C:/Users/Utilizador/Downloads/aveiro-ocr-full.txt';
const CSV_PATH = 'C:/Users/Utilizador/Downloads/aveiro-instalacoes.csv';

function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  return `${yyyy}-${mm}-${dd}`;
}

// Normalize OCR artifacts in the NIPC area while preserving string length
// (so positions remain valid after substitution)
function fixNipcPrefix(s) {
  return s
    .replace(/PT([sSoOiI|lD])/g, (_, c) => {
      const map = { s:'5', S:'5', o:'0', O:'0', i:'1', I:'1', '|':'1', l:'1', D:'0' };
      return 'PT' + (map[c] || c);
    });
}

function q(str) {
  return `"${String(str || '').trim().replace(/"/g, '""')}"`;
}

function parseLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.length < 30) return null;
  if (!/^PT/i.test(line)) return null;

  // ── CPE (first token) ────────────────────────────────────────
  const firstToken = line.split(/\s+/)[0];
  const cpe = firstToken.toUpperCase()
    .replace(/[oO]/g, '0')
    .replace(/[|Il)]/g, '1');
  if (cpe.length < 16 || cpe.length > 28) return null;
  if (!/^PT[0-9A-Z]+$/.test(cpe)) return null;

  // rest = everything after the CPE token
  const rest = line.slice(firstToken.length).trim();

  // ── Normalize rest for NIPC search (same length → positions valid) ──
  const restN = fixNipcPrefix(rest).replace(/[oO]/g, '0');

  // ── NIPC: PT + 9 digits ───────────────────────────────────────
  const nipcMatch = restN.match(/\bPT(\d{9})\b/);
  const nipc      = nipcMatch ? `PT${nipcMatch[1]}` : '';
  const nipcPos   = nipcMatch ? restN.indexOf(nipcMatch[0]) : -1;

  // ── Postal code: DDDD-DDD or 7-digit run ─────────────────────
  const p1 = restN.match(/\b(\d{4}-\d{3})\b/);
  const p2 = restN.match(/\b([3-9]\d{3})(\d{3})\b/);
  const codPostal = p1 ? p1[1] : p2 ? `${p2[1]}-${p2[2]}` : '';

  // ── Date DD-MM-YYYY ───────────────────────────────────────────
  const dateMatch  = restN.match(/\b(\d{2}-\d{2}-\d{4})\b/);
  const dataInicio = dateMatch ? parseDate(dateMatch[1]) : '';

  // ── Nivel tensao ──────────────────────────────────────────────
  const nivelMatch = rest.match(/\b(MAT|MT|BTE|BTN|AT)\b/i);
  const nivelTensao = nivelMatch ? nivelMatch[1].toUpperCase() : '';

  // ── CMA: last standalone number (after TETRA or after nivel) ──
  const afterNivel = nivelTensao
    ? rest.slice(rest.search(new RegExp('\\b' + nivelTensao + '\\b', 'i')) + nivelTensao.length)
    : rest;
  const cmaMatches = afterNivel.replace(/[oO]/g, '0').match(/\b\d{1,10}\b/g) || [];
  const cma = cmaMatches.length ? cmaMatches[cmaMatches.length - 1] : '';

  // ── Nome: text between CPE-end and NIPC-start ─────────────────
  let nome = '';
  if (nipcPos > 0) {
    nome = rest.slice(0, nipcPos).trim()
      .replace(/\.\.\.$/, '')
      .replace(/[|]/g, 'I')
      .trim();
  }

  // ── Rua: text between NIPC-end and postal-start ───────────────
  let rua = '';
  if (nipc && codPostal && nipcPos >= 0) {
    const nipcEnd   = nipcPos + nipcMatch[0].length;
    const postalPos = restN.search(new RegExp(codPostal.replace('-', '[-]?')));
    if (postalPos > nipcEnd) {
      rua = rest.slice(nipcEnd, postalPos).trim();
    }
  }

  // ── DescPostal: words immediately after postal code ───────────
  let descPostal = '';
  if (codPostal) {
    const postalPos = restN.search(new RegExp(codPostal.replace('-', '[-]?')));
    if (postalPos >= 0) {
      const after = rest.slice(postalPos + codPostal.length).trim();
      const words  = after.split(/\s+/);
      const desc   = [];
      for (const w of words) {
        const wn = w.replace(/[oO]/g, '0');
        if (/^\d{4,}$/.test(wn)) break;
        if (/^(MAT|MT|BTE|BTN|AT|TETRA)$/i.test(w)) break;
        if (/^\d{2}-\d{2}-\d{4}$/.test(wn)) break;
        if (/^[-—]+$/.test(w)) continue;
        desc.push(w);
        if (desc.length >= 5) break;
      }
      descPostal = desc.join(' ').replace(/^[^A-Za-zÀ-ÿ]+/, '').trim();
    }
  }

  return { cpe, nipc, nome, rua, codPostal, descPostal, dataInicio, nivelTensao, cma };
}

const text  = fs.readFileSync(IN_PATH, 'utf8');
const lines = text.split('\n');
console.log(`Lines: ${lines.length}`);

const records = [];
let skipped = 0;

for (const line of lines) {
  const r = parseLine(line);
  if (!r || !r.nipc || !r.codPostal || !r.nivelTensao) { skipped++; continue; }
  records.push(r);
}

console.log(`Records: ${records.length}  Skipped: ${skipped}`);
if (records[0])  console.log('Sample 0:', JSON.stringify(records[0]));
if (records[10]) console.log('Sample 10:', JSON.stringify(records[10]));
if (records[50]) console.log('Sample 50:', JSON.stringify(records[50]));

const header = 'CPE,NIPC,Nome,Rua,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
const rows   = records.map(r =>
  [q(r.cpe), q(r.nipc), q(r.nome), q(r.rua), q(r.codPostal), q(r.descPostal),
   q(r.dataInicio), q(r.nivelTensao), q(r.cma)].join(',')
);
fs.writeFileSync(CSV_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
console.log('CSV saved:', CSV_PATH);
