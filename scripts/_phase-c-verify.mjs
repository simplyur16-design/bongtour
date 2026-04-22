import pg from 'pg';
import Database from 'better-sqlite3';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Client } = pg;
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL.replace(/\?.*$/, ''),
  ssl: { rejectUnauthorized: false },
});
await pgClient.connect();

const sqlite = new Database('prisma/dev.db', { readonly: true });

const tables = [
  'User',
  'Brand',
  'Destination',
  'Product',
  'OptionalTour',
  'ProductPrice',
  'Itinerary',
  'ItineraryDay',
  'ProductDeparture',
  'Booking',
  'Account',
  'Session',
  'AssetUsageLog',
  'PhotoPool',
  'CustomerInquiry',
  'MonthlyCurationContent',
  'MonthlyCurationItem',
  'EditorialContent',
  'HanatourMonthlyBenefit',
  'RegisterAdminInputSnapshot',
  'RegisterAdminAnalysis',
  'VerificationToken',
  'DestinationGalleryCache',
  'DestinationImageSet',
  'AgentScrapeReport',
  'ScraperQueue',
];

console.log('테이블명'.padEnd(35) + 'SQLite'.padStart(10) + 'PostgreSQL'.padStart(12) + '  일치');
console.log('-'.repeat(65));

for (const t of tables) {
  let sqliteCount = 0;
  let pgCount = 0;
  try {
    sqliteCount = sqlite.prepare(`SELECT COUNT(*) as c FROM "${t}"`).get().c;
  } catch {
    sqliteCount = -1;
  }
  try {
    pgCount = parseInt((await pgClient.query(`SELECT COUNT(*) as c FROM "${t}"`)).rows[0].c, 10);
  } catch {
    pgCount = -1;
  }

  const match = sqliteCount === pgCount ? '✅' : '❌';
  console.log(
    t.padEnd(35) + String(sqliteCount).padStart(10) + String(pgCount).padStart(12) + '  ' + match
  );
}

sqlite.close();
await pgClient.end();
