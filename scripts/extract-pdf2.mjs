import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_PATH = 'C:/Users/Utilizador/Downloads/Almada - Barreiro - Seixal.pdf';
const OUT_PATH  = 'C:/Users/Utilizador/Downloads/instalacoes.csv';

function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function q(str) {
  return `"${String(str||'').trim().replace(/"/g,'""')}"`;
}

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await getDocument({ data }).promise;
  let allText = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Sort items by Y then X to preserve reading order
    const items = content.items
      .filter(i => i.str && i.str.trim())
      .sort((a, b) => {
        const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
        if (dy !== 0) return dy;
        return a.transform[4] - b.transform[4];
      });
    for (const item of items) {
      allText += item.str.trim() + '\n';
    }
    allText += '\n';
  }
  return allText;
}

async function main() {
  console.log('Extracting text from PDF...');
  const text = await extractText(PDF_PATH);
  fs.writeFileSync('C:/Users/Utilizador/Downloads/debug.txt', text, 'utf8');
  console.log('Text length:', text.length);

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // CPE: PT + 16-22 alphanumeric chars
  const cpeRe    = /^PT[0-9A-Z]{14,22}$/;
  const nipcRe   = /^PT\d{9}$/;
  const dateRe   = /^\d{2}-\d{2}-\d{4}$/;
  const postalRe = /^\d{4}-\d{3}$/;
  const nivelRe  = /^(MAT|MT|BTE|BTN|AT)$/;
  const numRe    = /^\d+$/;

  const records = [];

  for (let i = 0; i < lines.length; i++) {
    if (!cpeRe.test(lines[i])) continue;

    const cpe = lines[i];
    const window = lines.slice(i + 1, i + 25);

    let nome = '', nipc = '', rua = '', porta = '', andar = '';
    let codPostal = '', descPostal = '', dataInicio = '', nivelTensao = '', cma = '';

    let nipcIdx = -1, postalIdx = -1, nivelIdx = -1;

    for (let j = 0; j < window.length; j++) {
      const l = window[j];
      if (cpeRe.test(l)) break; // next record
      if (nipcIdx === -1 && nipcRe.test(l))   { nipc = l; nipcIdx = j; }
      if (postalIdx === -1 && postalRe.test(l)){ codPostal = l; postalIdx = j; }
      if (nivelIdx === -1 && nivelRe.test(l))  { nivelTensao = l; nivelIdx = j; }
      if (nivelIdx !== -1 && numRe.test(l) && cma === '' && j > nivelIdx) { cma = l; }
    }

    // Nome: line just before NIPC
    if (nipcIdx > 0) nome = window[nipcIdx - 1];

    // Desc postal: line after postal code
    if (postalIdx !== -1 && postalIdx + 1 < window.length) descPostal = window[postalIdx + 1];

    // Rua: lines between NIPC and postal
    if (nipcIdx !== -1 && postalIdx !== -1 && postalIdx > nipcIdx + 1) {
      rua   = window[nipcIdx + 1] || '';
      porta = window[nipcIdx + 2] && !postalRe.test(window[nipcIdx + 2]) && nipcIdx + 2 < postalIdx ? window[nipcIdx + 2] : '';
      andar = window[nipcIdx + 3] && !postalRe.test(window[nipcIdx + 3]) && nipcIdx + 3 < postalIdx ? window[nipcIdx + 3] : '';
    }

    // Date: anywhere in window
    for (const l of window) {
      if (dateRe.test(l)) { dataInicio = parseDate(l); break; }
    }

    records.push({ cpe, nipc, nome, rua, porta, andar, codPostal, descPostal, dataInicio, nivelTensao, cma });
  }

  console.log(`Extracted ${records.length} records`);
  if (records[0]) console.log('Sample 1:', JSON.stringify(records[0]));
  if (records[1]) console.log('Sample 2:', JSON.stringify(records[1]));

  const header = 'CPE,NIPC,Nome,Rua,Porta,Andar_Fracao,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
  const rows = records.map(r =>
    [q(r.cpe),q(r.nipc),q(r.nome),q(r.rua),q(r.porta),q(r.andar),
     q(r.codPostal),q(r.descPostal),q(r.dataInicio),q(r.nivelTensao),q(r.cma)].join(',')
  );
  fs.writeFileSync(OUT_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
  console.log('CSV saved to:', OUT_PATH);
}

main().catch(console.error);
