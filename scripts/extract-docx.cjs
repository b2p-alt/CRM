const fs = require('fs');
const mammoth = require('mammoth');

const DOCX_PATH = 'C:/Users/Utilizador/Downloads/Almada - Barreiro - Seixal.docx';
const OUT_PATH  = 'C:/Users/Utilizador/Downloads/instalacoes.csv';

function parseDate(str) {
  if (!str) return '';
  const m = str.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

function q(str) {
  if (str === undefined || str === null) str = '';
  return `"${String(str).trim().replace(/"/g, '""')}"`;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function main() {
  // Extract as HTML to get table structure
  const result = await mammoth.convertToHtml({ path: DOCX_PATH });
  const html = result.value;

  // Save HTML for inspection
  fs.writeFileSync('C:/Users/Utilizador/Downloads/debug.html', html, 'utf8');
  console.log('HTML length:', html.length);
  console.log('HTML sample:', html.substring(0, 500));

  // Parse table rows: <tr>...</tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  const records = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtml(cellMatch[1]).replace(/\s+/g, ' ').trim());
    }

    if (cells.length < 5) continue;

    const cpe = cells[0];
    // CPE: starts with PT and has 18+ chars
    if (!/^PT[0-9A-Z]{14,}$/.test(cpe)) continue;

    // columns based on observed structure:
    // CPE | Nome | NIPC | Rua | Porta | Andar/Frac | Cod.Postal | Desc.Postal | CAE | Inicio Contrato | Nivel Tensao | Tipo | Periodo | CMA
    const nome        = cells[1] || '';
    const nipc        = cells[2] || '';
    const rua         = cells[3] || '';
    const porta       = cells[4] || '';
    const andar       = cells[5] || '';
    const codPostal   = cells[6] || '';
    const descPostal  = cells[7] || '';
    // cells[8] = CAE (skip)
    const dataInicio  = parseDate(cells[9] || '');
    const nivelTensao = cells[10] || '';
    // cells[11] = Tipo (TETRA - skip)
    // cells[12] = Periodo (skip)
    const cma         = cells[13] || '';

    records.push({ cpe, nome, nipc, rua, porta, andar, codPostal, descPostal, dataInicio, nivelTensao, cma });
  }

  console.log(`\nExtracted ${records.length} records`);
  if (records.length > 0) {
    console.log('Sample 1:', JSON.stringify(records[0], null, 2));
    console.log('Sample 2:', JSON.stringify(records[1], null, 2));
    console.log('Sample last:', JSON.stringify(records[records.length - 1], null, 2));
  }

  const header = 'CPE,NIPC,Nome,Rua,Porta,Andar_Fracao,Cod_Postal,Desc_Postal,Inicio_Contrato,Nivel_Tensao,CMA_kWh\n';
  const rows = records.map(r =>
    [q(r.cpe), q(r.nipc), q(r.nome), q(r.rua), q(r.porta), q(r.andar),
     q(r.codPostal), q(r.descPostal), q(r.dataInicio), q(r.nivelTensao), q(r.cma)].join(',')
  );

  fs.writeFileSync(OUT_PATH, '\uFEFF' + header + rows.join('\n'), 'utf8');
  console.log(`\nCSV saved to: ${OUT_PATH}`);
}

main().catch(console.error);
