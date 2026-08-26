// Extracts raw text from Aveiro PDF using pdfjs-dist (text-based PDF)
import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const PDF_PATH = 'C:/Users/Utilizador/Downloads/3700 3800 3900 Aveiro.pdf';
const OUT_PATH = 'C:/Users/Utilizador/Downloads/aveiro-raw.txt';

async function extractPageText(page) {
  const content = await page.getTextContent();
  // Each item has str and transform (position). Group by y to reconstruct lines.
  const items = content.items.filter(i => i.str.trim());

  // Sort by y descending (top of page first), then x ascending
  items.sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  // Group items into lines (same y ± 2pt)
  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of items) {
    const y = item.transform[5];
    if (currentY === null || Math.abs(y - currentY) <= 2) {
      currentLine.push(item);
      currentY = y;
    } else {
      if (currentLine.length) lines.push(currentLine.map(i => i.str).join('\t'));
      currentLine = [item];
      currentY = y;
    }
  }
  if (currentLine.length) lines.push(currentLine.map(i => i.str).join('\t'));
  return lines.join('\n');
}

async function main() {
  const buffer = fs.readFileSync(PDF_PATH);
  const data   = new Uint8Array(buffer);
  const doc    = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true, disableWorker: true }).promise;

  console.log(`Pages: ${doc.numPages}`);
  const allLines = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const text = await extractPageText(page);
    allLines.push(`\n=== PAGE ${p} ===\n` + text);
  }

  const out = allLines.join('\n');
  fs.writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`Written ${out.length} chars → ${OUT_PATH}`);
  console.log('\n--- Page 1 sample ---\n');
  console.log(allLines[0].slice(0, 2000));
}

main().catch(console.error);
