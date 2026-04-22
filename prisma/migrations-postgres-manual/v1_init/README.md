# Phase B 수동 마이그레이션 SQL

실행 순서대로 번호 매김. 각 SQL을 Supabase SQL Editor에서
순서대로 실행하거나, 스크립트로 일괄 실행.

## 파일 목록

1. 01_drop_existing.sql       - 기존 image_assets, travel_reviews 제거
2. 02_create_all_tables.sql   - Prisma schema 기반 28개 테이블 생성
3. 03_image_assets_checks.sql - CHECK 10개 재생성
4. 04_image_assets_indexes.sql - INDEX 10개 재생성 (pkey 제외)
5. 05_image_assets_rls.sql     - RLS 활성화
6. 06_travel_reviews_checks.sql - CHECK 7개 재생성
7. 07_travel_reviews_indexes.sql - INDEX 재생성
8. 08_travel_reviews_rls.sql   - RLS + 정책 4개 재생성
9. 09_travel_reviews_data_restore.sql - 백업 SQL 기준 travel_reviews 데이터 재입력 (행 수는 백업 파일 기준)

## 실행 전 확인

- [ ] 백업 파일 존재: backups/travel_reviews/, backups/image_assets/
- [ ] SQLite 백업: C:\Users\USER\Desktop\BONGTOUR-DB-BACKUP\backup-prod-20260421-174434.db
- [ ] .env.local의 DATABASE_URL Supabase 가리킴
- [ ] Railway 현재 DATABASE_URL은 file:./prisma/dev.db (유지, 추후 교체)

## 롤백 시나리오

만약 어느 단계에서 실패:

1. 01번 실행 후 실패: 영구 데이터 손실 없음 (백업 있음)
2. 02번 실행 후 실패: DROP TABLE로 원복 가능
3. 03-08번 실행 후 실패: 해당 SQL 역방향으로 실행 가능
4. 09번 실행 후 실패: TRUNCATE 후 다시 실행
