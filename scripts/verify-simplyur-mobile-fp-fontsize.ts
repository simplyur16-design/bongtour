/**
 * REGRESSION-FREEZE[simplyur-my-trip-fontsize]: fp() is fontFamily, never fontSize — manifest
 * Scans apps/simplyur-mobile for fp() used as a pixel size (invalid RN style).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(process.cwd(), 'apps', 'simplyur-mobile');
const SKIP = new Set(['node_modules', '.expo', 'android', 'ios', 'dist']);
const BAD = /fontSize\s*:\s*fp\s*\(/;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const hits: string[] = [];
for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (BAD.test(line)) hits.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length) {
  console.error('FAIL simplyur-mobile fp-as-fontsize:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('OK: simplyur-mobile does not use fp() as fontSize');
