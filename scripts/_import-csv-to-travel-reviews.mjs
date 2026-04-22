import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Client } = pg;
const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query("SET statement_timeout = '120000'");

// CSV 읽기
const raw = fs.readFileSync('data/bongtour_reviews.csv', 'utf-8');
const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
const headers = lines[0].split(',').map(h => h.trim());
const dataLines = lines.slice(1);

console.log('CSV 행 수:', dataLines.length);
console.log('컬럼 수:', headers.length);

// CSV 파서
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

function isValidUuid(s) {
  if (!s || typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

/** CSV의 임의 user_id 등 → 결정적 UUID (SHA 기반 v4 형식) */
function stableUuid(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** DB CHECK(travel_reviews_review_type_check) + 앱 타입에 맞춤 */
const REVIEW_TYPE_MAP = {
  solo: 'solo',
  group_small: 'group_small',
  group_corporate: 'group_corporate',
  group_friends: 'group_friends',
  family: 'family',
  parents: 'parents',
  hiking: 'hiking',
  executive_group: 'group_corporate',
  hiking_group: 'hiking',
  couple_group: 'group_friends',
  business_group: 'group_corporate',
  alumni_group: 'group_friends',
  senior_group: 'parents',
  association: 'group_corporate',
  small_group: 'group_small',
};

function mapReviewType(raw) {
  const k = (raw || '').trim();
  return REVIEW_TYPE_MAP[k] || 'group_small';
}

// 현재 Supabase 상태
const before = await client.query('SELECT COUNT(*) as cnt FROM travel_reviews');
console.log('현재 Supabase 행 수:', before.rows[0].cnt);

// RLS 일시 비활성
console.log('\n1. RLS 비활성화');
await client.query('ALTER TABLE public.travel_reviews DISABLE ROW LEVEL SECURITY');

// 기존 행 삭제
console.log('2. TRUNCATE 기존 데이터');
await client.query('TRUNCATE TABLE public.travel_reviews');

// INSERT
console.log('3. CSV 50행 INSERT 시작');
let inserted = 0;
let failed = 0;
const errors = [];

// 컬럼 타입별 변환 (요청 스크립트 + DB 제약 반영: status, uuid, review_type, tags text[])
function convertValue(colName, rawValue, rowByHeader) {
  if (rawValue === '' || rawValue === 'NULL') return null;

  if (colName === 'id' || colName === 'user_id') {
    const s = String(rawValue).trim();
    if (isValidUuid(s)) return s;
    const seed = colName === 'id' ? `id:${s}` : `user:${rowByHeader.get('id') || s}:${s}`;
    return stableUuid(seed);
  }

  if (colName === 'is_featured') {
    return rawValue === 'True' || rawValue === 'true';
  }

  if (colName === 'display_order') {
    return parseInt(rawValue, 10);
  }

  if (colName === 'tags') {
    try {
      const j = JSON.parse(rawValue);
      if (Array.isArray(j)) return j.map((x) => String(x));
      return null;
    } catch {
      return null;
    }
  }

  if (colName === 'review_type') {
    return mapReviewType(rawValue);
  }

  if (colName === 'status') {
    const t = String(rawValue).trim();
    if (t === 'approved') return 'published';
    return t;
  }

  if (colName === 'approved_by') {
    const s = String(rawValue).trim();
    if (!s || !isValidUuid(s)) return null;
    return s;
  }

  if (['approved_at', 'published_at', 'created_at', 'updated_at'].includes(colName)) {
    if (!rawValue) return null;
    const s = String(rawValue).trim();
    if (s.includes('T') || s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
    return s.replace(' ', 'T') + (s.includes('+') ? '' : 'Z');
  }

  if (['travel_month', 'displayed_date'].includes(colName)) {
    return rawValue;
  }

  return rawValue;
}

for (let idx = 0; idx < dataLines.length; idx++) {
  const values = parseLine(dataLines[idx]);

  if (values.length !== headers.length) {
    errors.push(`행 ${idx+1}: 컬럼 수 ${values.length} != 헤더 ${headers.length}`);
    failed++;
    continue;
  }

  const rowByHeader = new Map(headers.map((h, i) => [h, values[i]]));
  try {
    const converted = values.map((v, i) => convertValue(headers[i], v, rowByHeader));

    const placeholders = headers.map((_, i) => `$${i+1}`).join(', ');
    const columnList = headers.map(h => `"${h}"`).join(', ');

    await client.query(
      `INSERT INTO public.travel_reviews (${columnList}) VALUES (${placeholders})`,
      converted
    );
    inserted++;
  } catch (e) {
    errors.push(`행 ${idx+1}: ${e.message.substring(0, 150)}`);
    failed++;
  }

  if ((idx + 1) % 10 === 0) {
    console.log(`  ${idx+1}/${dataLines.length}`);
  }
}

console.log(`\n결과: 성공 ${inserted}, 실패 ${failed}`);

if (errors.length > 0) {
  console.log('\n에러 목록:');
  errors.forEach(e => console.log(' ', e));
}

// RLS 재활성
console.log('\n4. RLS 재활성화');
await client.query('ALTER TABLE public.travel_reviews ENABLE ROW LEVEL SECURITY');

// 최종 확인
const after = await client.query('SELECT COUNT(*) as cnt FROM travel_reviews');
const approvedCount = await client.query(`SELECT COUNT(*) as cnt FROM travel_reviews WHERE status='published'`);
console.log('\n최종 행 수:', after.rows[0].cnt);
console.log('published 행 수:', approvedCount.rows[0].cnt);

await client.end();

if (failed > 0) {
  console.error('\n⚠️ 실패 있음. 위 에러 확인.');
  process.exit(1);
}
console.log('\n✅ 이전 완료');
