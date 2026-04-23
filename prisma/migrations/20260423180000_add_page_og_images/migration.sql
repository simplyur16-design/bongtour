-- PageOgImage: 페이지별 OG 이미지 (SQLite 호환)
CREATE TABLE "page_og_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page_key" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "storage_path" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "uploaded_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "page_og_images_page_key_key" ON "page_og_images"("page_key");
