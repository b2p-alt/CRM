// Import instalacoes.csv into the CRM database
// Run: node scripts/import-csv.mjs
// Requires: DATABASE_URL in .env.local

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CSV_PATH = 'C:/Users/Utilizador/Downloads/instalacoes.csv';

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

function cleanNipc(nipc) {
  // Ensure it's exactly PT + 9 digits
  if (!nipc) return null;
  const clean = nipc.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Accept PT + 9 alphanum (some NIPCs use letters like PTE...)
  if (/^PT[A-Z0-9]{9}$/.test(clean)) return clean;
  return null;
}

function cleanCpe(cpe) {
  if (!cpe) return null;
  const clean = cpe.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^PT[A-Z0-9]{14,22}$/.test(clean)) return clean;
  return null;
}

function nivelToTipo(nivel) {
  const map = { MAT: 'MAT', MT: 'MT', BTE: 'BTE', BTN: 'BTN', AT: 'AT' };
  return map[nivel?.toUpperCase()] || null;
}

function buildMorada(rua, porta, codPostal, descPostal) {
  const parts = [rua, porta].filter(Boolean).map(s => s.replace(/\s*--\s*/g, '').trim()).filter(Boolean);
  const addr = parts.join(', ');
  const postal = [codPostal, descPostal].filter(Boolean).join(' ');
  return [addr, postal].filter(Boolean).join(', ');
}

async function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parseCsv(text);
  console.log(`Read ${records.length} records from CSV`);

  let empresasCreated = 0, empresasSkipped = 0;
  let instalacoesCriadas = 0, instalacoesSkipped = 0, instalacoesError = 0;

  // First pass: upsert all Empresas
  const empresaMap = new Map(); // nipc → true
  for (const r of records) {
    const nif = cleanNipc(r.NIPC);
    if (!nif || empresaMap.has(nif)) continue;
    empresaMap.set(nif, true);

    const morada = buildMorada(r.Rua, r.Porta, r.Cod_Postal, r.Desc_Postal);
    const localidade = r.Desc_Postal?.trim() || null;

    try {
      await prisma.empresa.upsert({
        where: { nif },
        update: {}, // don't overwrite existing data
        create: {
          nif,
          nome: r.Nome?.trim() || 'Sem nome',
          morada: morada || null,
          localidade: localidade || null,
        },
      });
      empresasCreated++;
    } catch (e) {
      console.error(`  Empresa error (${nif}): ${e.message}`);
      empresasSkipped++;
    }
  }
  console.log(`Empresas: ${empresasCreated} upserted, ${empresasSkipped} errors`);

  // Second pass: upsert all Instalacoes
  for (const r of records) {
    const cpe = cleanCpe(r.CPE);
    const nif = cleanNipc(r.NIPC);
    const tipoInstalacao = nivelToTipo(r.Nivel_Tensao);

    if (!cpe || !nif || !tipoInstalacao) {
      console.warn(`  Skip: CPE=${r.CPE} NIPC=${r.NIPC} Nivel=${r.Nivel_Tensao}`);
      instalacoesSkipped++;
      continue;
    }

    const morada = buildMorada(r.Rua, r.Porta, r.Cod_Postal, r.Desc_Postal);
    const consumoAnual = r.CMA_kWh ? parseFloat(r.CMA_kWh) : null;
    const dataInicio = r.Inicio_Contrato ? new Date(r.Inicio_Contrato) : null;

    try {
      await prisma.instalacao.upsert({
        where: { cpe },
        update: {
          tipoInstalacao,
          morada: morada || null,
          consumoAnual: isNaN(consumoAnual) ? null : consumoAnual,
          dataInicioContrato: dataInicio,
          empresaNif: nif,
        },
        create: {
          cpe,
          tipoInstalacao,
          cicloTarifario: 'TRI_HORARIO', // default; can be updated later per record
          morada: morada || null,
          consumoAnual: isNaN(consumoAnual) ? null : consumoAnual,
          dataInicioContrato: dataInicio,
          empresaNif: nif,
        },
      });
      instalacoesCriadas++;
    } catch (e) {
      console.error(`  Instalacao error (${cpe}): ${e.message}`);
      instalacoesError++;
    }
  }

  console.log(`Instalacoes: ${instalacoesCriadas} upserted, ${instalacoesSkipped} skipped, ${instalacoesError} errors`);
  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
