/**
 * REGRESSION-FREEZE[admin-pending-list-timeout]: 등록대기 목록 15s abort → 499 — manifest
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const errors: string[] = [];

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const page = read('app/admin/pending/page.tsx');
const route = read('app/api/admin/products/pending/route.ts');
const photos = read('lib/register-pending-photos-ready.ts');

if (!page.includes('REGRESSION-FREEZE[admin-pending-list-timeout]')) {
  errors.push('pending page missing freeze marker');
}
if (!/controller\.abort\(\),\s*60_000/.test(page) && !page.includes('60_000')) {
  errors.push('pending page must abort after 60_000ms, not 15s');
}
if (/controller\.abort\(\),\s*15000/.test(page)) {
  errors.push('pending page must not abort at 15000ms (server still running → 499)');
}

if (!route.includes('REGRESSION-FREEZE[admin-pending-list-timeout]')) {
  errors.push('pending route missing freeze marker');
}
if (!route.includes('withPrismaRetry')) {
  errors.push('pending route must use withPrismaRetry');
}
if (/rawMeta:\s*true/.test(route)) {
  errors.push('pending list must not select rawMeta');
}
if (!route.includes('isRegisterPrePhotoPendingQueueReady')) {
  errors.push('pending route must keep live verify.ok gate');
}

if (!photos.includes('REGRESSION-FREEZE[admin-pending-list-timeout]')) {
  errors.push('photos-ready missing list-timeout freeze marker');
}
if (photos.includes("from '@/lib/schedule-from-product'")) {
  errors.push('photosReady list path must not use getScheduleFromProduct (SEO caption work)');
}

if (errors.length) {
  console.error('FAIL admin-pending-list-timeout:\n' + errors.map((e) => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK: admin pending list no 15s abort, slim query, photosReady without SEO parse');
