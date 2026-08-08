/**
 * REGRESSION-FREEZE[simplyur-mobile-asset-magic]: JPEG-as-.png breaks Android AAPT — manifest
 * Scans apps/simplyur-mobile/assets for extension vs file-magic mismatches.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.join(process.cwd(), 'apps', 'simplyur-mobile', 'assets');

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function magic(buf: Buffer): 'jpeg' | 'png' | 'webp' | 'other' {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return 'other';
}

const bad: string[] = [];
for (const file of walk(ROOT)) {
  const ext = path.extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
  const kind = magic(fs.readFileSync(file).subarray(0, 16));
  const expectPng = ext === '.png';
  const expectJpeg = ext === '.jpg' || ext === '.jpeg';
  const expectWebp = ext === '.webp';
  if (expectPng && kind !== 'png') bad.push(`${file}: claimed png, magic=${kind}`);
  if (expectJpeg && kind !== 'jpeg') bad.push(`${file}: claimed jpeg, magic=${kind}`);
  if (expectWebp && kind !== 'webp') bad.push(`${file}: claimed webp, magic=${kind}`);
}

if (bad.length) {
  console.error('FAIL simplyur-mobile asset magic:\n' + bad.join('\n'));
  process.exit(1);
}
console.log('OK: simplyur-mobile asset magic matches extensions');
