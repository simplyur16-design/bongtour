-- PhotoPool: Pexels 작가·출처 페이지·외부 photo id
ALTER TABLE "PhotoPool" ADD COLUMN "photographer" TEXT;
ALTER TABLE "PhotoPool" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "PhotoPool" ADD COLUMN "sourcePhotoId" TEXT;
