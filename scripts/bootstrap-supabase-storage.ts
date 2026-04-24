/**
 * Supabase Storage: create public bucket + upload path placeholder (.keep) files.
 * Run: npm run bootstrap:supabase-storage
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (optional SUPABASE_IMAGE_BUCKET)
 */
import "./load-env-for-scripts"
import { getSupabaseImageStorageBucket, isSupabaseStorageAdminConfigured } from "../lib/object-storage"
import { getSupabaseAdmin } from "../lib/supabase-admin"

const FOLDER_MARKERS = [
  "photo-pool/.keep",
  "monthly-curation/.keep",
  "editorial-content/.keep",
  "home-hub/candidates/.keep",
  "gemini/generated/.keep",
] as const

async function ensurePublicBucket(bucket: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw new Error(`listBuckets failed: ${listErr.message}`)
  const exists = buckets?.some((b) => b.name === bucket)
  if (exists) {
    console.log(`[bootstrap-supabase-storage] bucket already exists: ${bucket}`)
    return
  }
  const { error } = await supabase.storage.createBucket(bucket, { public: true })
  if (error) throw new Error(`createBucket failed: ${error.message}`)
  console.log(`[bootstrap-supabase-storage] created public bucket: ${bucket}`)
}

async function seedFolderMarkers(bucket: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const body = Buffer.from("\n", "utf8")
  for (const key of FOLDER_MARKERS) {
    const { error } = await supabase.storage.from(bucket).upload(key, body, {
      contentType: "application/octet-stream",
      upsert: true,
    })
    if (error) throw new Error(`upload ${key}: ${error.message}`)
    console.log(`[bootstrap-supabase-storage] seeded: ${key}`)
  }
}

async function main() {
  if (!isSupabaseStorageAdminConfigured()) {
    console.error("[bootstrap-supabase-storage] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.")
    process.exit(1)
  }
  const bucket = getSupabaseImageStorageBucket()
  await ensurePublicBucket(bucket)
  await seedFolderMarkers(bucket)
  console.log("[bootstrap-supabase-storage] ok")
}

main().catch((e) => {
  console.error("[bootstrap-supabase-storage] failed:", e)
  process.exit(1)
})
