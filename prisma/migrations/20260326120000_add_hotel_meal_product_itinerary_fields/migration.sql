-- Nullable SSOT columns: Product hotel summary + ItineraryDay per-day hotel/meals.
-- 기존 DB에 `prisma db push`로 이미 컬럼이 있으면 이 마이그레이션 적용이 실패할 수 있음.
-- 그 경우: npx prisma migrate resolve --applied 20260326120000_add_hotel_meal_product_itinerary_fields

ALTER TABLE "Product" ADD COLUMN "hotelSummaryText" TEXT;

ALTER TABLE "ItineraryDay" ADD COLUMN "hotelText" TEXT;
ALTER TABLE "ItineraryDay" ADD COLUMN "breakfastText" TEXT;
ALTER TABLE "ItineraryDay" ADD COLUMN "lunchText" TEXT;
ALTER TABLE "ItineraryDay" ADD COLUMN "dinnerText" TEXT;
ALTER TABLE "ItineraryDay" ADD COLUMN "mealSummaryText" TEXT;
