# 교정 회귀 얼림 계약 (Regression Freeze)

**운영 규칙 (필수):** 버그·교정 PR은 **코드 수정만으로 끝내지 않는다.** 같은 PR에서 manifest·가드·마커까지 넣어 **얼린 뒤** merge 한다.

**목적:** 버그 수정·교정 후 **같은 증상이 다시 나오면 빌드/CI가 실패**하게 한다.  
**SSOT:** `scripts/regression-freeze-manifest.json` + `npm run verify:regression-freeze`

## 교정 PR 체크리스트 (3분)

- [ ] `scripts/regression-freeze-manifest.json`에 `id` 추가
- [ ] 수정 파일에 `REGRESSION-FREEZE[id]` 마커
- [ ] `npm run verify:regression-freeze:prebuild` 통과
- [ ] (선택) `docs/ops/*-contract.md`에 도메인 계약 한 줄

## 언제 manifest에 넣나 (필수)

아래에 해당하면 **같은 PR/커밋**에 manifest 항목을 추가한다.

- 운영자가 같은 교정을 **두 번 이상** 요청한 버그
- 등록·가격·제목·geo·imageKeyword 등 **데이터 오염**류
- “3일 전에 고쳤는데 또” 류 회귀

**의도적 스펙 변경**이 아니면 manifest·가드·테스트를 먼저 깨뜨리고 수정한다.

## 추가 절차 (4단계)

1. **가드 추가** — `npmScripts` / `staticGuards` / `vitestSuites` 중 하나
2. **코드 마커** — 수정한 파일 상단 또는 핵심 분기:
   ```ts
   // REGRESSION-FREEZE[card-price-exact-krw]: 만원 floor 절삭 금지 — manifest
   ```
3. **`npm run verify:regression-freeze`** 통과
4. **tier**
   - `prebuild` — `npm run build` 전 자동 (빠른 결정론만; `npm ci --omit=dev` 환경)
   - `ci` — PR/push GitHub Actions (vitest·DB·dotenv 등 devDep 필요 항목)
   - Docker/Railway prebuild에는 **vitest·DB 스크립트를 넣지 않는다** (devDependency 미설치)

## 실행

```bash
npm run verify:regression-freeze:list        # 얼린 항목 목록
npm run verify:regression-freeze:prebuild   # build·check 전 (로컬·배포)
npm run verify:regression-freeze:ci         # PR GitHub Actions
npm run verify:regression-freeze            # manifest 전부
npm run check                               # = prebuild 가드 + lint
```

**main에 merge 되기 전:** PR에서 `Regression Freeze` 워크플로가 통과해야 함.  
가드 없이 교정만 하고 manifest를 안 넣으면 **다음날 또 같은 버그**가 난다.

## 항목 ID 규칙

- kebab-case: `modetour-register-title`, `card-price-exact-krw`
- 마커 `REGRESSION-FREEZE[id]` 의 `id`는 manifest에 **반드시 존재**

## 관련 문서

- 모두투어 제목: `docs/ops/modetour-register-title-contract.md`
- 모두투어 lib: `docs/ops/modetour-lib-inventory.md`
