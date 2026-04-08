const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const { createCanvas } = require('canvas');

const PDF_PATH = 'C:/Users/Utilizador/Downloads/Almada - Barreiro - Seixal.pdf';
const OUT_PATH  = 'C:/Users/Utilizador/Downloads/instalacoes.csv';
const DEBUG_DIR = 'C:/Users/Utilizador/Downloads/ocr-pages';

// pdfjs needs to be loaded as CJS legacy build
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function q(str) {
  return `"${String(str || '').trim().replace(/"/g, '""')}"`;
}

async function renderPageToBuffer(page, scale = 3) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return canvas.toBuffer('image/png');
}

function parseOcrText(allText) {
  const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const cpeRe    = /^PT[0-9A-Z]{14,22}$/;
  const nipcRe   = /^PT\d{9}$/;
  const dateRe   = /^\d{2}-\d{2}-\d{4}$/;
  const postalRe = /^\d{4}-\d{3}$/;
  const nivelRe  = /^(MAT|MT|BTE|BTN|AT)$/;
  const numRe    = /^\d+$/;

  // Fuzzy CPE match: OCR may misread some chars
  const cpeLoose = /^PT[0-9A-Z0-9]{14,22}$/i;

  const records = [];

  for (let i = 0; i < lines.length; i++) {
    // Normalize common OCR errors in CPE lines
    const normalized = lines[i]
      .replace(/\bPl\b/g, 'PT')
      .replace(/[lI]/g, l => lines[i].startsWith('PT') ? l : l)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const isCpe = cpeRe.test(normalized) ||
      (normalized.startsWith('PT') && normalized.length >= 16 && normalized.length <= 22 && /^[A-Z0-9]+$/.test(normalized));

    if (!isCpe) continue;

    const cpe = normalized;
    const window = lines.slice(i + 1, i + 30);

    let nome = '', nipc = '', rua = '', porta = '', andar = '';
    let codPostal = '', descPostal = '', dataInicio = '', nivelTensao = '', cma = '';
    let nipcIdx = -1, postalIdx = -1, nivelIdx = -1;

    for (let j = 0; j < window.length; j++) {
      const l = window[j];
      const ln = l.toUpperCase().replace(/[^A-Z0-9\-]/g, s => s === '-' ? '-' : '');

      // Stop if next CPE found
      if (cpeRe.test(ln) || (ln.startsWith('PT') && ln.length >= 16)) break;

      // NIPC: PT + 9 digits (OCR may misread)
      const nipcClean = l.replace(/[oO]/g, '0').replace(/[lI]/g, '1').toUpperCase();
      if (nipcIdx === -1 && /^PT\d{9}$/.test(nipcClean)) {
        nipc = nipcClean; nipcIdx = j;
      }

      // Postal code: NNNN-NNN
      const postalClean = l.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
      if (postalIdx === -1 && postalRe.test(postalClean)) {
        codPostal = postalClean; postalIdx = j;
      }

      // Nivel tensao
      if (nivelIdx === -1 && nivelRe.test(l.toUpperCase())) {
        nivelTensao = l.toUpperCase(); nivelIdx = j;
      }

      // CMA: first pure number after nivel tensao
      if (nivelIdx !== -1 && numRe.test(l.replace(/[oO]/g, '0')) && !cma && j > nivelIdx) {
        cma = l.replace(/[oO]/g, '0');
      }

      // Date
      const dateClean = l.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
      if (!dataInicio && dateRe.test(dateClean)) {
        dataInicio = parseDate(dateClean);
      }
    }

    if (nipcIdx > 0) nome = window[nipcIdx - 1];
    if (postalIdx !== -1 && postalIdx + 1 < window.length) descPostal = window[postalIdx + 1];

    if (nipcIdx !== -1 && postalIdx > nipcIdx + 1) {
      rua   = window[nipcIdx + 1] || '';
      porta = (nipcIdx + 2 < postalIdx) ? window[nipcIdx + 2] || '' : '';
      andar = (nipcIdx + 3 < postalIdx) ? window[nipcIdx + 3] || '' : '';
    }

    records.push({ cpe, nipc, nome, rua, porta, andar, codPostal, descPostal, dataInicio, nivelTensao, cma });
  }

  return records;
}

async function main() {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  console.log('Loading PDF...');
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  console.log(`PDF has ${pdfDoc.numPages} pages`);

  const worker = await createWorker('por+eng', 1, {
    logger: m => { if (m.status === 'recognizing text') process.stdout.write(`\r  OCR progress: ${(m.progress * 100).toFixed(0)}%`); }
  });

  let allText = '';

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    console.log(`\nPage ${p}/${pdfDoc.numPages}: rendering...`);
    const page = await pdfDoc.getPage(p);
    const imgBuffer = await renderPageToBuffer(page, 3); // scale=3 for better OCR

    // Save page image for debug
    fs.writeFileSync(path.join(DEBUG_DIR, `page-${p}.png`), imgBuffer);
    console.log(`  Saved page image (${(imgBuffer.length / 1024).toFixed(0)} KB)`);

    console.log(`  Running OCR...`);
    const { data: { text } } = await worker.recognize(imgBuffer);
    console.log(`  OCR done, ${text.length} chars`);

    // Save OCR text per page
    fs.writeFileSync(path.join(DEBUG_DIR, `page-${p}.txt`), text, 'utf8');

    allText += text + '\n\n';
  }

  await worker.terminate();

  // Save full OCR text
  fs.writeFileSync('C:/Users/Utilizador/Downloads/ocr-full.txt', allText, 'utf8');
  console.log(`\nFull OCR text: ${allText.length} chars`);

  const records = parseOcrText(allText);
  console.log(`\nExtracted ${records.length} records`);

  if (records.length > 0) {
    console.log('Sample 1:', JSON.stringify(records[0]));
    if (records[1]) console.log('Sample 2:', JSON.stringify(records[1]));
  } else {
    console.log('\nNo records found. Check C:/Users/Utilizador/Downloads/ocr-full.txt for raw OCR output.');
    console.log('First 1000 chars of OCR:');
    console.log(allText.substring(0, 1000));
  }

  if (records.length > 0) {
    const header = 'CPE,NIPC,Nome,Rua,Porta,Andar_Fracao,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
    const rows = records.map(r =>
      [q(r.cpe), q(r.nipc), q(r.nome), q(r.rua), q(r.porta), q(r.andar),
       q(r.codPostal), q(r.descPostal), q(r.dataInicio), q(r.nivelTensao), q(r.cma)].join(',')
    );
    fs.writeFileSync(OUT_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
    console.log('CSV saved to:', OUT_PATH);
  }
}

main().catch(console.error);
