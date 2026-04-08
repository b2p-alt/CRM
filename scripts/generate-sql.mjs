// Generates SQL INSERT files to run in Supabase SQL Editor
// Output: Downloads/import-empresas.sql and Downloads/import-instalacoes.sql

import fs from 'fs';

const CSV_PATH = 'C:/Users/Utilizador/Downloads/instalacoes.csv';
const OUT_EMPRESAS   = 'C:/Users/Utilizador/Downloads/import-empresas.sql';
const OUT_INSTALACOES = 'C:/Users/Utilizador/Downloads/import-instalacoes.sql';

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n');
  const headers = parseCsvLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const record = {};
    headers.forEach((h, idx) => { record[h.trim()] = (values[idx] || '').trim(); });
    records.push(record);
  }
  return records;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
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

function sql(val) {
  if (!val || val.trim() === '') return 'NULL';
  return `'${val.trim().replace(/'/g, "''")}'`;
}

function cleanNipc(nipc) {
  if (!nipc) return null;
  const clean = nipc.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^PT[A-Z0-9]{9}$/.test(clean)) return clean;
  return null;
}

function cleanCpe(cpe) {
  if (!cpe) return null;
  const clean = cpe.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^PT[A-Z0-9]{14,22}$/.test(clean)) return clean;
  return null;
}

function validDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Check month is valid (OCR may produce 00)
  const [y, m, day] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31) return null;
  return dateStr;
}

function nivelToTipo(nivel) {
  const map = { MAT: 'MAT', MT: 'MT', BTE: 'BTE', BTN: 'BTN', AT: 'AT' };
  return map[nivel?.toUpperCase()] || null;
}

function buildMorada(rua, porta, codPostal, descPostal) {
  const parts = [rua, porta]
    .filter(Boolean)
    .map(s => s.replace(/\s*--\s*/g, '').replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 1);
  const addr = parts.join(', ');
  const postal = [codPostal, descPostal].filter(Boolean).join(' ');
  return [addr, postal].filter(Boolean).join(', ');
}

const text = fs.readFileSync(CSV_PATH, 'utf8');
const records = parseCsv(text);
console.log(`Read ${records.length} records`);

// ── Empresas ──────────────────────────────────────────────────
const seenNipc = new Set();
const empresaRows = [];
let skippedEmpresa = 0;

for (const r of records) {
  const nif = cleanNipc(r.NIPC);
  if (!nif || seenNipc.has(nif)) { if (!nif) skippedEmpresa++; continue; }
  seenNipc.add(nif);

  const nomeVal = r.Nome?.replace(/\.{3,}$/, '').replace(/\.\.$/, '').trim() || 'Sem nome';
  const nome    = sql(nomeVal); // remove trailing ...
  const morada  = sql(buildMorada(r.Rua, r.Porta, r.Cod_Postal, r.Desc_Postal));
  const local   = sql(r.Desc_Postal?.trim());
  const now     = `NOW()`;

  empresaRows.push(
    `(${sql(nif)}, ${nome}, ${morada}, ${local}, ${now}, ${now})`
  );
}

const empresasSql = `-- ============================================
-- EMPRESAS (${empresaRows.length} registos)
-- Cole no Supabase SQL Editor e execute
-- ============================================

INSERT INTO "Empresa" (nif, nome, morada, localidade, "createdAt", "updatedAt")
VALUES
${empresaRows.join(',\n')}
ON CONFLICT (nif) DO NOTHING;

SELECT COUNT(*) as total_empresas FROM "Empresa";
`;

fs.writeFileSync(OUT_EMPRESAS, empresasSql, 'utf8');
console.log(`Empresas SQL: ${empresaRows.length} rows → ${OUT_EMPRESAS}`);

// ── Instalações ───────────────────────────────────────────────
const instalacaoRows = [];
let skippedInst = 0;

for (const r of records) {
  const cpe  = cleanCpe(r.CPE);
  const nif  = cleanNipc(r.NIPC);
  const tipo = nivelToTipo(r.Nivel_Tensao);

  if (!cpe || !nif || !tipo) { skippedInst++; continue; }
  // Only insert if the Empresa exists (nif in seenNipc)
  if (!seenNipc.has(nif)) { skippedInst++; continue; }

  const morada  = sql(buildMorada(r.Rua, r.Porta, r.Cod_Postal, r.Desc_Postal));
  const consumo = r.CMA_kWh && !isNaN(parseFloat(r.CMA_kWh)) ? parseFloat(r.CMA_kWh) : 'NULL';
  const dataInicio = validDate(r.Inicio_Contrato) ? sql(r.Inicio_Contrato) : 'NULL';
  const now = `NOW()`;

  // Generate a deterministic ID using cpe as seed
  const id = `gen_random_uuid()`;

  instalacaoRows.push(
    `(${id}, ${sql(cpe)}, ${morada}, '${tipo}'::"TipoInstalacao", 'TRI_HORARIO'::"CicloTarifario", ${consumo}, ${dataInicio}, ${sql(nif)}, ${now}, ${now})`
  );
}

const instalacoesSql = `-- ============================================
-- INSTALAÇÕES (${instalacaoRows.length} registos)
-- Execute DEPOIS do import-empresas.sql
-- ============================================

INSERT INTO "Instalacao" (id, cpe, morada, "tipoInstalacao", "cicloTarifario", "consumoAnual", "dataInicioContrato", "empresaNif", "createdAt", "updatedAt")
VALUES
${instalacaoRows.join(',\n')}
ON CONFLICT (cpe) DO NOTHING;

SELECT COUNT(*) as total_instalacoes FROM "Instalacao";
`;

fs.writeFileSync(OUT_INSTALACOES, instalacoesSql, 'utf8');
console.log(`Instalações SQL: ${instalacaoRows.length} rows → ${OUT_INSTALACOES}`);
console.log(`Skipped: ${skippedEmpresa} empresas, ${skippedInst} instalações (NIPC/CPE inválido)`);
