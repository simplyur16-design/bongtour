/**
 * Object Storage(Ncloud S3) smoke: upload -> public URL -> remove.
 * Run: npx tsx scripts/test-supabase-storage.ts (.env.local에 NCLOUD_* 설정)
 */
import "./load-env-for-scripts"
import {
  getObjectStorageEnv,
  isObjectStorageConfigured,
  removeStorageObject,
  uploadStorageObject,
} from "../lib/object-storage"

async function main() {
  if (!isObjectStorageConfigured()) {
    console.error("[test-supabase-storage] NCLOUD_* Object Storage env required")
    process.exit(1)
  }
  const env = getObjectStorageEnv()
  const key = `smoke/${Date.now()}-bongtour.txt`
  const body = Buffer.from("bongtour-object-storage-smoke", "utf8")
  const r = await uploadStorageObject({
    objectKey: key,
    body,
    contentType: "text/plain; charset=utf-8",
  })
  console.log("[test-supabase-storage] bucket:", env.bucket)
  console.log("[test-supabase-storage] uploaded:", r.publicUrl)
  await removeStorageObject(key)
  console.log("[test-supabase-storage] removed:", key)
  console.log("[test-supabase-storage] ok")
}

main().catch((e) => {
  console.error("[test-supabase-storage] failed:", e)
  process.exit(1)
})
