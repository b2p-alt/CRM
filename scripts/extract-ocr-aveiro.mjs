// OCR extraction for Aveiro PDF (image-based)
// Same pipeline as extract-ocr.mjs: mupdf render + tesseract
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';
import * as mupdf from 'mupdf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PDF_PATH  = 'C:/Users/Utilizador/Downloads/3700 3800 3900 Aveiro.pdf';
const CSV_PATH  = 'C:/Users/Utilizador/Downloads/aveiro-instalacoes.csv';
const OCR_TXT   = 'C:/Users/Utilizador/Downloads/aveiro-ocr-full.txt';
const DEBUG_DIR = 'C:/Users/Utilizador/Downloads/aveiro-ocr-pages';

function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function q(str) {
  return `"${String(str || '').trim().replace(/"/g, '""')}"`;
}

function parseOcrText(allText) {
  const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const cpeRe    = /^PT[0-9A-Z]{14,22}$/;
  const nipcRe   = /^PT\d{9}$/;
  const dateRe   = /^\d{2}-\d{2}-\d{4}$/;
  const postalRe = /^\d{4}-\d{3}$/;
  const nivelRe  = /^(MAT|MT|BTE|BTN|AT)$/;
  const numRe    = /^\d+$/;

  const records = [];

  for (let i = 0; i < lines.length; i++) {
    const norm = lines[i].toUpperCase().replace(/\s/g, '').replace(/O/g, '0');

    const isCpe = cpeRe.test(norm) ||
      (norm.startsWith('PT') && norm.length >= 16 && norm.length <= 22 && /^[A-Z0-9]+$/.test(norm));

    if (!isCpe) continue;

    const cpe = norm;
    const win = lines.slice(i + 1, i + 30);

    let nome = '', nipc = '', rua = '', porta = '', andar = '';
    let codPostal = '', descPostal = '', dataInicio = '', nivelTensao = '', cma = '';
    let nipcIdx = -1, postalIdx = -1, nivelIdx = -1;

    for (let j = 0; j < win.length; j++) {
      const l = win[j];
      const lNorm = l.toUpperCase().replace(/\s/g, '').replace(/O/g, '0');

      if (cpeRe.test(lNorm) || (lNorm.startsWith('PT') && lNorm.length >= 16)) break;

      if (nipcIdx === -1 && nipcRe.test(lNorm)) { nipc = lNorm; nipcIdx = j; }

      const postalClean = l.replace(/[oO]/g, '0').trim();
      if (postalIdx === -1 && postalRe.test(postalClean)) { codPostal = postalClean; postalIdx = j; }

      if (nivelIdx === -1 && nivelRe.test(l.trim().toUpperCase())) { nivelTensao = l.trim().toUpperCase(); nivelIdx = j; }

      const numClean = l.replace(/[oO]/g, '0').trim();
      if (nivelIdx !== -1 && numRe.test(numClean) && !cma && j > nivelIdx) cma = numClean;

      const dateClean = l.replace(/[oO]/g, '0').trim();
      if (!dataInicio && dateRe.test(dateClean)) dataInicio = parseDate(dateClean);
    }

    if (nipcIdx > 0) nome = win[nipcIdx - 1];
    if (postalIdx !== -1 && postalIdx + 1 < win.length) descPostal = win[postalIdx + 1];
    if (nipcIdx !== -1 && postalIdx > nipcIdx + 1) {
      rua   = win[nipcIdx + 1] || '';
      porta = (nipcIdx + 2 < postalIdx) ? win[nipcIdx + 2] || '' : '';
      andar = (nipcIdx + 3 < postalIdx) ? win[nipcIdx + 3] || '' : '';
    }

    records.push({ cpe, nipc, nome, rua, porta, andar, codPostal, descPostal, dataInicio, nivelTensao, cma });
  }

  return records;
}

async function main() {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  console.log('Loading PDF with MuPDF...');
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const numPages = doc.countPages();
  console.log(`PDF has ${numPages} pages`);

  console.log('Initializing OCR worker (por+eng)...');
  const worker = await createWorker('por+eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r  OCR: ${(m.progress * 100).toFixed(0)}%   `);
      } else if (m.progress > 0 && m.progress < 1) {
        process.stdout.write(`\r  ${m.status}: ${(m.progress * 100).toFixed(0)}%   `);
      }
    }
  });

  let allText = '';

  for (let p = 0; p < numPages; p++) {
    process.stdout.write(`\nPage ${p + 1}/${numPages}: rendering...`);
    const page   = doc.loadPage(p);
    const matrix = mupdf.Matrix.scale(3, 3);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const pngBuf = Buffer.from(pixmap.asPNG());

    const imgPath = path.join(DEBUG_DIR, `page-${p + 1}.png`);
    fs.writeFileSync(imgPath, pngBuf);
    process.stdout.write(` ${(pngBuf.length / 1024).toFixed(0)}KB | OCR...`);

    const { data: { text } } = await worker.recognize(pngBuf);
    console.log(` ${text.length} chars`);
    fs.writeFileSync(path.join(DEBUG_DIR, `page-${p + 1}.txt`), text, 'utf8');
    allText += text + '\n\n';
  }

  await worker.terminate();

  fs.writeFileSync(OCR_TXT, allText, 'utf8');
  console.log(`\nFull OCR saved: ${allText.length} chars`);

  const records = parseOcrText(allText);
  console.log(`Extracted ${records.length} records`);
  if (records[0]) console.log('Sample 0:', JSON.stringify(records[0]));
  if (records[1]) console.log('Sample 1:', JSON.stringify(records[1]));

  if (records.length > 0) {
    const header = 'CPE,NIPC,Nome,Rua,Porta,Andar_Fracao,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
    const rows   = records.map(r =>
      [q(r.cpe), q(r.nipc), q(r.nome), q(r.rua), q(r.porta), q(r.andar),
       q(r.codPostal), q(r.descPostal), q(r.dataInicio), q(r.nivelTensao), q(r.cma)].join(',')
    );
    fs.writeFileSync(CSV_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
    console.log('CSV saved:', CSV_PATH);
  } else {
    console.log('No records. Check:', OCR_TXT);
  }
}

main().catch(console.error);
