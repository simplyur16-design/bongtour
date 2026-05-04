-- R-5: 공급사 원본 상품명 보존. 신규 등록 플로우에서만 채움.
ALTER TABLE "Product" ADD COLUMN "originalTitle" TEXT;
