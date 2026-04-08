const PDFParser = require('pdf2json');
const fs = require('fs');

const PDF_PATH = 'C:/Users/Utilizador/Downloads/Almada - Barreiro - Seixal.pdf';
const OUT_PATH  = 'C:/Users/Utilizador/Downloads/instalacoes.csv';

function parseDate(str) {
  const m = str && str.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function q(str) {
  return `"${String(str||'').trim().replace(/"/g,'""')}"`;
}

function decode(str) {
  try { return decodeURIComponent(str); } catch(e) { return str; }
}

const pdfParser = new PDFParser(null, 1);

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));

pdfParser.on('pdfParser_dataReady', pdfData => {
  // Extract all text page by page
  let allText = '';
  const pages = pdfData.Pages || [];
  console.log('Pages found:', pages.length);

  for (const page of pages) {
    const texts = (page.Texts || []).map(t => ({
      x: t.x, y: t.y,
      text: t.R.map(r => decode(r.T)).join('')
    }));

    // Sort by Y descending then X ascending (pdf2json y increases downward)
    texts.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    for (const t of texts) {
      allText += t.text.trim() + '\n';
    }
    allText += '\n';
  }

  fs.writeFileSync('C:/Users/Utilizador/Downloads/debug2.txt', allText, 'utf8');
  console.log('Text length:', allText.length);
  console.log('First 500 chars:', allText.substring(0, 500));

  const lines = allText.split('\n').map(l => l.trim()).filter(l => l);

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
      if (cpeRe.test(l)) break;
      if (nipcIdx === -1 && nipcRe.test(l))    { nipc = l; nipcIdx = j; }
      if (postalIdx === -1 && postalRe.test(l)) { codPostal = l; postalIdx = j; }
      if (nivelIdx === -1 && nivelRe.test(l))   { nivelTensao = l; nivelIdx = j; }
      if (nivelIdx !== -1 && numRe.test(l) && !cma && j > nivelIdx) { cma = l; }
    }

    if (nipcIdx > 0)  nome = window[nipcIdx - 1];
    if (postalIdx !== -1 && postalIdx + 1 < window.length) descPostal = window[postalIdx + 1];

    if (nipcIdx !== -1 && postalIdx > nipcIdx + 1) {
      rua   = window[nipcIdx + 1] || '';
      if (nipcIdx + 2 < postalIdx) porta = window[nipcIdx + 2] || '';
      if (nipcIdx + 3 < postalIdx) andar = window[nipcIdx + 3] || '';
    }

    for (const l of window) {
      if (dateRe.test(l)) { dataInicio = parseDate(l); break; }
    }

    records.push({ cpe, nipc, nome, rua, porta, andar, codPostal, descPostal, dataInicio, nivelTensao, cma });
  }

  console.log(`\nExtracted ${records.length} records`);
  if (records[0]) console.log('Sample 1:', JSON.stringify(records[0]));
  if (records[5]) console.log('Sample 6:', JSON.stringify(records[5]));

  const header = 'CPE,NIPC,Nome,Rua,Porta,Andar_Fracao,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
  const rows = records.map(r =>
    [q(r.cpe),q(r.nipc),q(r.nome),q(r.rua),q(r.porta),q(r.andar),
     q(r.codPostal),q(r.descPostal),q(r.dataInicio),q(r.nivelTensao),q(r.cma)].join(',')
  );
  fs.writeFileSync(OUT_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
  console.log('CSV saved to:', OUT_PATH);
});

pdfParser.loadPDF(PDF_PATH);
