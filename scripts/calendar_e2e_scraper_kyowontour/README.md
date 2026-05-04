# 교원이지(kyowontour) 출발일 캘린더 E2E 스크래퍼

`lib/kyowontour/departures.ts`의 HTTP 수집이 **빈 `dayAirList`**이거나 **E2E 힌트 오류**일 때 Node가 subprocess로 호출하는 **Selenium + requests** 보조 경로입니다.

## 설치

저장소 루트에서:

```bash
pip install -r scripts/calendar_e2e_scraper_kyowontour/requirements.txt
```

Chrome 브라우저가 필요합니다(Selenium 4가 ChromeDriver를 자동 매칭).

## 실행 (stdout = JSON 한 덩어리)

반드시 **저장소 루트**를 `cwd`로 하고 **모듈**로 실행합니다.

```bash
cd /path/to/BONGTOUR
python -m scripts.calendar_e2e_scraper_kyowontour.calendar_price_scraper --tour-code CTP221260528TW01
```

옵션:

- `--master-code CTP221` — 이미 `masterCode`를 알면 Selenium 상세 로드를 생략하고 API만 호출합니다(쿠키 없이 동작하지 않을 수 있음).
- `--months 12` — 월 순회 상한(환경변수 `KYOWONTOUR_E2E_MONTH_LIMIT`와 함께 캡).
- `--from 2026-05-01` / `--to 2027-05-01` — 출발일 필터(`KYOWONTOUR_DATE_FROM` / `KYOWONTOUR_DATE_TO`와 동일).

진행 로그는 **stderr**에만 출력됩니다. **stdout**은 Node 파싱용 JSON 한 줄입니다.

## 환경변수

| 변수 | 기본 | 설명 |
|------|------|------|
| `KYOWONTOUR_E2E_MAX_CLICKS` | 32 | 월 POST 반복 상한 |
| `KYOWONTOUR_E2E_MONTH_LIMIT` | 12 | 최대 월 수 |
| `KYOWONTOUR_E2E_HEADLESS` | true | Chrome headless |
| `KYOWONTOUR_E2E_TIMEOUT_S` | 60 | 전체 스크립트 타임아웃(초) |
| `KYOWONTOUR_E2E_PAGE_LOAD_TIMEOUT_S` | 30 | `driver.get` 타임아웃 |
| `KYOWONTOUR_E2E_AJAX_WAIT_S` | 10 | 캘린더 DOM 대기 / requests 타임아웃 기준 |
| `KYOWONTOUR_DATE_FROM` / `KYOWONTOUR_DATE_TO` | — | `YYYY-MM-DD` 필터 |
| `KYOWONTOUR_USER_AGENT` | — | 커스텀 UA |
| `KYOWONTOUR_API_BASE_URL` | `https://www.kyowontour.com` | API 베이스 |
| `KYOWONTOUR_E2E_DETAIL_URL` | — | 상세 URL 단일 템플릿(예: `...?tourCd={tourCode}`) |

## 디버깅

1. **headless 끄기**: `KYOWONTOUR_E2E_HEADLESS=false` 로 브라우저를 띄워 DOM·네트워크를 확인합니다.
2. **stderr**: `[kyowontour-e2e]` 접두 로그로 단계(상세 URL, `masterCode`, 월별 POST 상태)를 추적합니다.
3. **`masterCode`**: 상세 HTML의 `input#masterCode` / `#masterCode` / 정규식 폴백으로 추출합니다. 사이트 변경 시 `_extract_master_code` 셀렉터를 조정합니다.
4. **데이터 경로**: `masterCode` 확보 후 브라우저 쿠키를 `requests.Session`에 넣고 `/goods/differentDepartDate`에 월별 POST합니다(캘린더 클릭 대신 API로 안정화).

## Node 연동

`collectKyowontourCalendarRange(masterCode, { tourCodeForE2EFallback: '<tourCode>', ... })`  
HTTP로 행이 0건이거나 첫 월에서 E2E 힌트 오류가 나면 위 모듈을 **한 번** 실행합니다.  
Python 실행 파일은 `KYOWONTOUR_PYTHON`(기본 `python`). Node 타임아웃은 `KYOWONTOUR_E2E_TIMEOUT_MS`(기본 120000ms).
