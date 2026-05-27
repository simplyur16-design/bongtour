-- AlterTable: 관리자 수동 스포츠 테마 태그 (PostgreSQL TEXT[])
ALTER TABLE "Product" ADD COLUMN "sportsThemeTag" TEXT[] NOT NULL DEFAULT '{}';
