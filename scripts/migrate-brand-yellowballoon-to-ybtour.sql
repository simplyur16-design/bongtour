-- 노랑풍선: DB 브랜드 키 yellowballoon → ybtour (SQLite / Prisma Brand 테이블)
-- 적용 전 백업 권장. 한 번만 실행.
UPDATE "Brand" SET "brandKey" = 'ybtour' WHERE "brandKey" = 'yellowballoon';
