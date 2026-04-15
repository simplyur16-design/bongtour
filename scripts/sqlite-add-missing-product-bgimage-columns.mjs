/**
 * SQLite 전용: Product 테이블에 Prisma schema와 동일한 bgImage* 컬럼이 없으면 ADD만 수행.
 * - 기존 행/다른 컬럼은 건드리지 않음
 * - 이미 있는 컬럼은 sqlite3 오류(duplicate column)를 무시하고 스킵
 *
 * 사용:
 *   DATABASE_URL=file:./path/to.db node scripts/sqlite-add-missing-product-bgimage-columns.mjs
 *
 * 전제: `sqlite3` CLI가 PATH에 있음 (Ubuntu: apt install sqlite3)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** @type {readonly { name: string; ddl: string }[]} */
const COLUMNS = [
  ["bgImageUrl", `TEXT`],
  ["bgImageSource", `TEXT`],
  ["bgImageSourceType", `TEXT`],
  ["bgImagePhotographer", `TEXT`],
  ["bgImageSourceUrl", `TEXT`],
  ["bgImageExternalId", `TEXT`],
  ["bgImageStoragePath", `TEXT`],
  ["bgImageStorageBucket", `TEXT`],
  ["bgImageRehostSearchLabel", `TEXT`],
  ["bgImagePlaceName", `TEXT`],
  ["bgImageCityName", `TEXT`],
  ["bgImageWidth", `INTEGER`],
  ["bgImageHeight", `INTEGER`],
  ["bgImageRehostedAt", `DATETIME`],
  ["bgImageIsGenerated", `BOOLEAN NOT NULL DEFAULT 0`],
].map(([name, type]) => ({
  name,
  ddl: `ALTER TABLE "Product" ADD COLUMN "${name}" ${type};`,
}));

function resolveSqliteFile(databaseUrl) {
  if (!databaseUrl || typeof databaseUrl !== "string") return null;
  const noQuery = databaseUrl.split("?")[0].trim();
  if (!/^file:/i.test(noQuery)) return null;
  let rest = noQuery.replace(/^file:/i, "");
  // file:./relative  or  file:relative
  if (rest.startsWith("./") || (!rest.startsWith("/") && !/^[a-zA-Z]:/.test(rest))) {
    return path.resolve(process.cwd(), rest);
  }
  // file:/absolute/unix  or  file:C:/windows
  if (rest.startsWith("//")) rest = rest.slice(1);
  return path.normalize(rest);
}

function listExistingColumns(dbPath) {
  const out = execFileSync("sqlite3", [dbPath, `PRAGMA table_info('Product');`], {
    encoding: "utf8",
  });
  const names = new Set();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("|");
    if (parts.length >= 2) names.add(parts[1]);
  }
  return names;
}

function tryAlter(dbPath, sql) {
  try {
    execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch (e) {
    const msg = (e && (e.stderr?.toString?.() || e.message)) || String(e);
    if (/duplicate column name/i.test(msg)) return false;
    throw e;
  }
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const dbPath = resolveSqliteFile(databaseUrl || "");
  if (!dbPath) {
    console.error(
      "DATABASE_URL이 file: 로 시작하는 SQLite URL이 아닙니다. 이 스크립트는 SQLite 전용입니다.",
    );
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error("DB 파일이 없습니다:", dbPath);
    process.exit(1);
  }

  try {
    execFileSync("sqlite3", [dbPath, "SELECT 1;"], { stdio: "ignore" });
  } catch {
    console.error("`sqlite3` CLI를 찾을 수 없습니다. (예: apt install sqlite3)");
    process.exit(1);
  }

  const existing = listExistingColumns(dbPath);
  let added = 0;
  let skipped = 0;

  for (const { name, ddl } of COLUMNS) {
    if (existing.has(name)) {
      skipped++;
      continue;
    }
    if (tryAlter(dbPath, ddl)) {
      existing.add(name);
      console.log("ADD:", name);
      added++;
    } else {
      existing.add(name);
      console.log("SKIP (already exists):", name);
      skipped++;
    }
  }

  console.log(`Done. added=${added} skipped_or_existing=${skipped} db=${dbPath}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
