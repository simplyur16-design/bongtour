import fs from 'fs';

const raw = fs.readFileSync('data/bongtour_reviews.csv', 'utf-8');
const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
const headers = lines[0].split(',').map(h => h.trim());

console.log('총 행:', lines.length - 1);
console.log('컬럼 수:', headers.length);
console.log('컬럼:', headers.join(', '));

// 간단 파싱 (따옴표 고려)
function parseLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

// status 인덱스
const statusIdx = headers.indexOf('status');
if (statusIdx >= 0) {
  const counts = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const s = cols[statusIdx] || 'null';
    counts[s] = (counts[s] || 0) + 1;
  }
  console.log('\nstatus별 집계:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}
