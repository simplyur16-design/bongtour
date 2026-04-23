-- PageOgImage (PostgreSQL / Supabase). 스키마: prisma/schema.prisma 의 PageOgImage.
-- migrate dev 가 로컬에서 실패하는 경우( provider / lock 불일치 등 ) 수동 실행용.

CREATE TABLE IF NOT EXISTS "page_og_images" (
    "id" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "storage_path" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "page_og_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "page_og_images_page_key_key" ON "page_og_images" ("page_key");
