# Prisma ↔ Supabase Postgres (풀러) 연결 메모

## 확인 일자

2026-04-22

## 결과 요약

`DATABASE_URL`에 **`sslmode=require`** 가 포함된 Supabase Session pooler URL  
(`postgresql://postgres.<project-ref>:...@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require`) 로  
`npx prisma db pull --schema=prisma/schema.test.prisma` (임시 스키마) **성공**함.

이 환경에서는 **`sslmode=no-verify` 로 바꿀 필요 없음** (실패 후 재시도 단계는 생략).

## 실행 시 환경 변수

Prisma CLI는 기본으로 루트 `.env` 만 자동 로드한다. **`.env.local` 의 `DATABASE_URL`만** 쓰려면 예:

```bash
node --env-file=.env.local ./node_modules/prisma/build/index.js db pull --schema=prisma/schema.test.prisma
```

## 스키마 테스트 시 유의

Prisma 5.x 에서 **`model _PrismaTest`** 처럼 모델명이 **밑줄로 시작**하면 스키마 검증(P1012)에서 거절될 수 있음. 연결 검증용은 `PrismaTest` 등 일반 식별자 사용.

## Introspection 경고 (정상 범주)

- Row Level Security 사용 테이블에 대한 경고
- Check constraint / DB comment 미지원 안내

운영 스키마 동기화 시 Prisma 문서 링크를 참고하면 됨.
