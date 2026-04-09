#!/usr/bin/env node
/**
 * import-pdf.mjs — Pipeline completo: PDF → OCR → BD
 *
 * Uso:
 *   node scripts/import-pdf.mjs <caminho-pdf> [distrito] [opções]
 *
 * Opções:
 *   --skip-ocr     Reutiliza TXT já existente (salta OCR)
 *   --sql-only     Gera apenas ficheiros SQL, não importa na BD
 *   --dry-run      Mostra o que faria, sem escrever nada
 *
 * Exemplos:
 *   node scripts/import-pdf.mjs "C:/Downloads/Aveiro.pdf" Aveiro
 *   node scripts/import-pdf.mjs "C:/Downloads/Setubal.pdf" --skip-ocr
 *   node scripts/import-pdf.mjs "C:/Downloads/Lisboa.pdf" Lisboa --sql-only
 */

import fs   from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';
import { createWorker }  from 'tesseract.js';
import * as mupdf        from 'mupdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────
const args     = process.argv.slice(2);
const flags    = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

const PDF_PATH  = positional[0];
const SKIP_OCR  = flags.includes('--skip-ocr');
const SQL_ONLY  = flags.includes('--sql-only');
const DRY_RUN   = flags.includes('--dry-run');

if (!PDF_PATH) {
  console.error('Uso: node scripts/import-pdf.mjs <pdf> [distrito] [--skip-ocr] [--sql-only] [--dry-run]');
  process.exit(1);
}

// Auto-detect distrito from filename or 2nd positional arg
function guessDistrito(filePath, arg) {
  if (arg) return arg;
  const base  = path.basename(filePath, path.extname(filePath));
  const known = ['Aveiro','Lisboa','Porto','Setubal','Braga','Coimbra','Leiria',
                  'Santarém','Setúbal','Faro','Évora','Beja','Viseu','Guarda',
                  'Castelo Branco','Bragança','Vila Real','Viana do Castelo',
                  'Portalegre','Açores','Madeira'];
  for (const d of known) {
    if (base.toLowerCase().includes(d.toLowerCase())) return d;
  }
  // Try last word of filename
  const parts = base.split(/[\s\-_]+/);
  return parts[parts.length - 1];
}

const DISTRITO = guessDistrito(PDF_PATH, positional[1]);

// ─── Paths ───────────────────────────────────────────────────
const PDF_BASE   = path.basename(PDF_PATH, path.extname(PDF_PATH))
                        .replace(/[^a-z0-9]/gi, '-').toLowerCase();
const WORK_DIR   = path.join('C:/Users/Utilizador/Downloads', `ocr-${PDF_BASE}`);
const OCR_TXT    = path.join(WORK_DIR, 'ocr-full.txt');
const OUT_DIR    = 'C:/Users/Utilizador/Downloads';

console.log(`\n═══════════════════════════════════════════════`);
console.log(`  PDF:      ${PDF_PATH}`);
console.log(`  Distrito: ${DISTRITO}`);
console.log(`  WorkDir:  ${WORK_DIR}`);
console.log(`  Flags:    ${[SKIP_OCR && '--skip-ocr', SQL_ONLY && '--sql-only', DRY_RUN && '--dry-run'].filter(Boolean).join(' ') || 'none'}`);
console.log(`═══════════════════════════════════════════════\n`);

if (!fs.existsSync(PDF_PATH)) {
  console.error(`Erro: ficheiro não encontrado: ${PDF_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });

// ─── STEP 1: OCR ─────────────────────────────────────────────
async function runOcr() {
  if (SKIP_OCR && fs.existsSync(OCR_TXT)) {
    console.log(`[OCR] Reutilizando ${OCR_TXT}`);
    return fs.readFileSync(OCR_TXT, 'utf8');
  }

  console.log('[OCR] Carregando PDF com MuPDF...');
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const doc       = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const numPages  = doc.countPages();
  console.log(`[OCR] ${numPages} páginas`);

  const worker = await createWorker('por+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text')
        process.stdout.write(`\r  ${(m.progress * 100).toFixed(0)}%  `);
    }
  });

  let allText = '';

  for (let p = 0; p < numPages; p++) {
    const txtPath = path.join(WORK_DIR, `page-${p + 1}.txt`);
    const pngPath = path.join(WORK_DIR, `page-${p + 1}.png`);

    // Cache: skip if txt already exists
    if (SKIP_OCR && fs.existsSync(txtPath)) {
      process.stdout.write(`\n[OCR] Pág ${p + 1}/${numPages}: cache ✓`);
      allText += fs.readFileSync(txtPath, 'utf8') + '\n\n';
      continue;
    }

    process.stdout.write(`\n[OCR] Pág ${p + 1}/${numPages}: renderizar...`);
    const page   = doc.loadPage(p);
    const matrix = mupdf.Matrix.scale(3, 3);   // 3x = ~216 DPI
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const pngBuf = Buffer.from(pixmap.asPNG());

    if (!DRY_RUN) fs.writeFileSync(pngPath, pngBuf);
    process.stdout.write(` ${(pngBuf.length / 1024).toFixed(0)}KB | OCR...`);

    const { data: { text } } = await worker.recognize(pngBuf);
    process.stdout.write(` ${text.length} chars`);

    if (!DRY_RUN) fs.writeFileSync(txtPath, text, 'utf8');
    allText += text + '\n\n';
  }

  await worker.terminate();
  console.log('\n');

  if (!DRY_RUN) {
    fs.writeFileSync(OCR_TXT, allText, 'utf8');
    console.log(`[OCR] Completo → ${OCR_TXT}`);
  }
  return allText;
}

// ─── STEP 2: Parse ───────────────────────────────────────────
function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function fixNipcPrefix(s) {
  return s.replace(/PT([sSoOiIlD|])/g, (_, c) => {
    const map = { s:'5',S:'5',o:'0',O:'0',i:'1',I:'1','|':'1',l:'1',D:'0' };
    return 'PT' + (map[c] || c);
  });
}

function cleanNivel(v) {
  return ({ MAT:'MAT',MT:'MT',BTE:'BTE',BTN:'BTN',AT:'AT' })[v?.toUpperCase()] || null;
}

function cleanNipc(v) {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  return /^PT\d{9}$/.test(c) ? c : null;
}

function cleanCpe(v) {
  if (!v) return null;
  const c = v.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  return (/^PT[A-Z0-9]{14,22}$/.test(c)) ? c : null;
}

function cleanLocalidade(v) {
  if (!v) return null;
  const clean = v.trim().split(/\s+/).filter(w => /^[A-ZÀ-Üa-zà-ü\-\/]+$/.test(w)).join(' ').trim();
  return clean.length >= 2 ? clean : null;
}

function cleanNome(v) {
  if (!v) return null;
  return v.trim().replace(/\.\.\.$/, '').replace(/[|]/g,'I').replace(/\s+/g,' ').trim() || null;
}

function parseLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.length < 30 || !/^PT/i.test(line)) return null;

  const firstToken = line.split(/\s+/)[0];
  const cpe = firstToken.toUpperCase().replace(/[oO]/g,'0').replace(/[|Il)]/g,'1');
  if (cpe.length < 16 || cpe.length > 28 || !/^PT[0-9A-Z]+$/.test(cpe)) return null;

  const rest  = line.slice(firstToken.length).trim();
  const restN = fixNipcPrefix(rest).replace(/[oO]/g,'0');

  const nipcMatch = restN.match(/\bPT(\d{9})\b/);
  const nipc      = nipcMatch ? `PT${nipcMatch[1]}` : '';
  const nipcPos   = nipcMatch ? restN.indexOf(nipcMatch[0]) : -1;

  const p1 = restN.match(/\b(\d{4}-\d{3})\b/);
  const p2 = restN.match(/\b([3-9]\d{3})(\d{3})\b/);
  const codPostal = p1 ? p1[1] : p2 ? `${p2[1]}-${p2[2]}` : '';

  const dateMatch  = restN.match(/\b(\d{2}-\d{2}-\d{4})\b/);
  const dataInicio = dateMatch ? parseDate(dateMatch[1]) : '';

  const nivelMatch  = rest.match(/\b(MAT|MT|BTE|BTN|AT)\b/i);
  const nivelTensao = nivelMatch ? nivelMatch[1].toUpperCase() : '';

  const afterNivel  = nivelTensao ? rest.slice(rest.search(new RegExp('\\b'+nivelTensao+'\\b','i')) + nivelTensao.length) : rest;
  const cmaMatches  = afterNivel.replace(/[oO]/g,'0').match(/\b\d{1,10}\b/g) || [];
  const cma         = cmaMatches.length ? cmaMatches[cmaMatches.length - 1] : '';

  let nome = '';
  if (nipcPos > 0) nome = rest.slice(0, nipcPos).trim().replace(/\.\.\.$/, '').replace(/[|]/g,'I').trim();

  let rua = '';
  if (nipc && codPostal && nipcPos >= 0) {
    const nipcEnd   = nipcPos + nipcMatch[0].length;
    const postalPos = restN.search(new RegExp(codPostal.replace('-', '[-]?')));
    if (postalPos > nipcEnd) rua = rest.slice(nipcEnd, postalPos).trim();
  }

  let descPostal = '';
  if (codPostal) {
    const postalPos = restN.search(new RegExp(codPostal.replace('-','[-]?')));
    if (postalPos >= 0) {
      const after = rest.slice(postalPos + codPostal.length).trim();
      const desc  = [];
      for (const w of after.split(/\s+/)) {
        const wn = w.replace(/[oO]/g,'0');
        if (/^\d{4,}$/.test(wn) || /^(MAT|MT|BTE|BTN|AT|TETRA)$/i.test(w) || /^\d{2}-\d{2}-\d{4}$/.test(wn)) break;
        if (/^[-—]+$/.test(w)) continue;
        desc.push(w);
        if (desc.length >= 5) break;
      }
      descPostal = desc.join(' ').replace(/^[^A-Za-zÀ-ÿ]+/,'').trim();
    }
  }

  return { cpe, nipc, nome, rua, codPostal, descPostal, dataInicio, nivelTensao, cma };
}

function parseText(text) {
  const records = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    const r = parseLine(line);
    if (!r || !r.nipc || !r.codPostal || !r.nivelTensao) { skipped++; continue; }
    records.push(r);
  }
  console.log(`[Parse] ${records.length} registos, ${skipped} linhas ignoradas`);
  return records;
}

// ─── STEP 3: Generate SQL ─────────────────────────────────────
function sqlStr(val) {
  if (!val || val.trim() === '') return 'NULL';
  return `'${val.trim().replace(/'/g,"''")}'`;
}

function validDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [,, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return s;
}

function buildSql(records, distrito) {
  const seenNipc    = new Set();
  const empresaRows = [];
  const instalRows  = [];

  for (const r of records) {
    const nif  = cleanNipc(r.nipc);
    const cpe  = cleanCpe(r.cpe);
    const nivel = cleanNivel(r.nivelTensao);
    if (!nif || !cpe || !nivel) continue;

    if (!seenNipc.has(nif)) {
      seenNipc.add(nif);
      const nome     = sqlStr(cleanNome(r.nome) || 'Sem nome');
      const local    = sqlStr(cleanLocalidade(r.descPostal));
      const dist     = sqlStr(distrito);
      empresaRows.push(`(${sqlStr(nif)}, ${nome}, ${local}, ${dist}, NOW(), NOW())`);
    }

    const cma    = r.cma && !isNaN(parseFloat(r.cma)) ? parseFloat(r.cma) : 'NULL';
    const dataIn = validDate(r.dataInicio) ? sqlStr(r.dataInicio) : 'NULL';
    instalRows.push(`(gen_random_uuid(), ${sqlStr(cpe)}, '${nivel}'::"TipoInstalacao", ${cma}, ${dataIn}, ${sqlStr(nif)}, NOW(), NOW())`);
  }

  console.log(`[SQL] ${empresaRows.length} empresas, ${instalRows.length} instalações`);

  const empresaSql = `-- EMPRESAS ${distrito.toUpperCase()} (${empresaRows.length} registos)
INSERT INTO "Empresa" (nif, nome, localidade, distrito, "createdAt", "updatedAt")
VALUES
${empresaRows.join(',\n')}
ON CONFLICT (nif) DO NOTHING;

SELECT COUNT(*) AS total_empresas FROM "Empresa";
`;

  const instalSql = `-- INSTALAÇÕES ${distrito.toUpperCase()} (${instalRows.length} registos)
-- Execute DEPOIS das empresas
INSERT INTO "Instalacao" (id, cpe, "tipoInstalacao", "consumoAnual", "dataInicioContrato", "empresaNif", "createdAt", "updatedAt")
VALUES
${instalRows.join(',\n')}
ON CONFLICT (cpe) DO NOTHING;

SELECT COUNT(*) AS total_instalacoes FROM "Instalacao";
`;

  return { empresaSql, instalSql, numEmpresas: empresaRows.length, numInstalacoes: instalRows.length };
}

// ─── STEP 4: Import directo na BD ────────────────────────────
async function importDb(empresaSql, instalSql) {
  // Load DATABASE_URL from .env
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
      if (match) dbUrl = match[1].trim();
    }
    const envLocal = path.join(__dirname, '..', '.env.local');
    if (!dbUrl && fs.existsSync(envLocal)) {
      const envContent = fs.readFileSync(envLocal, 'utf8');
      const match = envContent.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
      if (match) dbUrl = match[1].trim();
    }
  }

  if (!dbUrl) {
    console.error('[DB] DATABASE_URL não encontrada. Use --sql-only e importe manualmente.');
    return false;
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl });

  try {
    console.log('[DB] Ligando à base de dados...');
    await client.connect();

    console.log('[DB] Importando empresas...');
    const r1 = await client.query(empresaSql);
    const countE = await client.query('SELECT COUNT(*) FROM "Empresa"');
    console.log(`[DB] Total empresas na BD: ${countE.rows[0].count}`);

    console.log('[DB] Importando instalações...');
    const r2 = await client.query(instalSql);
    const countI = await client.query('SELECT COUNT(*) FROM "Instalacao"');
    console.log(`[DB] Total instalações na BD: ${countI.rows[0].count}`);

    return true;
  } catch (err) {
    console.error('[DB] Erro:', err.message);
    console.log('[DB] Os ficheiros SQL foram guardados; importe-os manualmente.');
    return false;
  } finally {
    await client.end();
  }
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();

  // 1. OCR
  const ocrText = await runOcr();

  // 2. Parse
  const records = parseText(ocrText);
  if (records.length === 0) {
    console.error('[!] Nenhum registo encontrado. Verifique o OCR em:', OCR_TXT);
    process.exit(1);
  }

  // 3. Build SQL
  const { empresaSql, instalSql, numEmpresas, numInstalacoes } = buildSql(records, DISTRITO);

  // 4. Save SQL files (always)
  const slug     = PDF_BASE;
  const sqlE     = path.join(OUT_DIR, `import-${slug}-empresas.sql`);
  const sqlI     = path.join(OUT_DIR, `import-${slug}-instalacoes.sql`);

  if (!DRY_RUN) {
    fs.writeFileSync(sqlE, empresaSql, 'utf8');
    fs.writeFileSync(sqlI, instalSql, 'utf8');
    console.log(`\n[SQL] Ficheiros guardados:`);
    console.log(`      ${sqlE}`);
    console.log(`      ${sqlI}`);
  }

  // 5. Import to DB (unless --sql-only or --dry-run)
  if (!SQL_ONLY && !DRY_RUN) {
    const ok = await importDb(empresaSql, instalSql);
    if (ok) {
      console.log('\n✓ Import concluído na BD!');
    } else {
      console.log('\n→ Execute os SQL manualmente no Supabase SQL Editor.');
    }
  } else {
    console.log('\n→ Modo SQL only. Execute os ficheiros SQL manualmente.');
  }

  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  console.log(`\nTempo total: ${elapsed} min`);
  console.log(`Empresas: ${numEmpresas} | Instalações: ${numInstalacoes}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
