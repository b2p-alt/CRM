// Import contacts CSV (base de contactos) into CRM as rascunhos (drafts)
// Run:  node scripts/import-contacts-csv.mjs [--dry-run]
// Requires: DATABASE_URL in .env.local

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CSV_PATH = 'C:/Users/Utilizador/Desktop/B2P Energy/base de contactos/Planilha contactos .csv';

// ── CSV parser (semicolon, latin1) ────────────────────────────────────────────

function parseSemicolonCsv(buf) {
  const text = buf.toString('latin1').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let i = 0, row = [], field = '', inQ = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      inQ = !inQ; i++; continue;
    }
    if (!inQ && ch === ';') { row.push(field); field = ''; i++; continue; }
    if (!inQ && ch === '\n') {
      row.push(field);
      if (row.some(f => f.trim())) rows.push(row);
      row = []; field = ''; i++; continue;
    }
    field += ch; i++;
  }
  row.push(field);
  if (row.some(f => f.trim())) rows.push(row);
  return rows;
}

// ── Cleaners ──────────────────────────────────────────────────────────────────

const VALID_TIPOS = new Set(['MAT', 'MT', 'BTE', 'BTN', 'AT']);

function cleanNif(raw) {
  if (!raw) return null;
  const digits = raw.trim().replace(/\D/g, '');
  return digits.length === 9 ? 'PT' + digits : null;
}

function cleanTipo(raw) {
  if (!raw) return null;
  const n = raw.trim().toUpperCase().replace(/\s+/g, '');
  return VALID_TIPOS.has(n) ? n : null;
}

function cleanCpe(raw) {
  if (!raw) return null;
  const clean = raw.trim().replace(/[.\s*]+$/, '').replace(/\s+/g, '').toUpperCase();
  return /^PT[A-Z0-9]{14,22}$/.test(clean) ? clean : null;
}

function parseConsumo(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDistrito(raw) {
  if (!raw) return { distrito: null, localidade: null };
  const parts = raw.split(/\s*[>-]\s*/).map(s => s.trim()).filter(Boolean);
  return { distrito: parts[0] || null, localidade: parts[1] || null };
}

function cleanTelefone(raw) {
  if (!raw) return null;
  return raw.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().replace(/[\/\s]+$/, '') || null;
}

function cleanEmail(raw) {
  if (!raw) return null;
  return raw.replace(/\n/g, ';').trim()
    .split(/[\s;,]+/).filter(e => e.includes('@')).join('; ') || null;
}

function buildNota(col15, col16, col17) {
  const parts = [];
  if (col15?.trim()) parts.push(`Último contacto: ${col15.trim()}`);
  if (col16?.trim()) parts.push(`Quando retornar: ${col16.trim()}`);
  if (col17?.trim()) parts.push(col17.trim());
  return parts.join('\n') || null;
}

// ── Parse a row into a record ─────────────────────────────────────────────────

function parseRow(cols, rowIndex, draftSeq) {
  const get = (i) => (cols[i] || '').replace(/\n/g, ' ').trim();

  const vendedor    = get(3);
  const responsavel = get(4);
  const nome        = get(5);
  const tipoRaw     = get(6);
  const telefoneRaw = cols[7] || '';
  const nifRaw      = get(8);
  const distritoRaw = get(9);
  const consumoRaw  = get(11);
  const cpeRaw      = cols[12] || '';
  const quemAtende  = get(13);
  const emailRaw    = get(14);

  if (!nome && !nifRaw && !cpeRaw.trim()) return null;

  const problemas = [];

  // NIF
  const nif = cleanNif(nifRaw);
  if (!nif) problemas.push(nifRaw ? `NIF inválido: "${nifRaw}"` : 'NIF em falta');

  // Tipo de contrato
  const tipo = cleanTipo(tipoRaw);
  if (!tipo) problemas.push(tipoRaw ? `Tipo inválido: "${tipoRaw}"` : 'Tipo de contrato em falta');

  // CPE
  const cpeParts = cpeRaw.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  let cpe = null;
  if (!cpeParts.length) {
    problemas.push('CPE em falta');
  } else if (cpeParts.length > 1) {
    problemas.push(`Múltiplos CPEs: ${cpeParts.map(c => c.slice(0, 22)).join(' | ')}`);
  } else {
    cpe = cleanCpe(cpeParts[0]);
    if (!cpe) problemas.push(`CPE inválido: "${cpeParts[0]}"`);
  }

  const { distrito, localidade } = parseDistrito(distritoRaw);

  return {
    row: rowIndex,
    isClean: problemas.length === 0,
    problemas,
    // Use real NIF if valid, else a placeholder
    nif: nif ?? `RASCUNHO_${String(draftSeq).padStart(5, '0')}`,
    nifOriginal: nifRaw,
    nome: nome || 'Sem nome',
    tipo,
    cpe,
    vendedor,
    responsavel,
    telefone: cleanTelefone(telefoneRaw),
    email: cleanEmail(emailRaw),
    quemAtende: quemAtende || null,
    distrito,
    localidade,
    consumo: parseConsumo(consumoRaw),
    nota: buildNota(cols[15] || '', cols[16] || '', cols[17] || ''),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('🔍 MODO DRY-RUN — nenhuma alteração será feita na BD\n');

  const buf = fs.readFileSync(CSV_PATH);
  const rows = parseSemicolonCsv(buf);
  console.log(`Lidas ${rows.length} linhas do CSV (incluindo cabeçalho)\n`);

  const dataRows = rows.slice(1);
  const records = [];
  let draftSeq = 1;

  for (let i = 0; i < dataRows.length; i++) {
    const r = parseRow(dataRows[i], i + 2, draftSeq);
    if (!r) continue;
    if (!r.nif.startsWith('PT')) draftSeq++;
    records.push(r);
  }

  const clean = records.filter(r => r.isClean);
  const problematic = records.filter(r => !r.isClean);
  console.log(`✓ Linhas limpas:        ${clean.length}`);
  console.log(`⚠ Linhas problemáticas: ${problematic.length}`);
  console.log(`   Total a importar:    ${records.length} (todos como rascunho)\n`);

  // Load users
  const users = await prisma.user.findMany({ select: { id: true, nome: true } });
  const masterUser = users.find(u =>
    u.nome?.toLowerCase().includes('rubens') || u.nome?.toLowerCase().includes('master')
  );
  const fallbackUserId = masterUser?.id ?? users[0]?.id ?? null;

  function findUserId(vendedor) {
    if (!vendedor) return fallbackUserId;
    const v = vendedor.toLowerCase();
    for (const u of users) {
      const n = u.nome?.toLowerCase() ?? '';
      if (n === v || v.includes(n.split(' ')[0]) || n.includes(v.split(' ')[0])) return u.id;
    }
    return fallbackUserId;
  }

  console.log(`Utilizadores: ${users.map(u => u.nome).join(', ')}`);
  console.log(`Fallback notas: ${masterUser?.nome ?? users[0]?.nome}\n`);

  if (dryRun) {
    // Check existing NIFs/CPEs
    const nifs = records.map(r => r.nif);
    const cpes = records.filter(r => r.cpe).map(r => r.cpe);
    const existingNifs = new Set(
      (await prisma.empresa.findMany({ where: { nif: { in: nifs } }, select: { nif: true } }))
        .map(e => e.nif)
    );
    const existingCpes = new Set(
      (await prisma.instalacao.findMany({ where: { cpe: { in: cpes } }, select: { cpe: true } }))
        .map(i => i.cpe)
    );

    console.log('── Preview ─────────────────────────────────────────────────────────────────────');
    console.log(`${'#'.padEnd(5)} ${'NIF'.padEnd(16)} ${'Nome'.padEnd(36)} ${'Tipo'.padEnd(5)} ${'CPE'.padEnd(24)} ${'Empr'.padEnd(6)} ${'Inst'.padEnd(5)} Prob`);
    console.log('─'.repeat(110));

    let newE = 0, skipE = 0, newI = 0, skipI = 0;
    for (const r of records) {
      const eS = existingNifs.has(r.nif) ? 'EXISTE' : 'NOVA';
      const iS = !r.cpe ? 'SEM CPE' : existingCpes.has(r.cpe) ? 'EXISTE' : 'NOVA';
      if (eS === 'NOVA') newE++; else skipE++;
      if (iS === 'NOVA') newI++; else skipI++;
      const nif  = r.nif.slice(0, 14).padEnd(16);
      const nome = r.nome.slice(0, 34).padEnd(36);
      const tipo = (r.tipo ?? '?').padEnd(5);
      const cpe  = (r.cpe ?? '-').slice(0, 22).padEnd(24);
      const prob = r.problemas.length ? `⚠ ${r.problemas[0]}` : '';
      console.log(`${String(r.row).padEnd(5)} ${nif} ${nome} ${tipo} ${cpe} ${eS.padEnd(6)} ${iS.padEnd(5)} ${prob}`);
    }

    console.log('');
    console.log(`Empresas novas:          ${newE}`);
    console.log(`Empresas já existentes:  ${skipE}`);
    console.log(`Instalações novas:       ${newI}`);
    console.log(`Instalações já existem:  ${skipI}`);
    console.log('\nPara importar:\n  node scripts/import-contacts-csv.mjs');
    await prisma.$disconnect();
    return;
  }

  // ── Import all as rascunho ─────────────────────────────────────────────────

  let eCreated = 0, eSkipped = 0, eError = 0;
  let iCreated = 0, iSkipped = 0, iError = 0;
  let nCreated = 0;

  for (const r of records) {
    // 1. Empresa
    try {
      const existing = await prisma.empresa.findUnique({ where: { nif: r.nif } });
      if (existing) {
        eSkipped++;
      } else {
        await prisma.empresa.create({
          data: {
            nif: r.nif,
            nome: r.nome,
            telefone: r.telefone,
            email: r.email,
            responsavel: r.responsavel,
            quemAtende: r.quemAtende,
            distrito: r.distrito,
            localidade: r.localidade,
            rascunho: true,
            importProblemas: r.problemas.length
              ? JSON.stringify({ problemas: r.problemas, nifOriginal: r.nifOriginal, row: r.row })
              : null,
          },
        });
        eCreated++;
      }
    } catch (e) {
      console.error(`  Empresa error (${r.nif}): ${e.message}`);
      eError++;
      continue;
    }

    // 2. Instalação (only if valid CPE and tipo)
    if (r.cpe && r.tipo) {
      try {
        const exists = await prisma.instalacao.findUnique({ where: { cpe: r.cpe } });
        if (exists) {
          iSkipped++;
        } else {
          await prisma.instalacao.create({
            data: { cpe: r.cpe, tipoInstalacao: r.tipo, consumoAnual: r.consumo, empresaNif: r.nif },
          });
          iCreated++;
        }
      } catch (e) {
        console.error(`  Instalação error (${r.cpe}): ${e.message}`);
        iError++;
      }
    }

    // 3. Nota
    if (r.nota && fallbackUserId) {
      try {
        const userId = findUserId(r.vendedor);
        await prisma.nota.create({
          data: { texto: r.nota, empresaNif: r.nif, userId },
        });
        nCreated++;
      } catch (e) {
        console.error(`  Nota error (${r.nif}): ${e.message}`);
      }
    }
  }

  console.log('── Resultado ─────────────────────────────────────────────');
  console.log(`Empresas criadas (rascunho): ${eCreated}`);
  console.log(`Empresas já existentes:      ${eSkipped}`);
  console.log(`Empresas com erro:           ${eError}`);
  console.log(`Instalações criadas:         ${iCreated}`);
  console.log(`Instalações já existem:      ${iSkipped}`);
  console.log(`Instalações com erro:        ${iError}`);
  console.log(`Notas criadas:               ${nCreated}`);
  console.log('');
  console.log('Revise os rascunhos em: /admin/rascunhos');

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
