-- AlterTable: 관리자 수동 지방 출발 태그 (PostgreSQL TEXT[])
ALTER TABLE "Product" ADD COLUMN "localDepartureTag" TEXT[] NOT NULL DEFAULT '{}';
