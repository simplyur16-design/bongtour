import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Client } = pg;
const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const t = await c.query(
  "SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'"
);
const img = await c.query('SELECT COUNT(*)::int AS n FROM public.image_assets');
const tr = await c.query('SELECT COUNT(*)::int AS n FROM public.travel_reviews');
const chkImg = await c.query(
  "SELECT COUNT(*)::int AS n FROM pg_constraint c JOIN pg_class r ON c.conrelid = r.oid WHERE r.relname = 'image_assets' AND c.contype = 'c'"
);
const chkTr = await c.query(
  "SELECT COUNT(*)::int AS n FROM pg_constraint c JOIN pg_class r ON c.conrelid = r.oid WHERE r.relname = 'travel_reviews' AND c.contype = 'c'"
);
const idxImg = await c.query("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'image_assets'");
const pol = await c.query(
  "SELECT policyname FROM pg_policies WHERE tablename = 'travel_reviews' ORDER BY policyname"
);
const rlsTr = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'travel_reviews'");
const rlsImg = await c.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'image_assets'");

console.log(
  JSON.stringify(
    {
      publicTables: t.rows[0].n,
      image_assets_rows: img.rows[0].n,
      travel_reviews_rows: tr.rows[0].n,
      image_assets_check: chkImg.rows[0].n,
      travel_reviews_check: chkTr.rows[0].n,
      image_assets_indexes: idxImg.rows[0].n,
      travel_reviews_policies: pol.rows.map((r) => r.policyname),
      travel_reviews_rls: rlsTr.rows[0]?.relrowsecurity,
      image_assets_rls: rlsImg.rows[0]?.relrowsecurity,
    },
    null,
    2
  )
);
await c.end();
