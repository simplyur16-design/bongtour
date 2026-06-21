-- AlterTable: 목록·히어로 출발 공항 라벨 (인천·김포=서울권은 null)
ALTER TABLE "Product" ADD COLUMN "departureAirportLabel" TEXT;
