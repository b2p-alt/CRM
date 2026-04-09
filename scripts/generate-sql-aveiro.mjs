// Generates SQL INSERT files for the Aveiro dataset
// Input:  Downloads/aveiro-instalacoes.csv
// Output: Downloads/import-aveiro-empresas.sql
//         Downloads/import-aveiro-instalacoes.sql

import fs from 'fs';

const CSV_PATH        = 'C:/Users/Utilizador/Downloads/aveiro-instalacoes.csv';
const OUT_EMPRESAS    = 'C:/Users/Utilizador/Downloads/import-aveiro-empresas.sql';
const OUT_INSTALACOES = 'C:/Users/Utilizador/Downloads/import-aveiro-instalacoes.sql';

// ── CSV parser ────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n');
  const headers = parseCsvLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const rec = {};
    headers.forEach((h, idx) => { rec[h.trim()] = (values[idx] || '').trim(); });
    records.push(rec);
  }
  return records;
}

function parseCsvLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── SQL helpers ───────────────────────────────────────────────
function sql(val) {
  if (!val || val.trim() === '') return 'NULL';
  return `'${val.trim().replace(/'/g, "''")}'`;
}

function cleanNipc(v) {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^PT\d{9}$/.test(c)) return c;
  return null;
}

function cleanCpe(v) {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^PT[A-Z0-9]{14,22}$/.test(c)) return c;
  return null;
}

function cleanNivel(v) {
  const map = { MAT: 'MAT', MT: 'MT', BTE: 'BTE', BTN: 'BTN', AT: 'AT' };
  return map[v?.toUpperCase()] || null;
}

function cleanLocalidade(v) {
  if (!v) return null;
  // Keep only the first "word group" that is purely alphabetic (no digits/noise)
  const words = v.trim().split(/\s+/);
  const clean = words.filter(w => /^[A-ZÀ-Ü\-\/]+$/i.test(w)).join(' ').trim();
  return clean.length >= 2 ? clean : null;
}

function cleanNome(v) {
  if (!v) return null;
  const t = v.trim()
    .replace(/\.\.\.$/, '')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length >= 2 ? t : null;
}

function validDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return s;
}

// ── Process records ───────────────────────────────────────────
const text    = fs.readFileSync(CSV_PATH, 'utf8');
const records = parseCsv(text);
console.log(`Read ${records.length} records from CSV`);

const seenNipc    = new Set();
const empresaRows = [];
const instalRows  = [];
let   skipE = 0, skipI = 0;

for (const r of records) {
  const nif   = cleanNipc(r.NIPC);
  const cpe   = cleanCpe(r.CPE);
  const nivel = cleanNivel(r.Nivel_Tensao);

  if (!nif)   { skipI++; continue; }
  if (!cpe)   { skipI++; continue; }
  if (!nivel) { skipI++; continue; }

  // ── Empresa row (once per NIF) ──────────────────────────────
  if (!seenNipc.has(nif)) {
    seenNipc.add(nif);
    const nome      = sql(cleanNome(r.Nome) || 'Sem nome');
    const localidade = sql(cleanLocalidade(r.Desc_Postal));
    const distrito  = sql('Aveiro');
    const now       = 'NOW()';
    empresaRows.push(`(${sql(nif)}, ${nome}, ${localidade}, ${distrito}, ${now}, ${now})`);
  }

  // ── Instalação row ─────────────────────────────────────────
  const cma      = r.CMA_kWh && !isNaN(parseFloat(r.CMA_kWh)) ? parseFloat(r.CMA_kWh) : 'NULL';
  const dataIn   = validDate(r.Inicio_Contrato) ? sql(r.Inicio_Contrato) : 'NULL';
  const now      = 'NOW()';

  instalRows.push(
    `(gen_random_uuid(), ${sql(cpe)}, '${nivel}'::"TipoInstalacao", ${cma}, ${dataIn}, ${sql(nif)}, ${now}, ${now})`
  );
}

console.log(`Empresas: ${empresaRows.length} (skipped ${skipE})`);
console.log(`Instalações: ${instalRows.length} (skipped ${skipI})`);

// ── Write SQL files ───────────────────────────────────────────
const empresaSql = `-- ============================================
-- EMPRESAS AVEIRO (${empresaRows.length} registos)
-- Execute no Supabase SQL Editor
-- ============================================

INSERT INTO "Empresa" (nif, nome, localidade, distrito, "createdAt", "updatedAt")
VALUES
${empresaRows.join(',\n')}
ON CONFLICT (nif) DO NOTHING;

SELECT COUNT(*) AS total_empresas FROM "Empresa";
`;

const instalSql = `-- ============================================
-- INSTALAÇÕES AVEIRO (${instalRows.length} registos)
-- Execute DEPOIS do import-aveiro-empresas.sql
-- ============================================

INSERT INTO "Instalacao" (id, cpe, "tipoInstalacao", "consumoAnual", "dataInicioContrato", "empresaNif", "createdAt", "updatedAt")
VALUES
${instalRows.join(',\n')}
ON CONFLICT (cpe) DO NOTHING;

SELECT COUNT(*) AS total_instalacoes FROM "Instalacao";
`;

fs.writeFileSync(OUT_EMPRESAS,    empresaSql, 'utf8');
fs.writeFileSync(OUT_INSTALACOES, instalSql,  'utf8');
console.log(`\nSQL files written:`);
console.log(`  ${OUT_EMPRESAS}`);
console.log(`  ${OUT_INSTALACOES}`);
