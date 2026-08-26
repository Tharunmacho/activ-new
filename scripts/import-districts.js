const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Usage: node scripts/import-districts.js <path-to-xlsx-or-csv>
const input = process.argv[2];
if (!input) {
  console.error('Please provide the path to the Excel or CSV file');
  process.exit(2);
}

const workbook = xlsx.readFile(input);
// We'll try to read the first sheet
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

// Expecting columns: State, District
const mapping = {};
rows.forEach((r) => {
  const state = String(r.State || r.state || r.STATE || '').trim();
  const district = String(r.District || r.district || r.DISTRICT || '').trim();
  if (!state || !district) return;
  if (!mapping[state]) mapping[state] = [];
  if (!mapping[state].includes(district)) mapping[state].push(district);
});

const outPath = path.join(__dirname, '..', 'src', 'data', 'india-districts.ts');
const content = `export const INDIA_DISTRICTS: Record<string, string[]> = ${JSON.stringify(mapping, null, 2)};\n`;
fs.writeFileSync(outPath, content, 'utf8');
console.log('Wrote', outPath);
