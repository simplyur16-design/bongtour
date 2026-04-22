import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Client } = pg;
const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query('SELECT COUNT(*) as cnt FROM travel_reviews');
console.log('현재 Supabase travel_reviews 행 수:', r.rows[0].cnt);

// 일부 샘플 (처음 5개와 마지막 5개)
const first5 = await client.query('SELECT id, status, created_at FROM travel_reviews ORDER BY created_at LIMIT 5');
console.log('\n처음 5개:');
first5.rows.forEach(r => console.log(' ', r.id, r.status, r.created_at));

const last5 = await client.query('SELECT id, status, created_at FROM travel_reviews ORDER BY created_at DESC LIMIT 5');
console.log('\n마지막 5개:');
last5.rows.forEach(r => console.log(' ', r.id, r.status, r.created_at));

await client.end();
