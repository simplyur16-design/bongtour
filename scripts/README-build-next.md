# Production build

- 로컬·CI·배포 모두 **`npm run build`**를 사용한다 (`scripts/build-next.js`가 Windows에서 간헐적인 `next build` 레이스 시 1회 재시도).
- 워크플로에서 `next build`를 직접 호출 중이면 동일 진입점으로 바꾼다.
- 클린 빌드: `npm run build:clean` → `clean:next` 후 위와 동일하게 `npm run build`를 탄다.
