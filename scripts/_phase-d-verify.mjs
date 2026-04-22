import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Client } = pg;
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL.replace(/\?.*$/, ''),
  ssl: { rejectUnauthorized: false },
});
await pgClient.connect();

console.log('='.repeat(60));
console.log('Phase D: 데이터 검증');
console.log('='.repeat(60));

// 1. Product 샘플
console.log('\n[1] Product 샘플 3건');
const products = await pgClient.query(`
  SELECT id, title, "bgImageUrl", "originSource"
  FROM "Product"
  LIMIT 3
`);
products.rows.forEach((p) => {
  console.log(`  - ${p.id}`);
  console.log(`    title: ${p.title?.substring(0, 50)}`);
  console.log(`    source: ${p.originSource}`);
  console.log(
    `    image: ${p.bgImageUrl?.substring(0, 80)}${p.bgImageUrl?.length > 80 ? '...' : ''}`
  );
});

// 2. FK 무결성: Product ↔ ProductPrice
console.log('\n[2] FK 무결성: ProductPrice → Product');
const fkCheck = await pgClient.query(`
  SELECT COUNT(*) as orphan_count
  FROM "ProductPrice" pp
  LEFT JOIN "Product" p ON p.id = pp."productId"
  WHERE p.id IS NULL
`);
console.log(`  고아 ProductPrice (Product 없는): ${fkCheck.rows[0].orphan_count}`);

// 3. FK 무결성: ProductDeparture → Product
const fkCheck2 = await pgClient.query(`
  SELECT COUNT(*) as orphan_count
  FROM "ProductDeparture" pd
  LEFT JOIN "Product" p ON p.id = pd."productId"
  WHERE p.id IS NULL
`);
console.log(`  고아 ProductDeparture: ${fkCheck2.rows[0].orphan_count}`);

// 4. FK: Booking → Product (스키마에 Booking.userId 없음)
const fkCheck3 = await pgClient.query(`
  SELECT COUNT(*) as orphan_count
  FROM "Booking" b
  LEFT JOIN "Product" p ON p.id = b."productId"
  WHERE p.id IS NULL
`);
console.log(`  고아 Booking (Product 없는): ${fkCheck3.rows[0].orphan_count}`);

// 5. 이미지 URL 샘플 (Supabase Storage URL만 추출)
console.log('\n[3] Supabase Storage URL 샘플');
const supabaseUrls = await pgClient.query(`
  SELECT id, "bgImageUrl"
  FROM "Product"
  WHERE "bgImageUrl" LIKE '%supabase.co/storage%'
  LIMIT 3
`);
supabaseUrls.rows.forEach((r) => {
  console.log(`  ${r.bgImageUrl}`);
});

// 6. Ncloud URL 샘플
console.log('\n[4] Ncloud URL 샘플 (PhotoPool)');
const ncloudUrls = await pgClient.query(`
  SELECT id, "cityName", "filePath"
  FROM "PhotoPool"
  WHERE "filePath" LIKE '%ncloudstorage%'
  LIMIT 3
`);
ncloudUrls.rows.forEach((r) => {
  console.log(`  ${r.cityName}: ${r.filePath?.substring(0, 100)}`);
});

// 7. Booking 샘플 (PII 마스킹)
console.log('\n[5] Booking 샘플 (이름 마스킹)');
const bookings = await pgClient.query(`
  SELECT id, "productId", "createdAt", "totalLocalAmount", "localCurrency"
  FROM "Booking"
  LIMIT 3
`);
bookings.rows.forEach((b) => {
  console.log(
    `  Booking ${b.id}: product=${b.productId?.substring(0, 20)}, ${b.totalLocalAmount} ${b.localCurrency}`
  );
});

// 8. 전체 행 수 요약
console.log('\n[6] 최종 전체 행 수');
const allCounts = await pgClient.query(`
  SELECT 
    (SELECT COUNT(*) FROM "User") as users,
    (SELECT COUNT(*) FROM "Product") as products,
    (SELECT COUNT(*) FROM "ProductDeparture") as departures,
    (SELECT COUNT(*) FROM "ProductPrice") as prices,
    (SELECT COUNT(*) FROM "Booking") as bookings,
    (SELECT COUNT(*) FROM travel_reviews) as reviews,
    (SELECT COUNT(*) FROM image_assets) as images
`);
console.log('  ', allCounts.rows[0]);

// 9. 랜덤 travel_reviews 샘플 (카드 UI 준비)
console.log('\n[7] travel_reviews 랜덤 샘플');
const reviewsSample = await pgClient.query(`
  SELECT id, title, destination_country, destination_city, rating_label
  FROM travel_reviews
  WHERE status = 'published'
  ORDER BY RANDOM()
  LIMIT 3
`);
reviewsSample.rows.forEach((r) => {
  console.log(
    `  ${r.rating_label}★ ${r.destination_country}/${r.destination_city}: ${r.title?.substring(0, 40)}`
  );
});

await pgClient.end();

console.log('\n✅ Phase D 검증 완료');
