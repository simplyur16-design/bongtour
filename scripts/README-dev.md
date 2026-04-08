# 로컬 개발 스크립트

## 권장 진입점: `npm run dev:clean`

`.next` 및 `node_modules/.cache` 를 삭제한 뒤 **`next dev -p 3000`** 으로 띄웁니다. **로컬 개발 기준 origin은 `http://localhost:3000` 하나만** 사용한다(다른 포트로 자동 이동하지 않음 — 3000이 점유되어 있으면 기동 실패). **stylesheet 500·`/_next/static` 404·vendor-chunks ENOENT·`Cannot find module './xxxx.js'`** 등이 보일 때의 **기본 복구**이다. 상세·증상 분류는 `docs/DEV-NEXT-CACHE.md` 를 본다.

## 일상

- `npm run dev` — 이미 `.next`가 정상일 때만 빠른 재시작(항상 **3000**).

## 이상 징후 시 (고정 순서)

1. 실행 중인 `node` / `next` dev·start 를 **모두** 종료한다(3000 포트 점유 해제).
2. **`npm run dev:clean`** 을 실행한다.
3. 브라우저는 **`http://localhost:3000`** 으로만 접속한다(`.env.local` 의 `NEXTAUTH_URL`·`NEXT_PUBLIC_*` 도 동일 origin).

**코드 수정 전에 먼저** 위 순서로 dev 산출물을 정상화한다 (`docs/DEV-NEXT-CACHE.md` 원칙).
