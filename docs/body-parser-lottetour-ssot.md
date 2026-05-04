# 롯데관광(lottetour) 본문 섹션 분리·추출 SSOT

## 목적

관리자 등록 시 **붙여넣기 본문**을 나누어 `DetailBodyParseSnapshot`을 만든다.  
슬라이스·클립 계약은 [body-parser-ybtour-ssot.md](./body-parser-ybtour-ssot.md)와 동일하게 유지하고, 롯데관광 URL·헤더·앵커만 이 문서와 `detail-body-parser-utils-lottetour`에서 분기한다.

**우선순위:** 본 문서 > 공통 정책. 공급사 키는 canonical **`lottetour`**.

**일정 표현 SSOT:** `docs/register_schedule_expression_ssot.md` — 본 문서는 **본문 섹션 분리**만 다룬다.

### 본문 파서 비책임 축 (입력 파서 SSOT)

- **항공·선택관광·쇼핑**의 **구조화**는 `register-input-parse-lottetour` 및 `register-parse-lottetour`의 정형 입력란만이 SSOT다.
- `detail-body-parser-lottetour`는 슬라이스·`raw.*`·`lottetourBodyExtract`(godId·evtCd·menuNo·미팅·좌석승급 줄)만 제공한다.

---

## 이 문서를 따르는 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/detail-body-parser-lottetour.ts` | 스냅샷 조립·포함/불포함·호텔·`lottetourBodyExtract` |
| `lib/detail-body-parser-utils-lottetour.ts` | 정규화·앵커(`LOTTETOUR_SECTION_ANCHOR_ALIASES`)·슬라이스 |
| `lib/register-parse-lottetour.ts` | 본문 파서 호출·입력란 기준 항공/옵션/쇼핑 구조화 |
| `lib/register-input-parse-lottetour.ts` | 항공·옵션·쇼핑 입력 해석 SSOT |
| `lib/register-input-unstructured-body-lottetour.ts` | 비정형 옵션·쇼핑 헤더 별칭 |
| `lib/hotel-parser-lottetour.ts` | 호텔 섹션 |
| `lib/register-lottetour-basic.ts` | 포함/불포함 |
| `lib/review-policy-lottetour.ts` | 검수 |

공통 패턴·하한 길이·클립 규칙은 [body-parser-ybtour-ssot.md](./body-parser-ybtour-ssot.md)와 동일하게 유지한다(항공 시드 72자, `clip*` 약관 경계 등).

---

## 롯데관광 전용 앵커·추출

- **브랜드·경로:** `롯데관광`, `롯데투어`, `옐로우`; 선택관광 앵커에 `롯데 선택관광`.
- **URL 메타:** 붙여넣기에 포함되면 `godId`, `evtCd`, `/evtDetail/{no1}/{no2}/{no3}/{no4}` 또는 `/evtList/.../.../.../...?godId=`에서 `categoryMenuNo` 후보를 채운다(`detail-body-parser-lottetour`의 `lottetourBodyExtract`).
- **미팅·승급:** `미팅 장소`, `집결`; `좌석 승급`·`승급 옵션` 등 짧은 줄은 `seatUpgradeLines`로 보존.

---

## 쇼핑 표 스캔 경계

`structured-tour-signals-lottetour`의 쇼핑 행 파싱은 선택관광·포함불포함 등 기존 종료 앵커에 더해, **좌석 승급/승급 옵션** 블록 직전에서 멈춘다(쇼핑 표와 혼선 방지).
