import Database from 'better-sqlite3';
const db = new Database('prisma/dev.db', { readonly: true });
const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(rows.map((r) => r.name).join('\n'));
db.close();
