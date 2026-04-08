const fs = require('fs');
const pdfParse = require('pdf-parse');
const pdf = pdfParse.default || pdfParse;

const PDF_PATH = 'C:/Users/Utilizador/Downloads/Almada - Barreiro - Seixal.pdf';
const OUT_PATH = 'C:/Users/Utilizador/Downloads/instalacoes.csv';

const NIVEL_TENSAO_MAP = { 'MT': 'MT', 'BTE': 'BTE', 'BTN': 'BTN', 'AT': 'AT', 'MAT': 'MAT' };

function parseDate(str) {
  if (!str) return '';
  // Format: DD-MM-YYYY -> YYYY-MM-DD
  const m = str.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return str;
}

function cleanField(str) {
  if (!str) return '';
  return str.trim().replace(/"/g, '""');
}

function q(str) {
  return `"${cleanField(str)}"`;
}

async function main() {
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const data = await pdf(dataBuffer);
  const text = data.text;

  // Split into lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const records = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // CPE lines start with PT followed by many digits and letters
    if (/^PT\d{14,}[A-Z0-9]{2}$/.test(line)) {
      const cpe = line;

      // Collect next ~10 lines for this record
      const block = lines.slice(i + 1, i + 12).join(' ');

      // Try to find NIPC (PT + 9 digits)
      const nipcMatch = block.match(/PT\d{9}/);
      const nipc = nipcMatch ? nipcMatch[0] : '';

      // Find data inicio contrato (DD-MM-YYYY)
      const dateMatch = block.match(/\d{2}-\d{2}-\d{4}/);
      const dataInicio = dateMatch ? parseDate(dateMatch[0]) : '';

      // Find nivel tensao
      let nivelTensao = '';
      const nivelMatch = block.match(/\b(MAT|MT|BTE|BTN|AT)\b/);
      if (nivelMatch) nivelTensao = nivelMatch[1];

      // Find postal code (NNNN-NNN)
      const postalMatch = block.match(/\b(\d{4}-\d{3})\b/);
      const codPostal = postalMatch ? postalMatch[1] : '';

      // Find CMA - last number in block (typically large)
      const numbers = block.match(/\b(\d{1,7})\b/g) || [];
      const cma = numbers.length > 0 ? numbers[numbers.length - 1] : '';

      // Nome: first meaningful text after NIPC
      // It's hard to parse precisely from raw text, skip for now

      records.push({ cpe, nipc, codPostal, dataInicio, nivelTensao, cma, raw: block.substring(0, 200) });
    }
  }

  console.log(`Found ${records.length} records`);
  console.log('Sample:', JSON.stringify(records[0], null, 2));

  // Write CSV
  const header = 'CPE,NIPC,Cod_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh,Raw\n';
  const rows = records.map(r =>
    [q(r.cpe), q(r.nipc), q(r.codPostal), q(r.dataInicio), q(r.nivelTensao), q(r.cma), q(r.raw)].join(',')
  );
  fs.writeFileSync(OUT_PATH, header + rows.join('\n'), 'utf8');
  console.log(`CSV written to ${OUT_PATH}`);
}

main().catch(console.error);
