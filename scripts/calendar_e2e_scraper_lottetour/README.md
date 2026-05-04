# 롯데관광(lottetour) 달력·출발가 E2E 스크래퍼

## 개요

- 롯데관광 사이트 **내부** 출발 목록 엔드포인트 `GET /evtlist/evtListAjax`를 호출해 **HTML 테이블**을 파싱합니다 (공개 HTTP, 인증 없음).
- Node 쪽 `lib/lottetour-departures.ts`에서 TS `fetch`로 0건일 때 **같은 엔드포인트**를 Python `requests`로 한 번 더 시도하는 폴백에 사용됩니다.
- 운영 배치 `scripts/calendar_price_scheduler.py`의 `site=lottetour` 상품도 이 모듈을 호출합니다.

## 준비

```bash
pip install -r scripts/calendar_e2e_scraper_lottetour/requirements.txt
```

## 환경변수 (`LOTTETOUR_*`)

| 변수 | 설명 |
|------|------|
| `LOTTETOUR_BASE_URL` | 기본 `https://www.lottetour.com` |
| `LOTTETOUR_CALENDAR_MONTH_COUNT` | 월 순회 상한(기본 12) |
| `LOTTETOUR_USER_AGENT` | 요청 User-Agent |
| `LOTTETOUR_DATE_FROM` / `LOTTETOUR_DATE_TO` | `YYYY-MM` 또는 `YYYY-MM-DD` 필터 |
| `LOTTETOUR_E2E_FALLBACK` | Node 폴백 on/off (기본 1) |
| `LOTTETOUR_E2E_TIMEOUT_MS` | subprocess 타임아웃(기본 600000) |
| `LOTTETOUR_PYTHON` | Python 실행 파일 경로 |
| `LOTTETOUR_REPO_ROOT` / `BONGTOUR_REPO_ROOT` | 리포 루트(PYTHONPATH) |

## 수동 실행 예시

```bash
# 돌로미티 예시(2026년 6월 한 달만)
python -m scripts.calendar_e2e_scraper_lottetour.calendar_price_scraper \
  --god-id 65222 \
  --menu-no1 826 --menu-no2 854 --menu-no3 1000 --menu-no4 4900 \
  --months 1 \
  --depart-month 202606 \
  --evt-cd-hint E01A260624KE007
```

- 결과: **stdout 마지막 JSON 한 줄** (`phase`, `rows`, `warnings` …). 로그는 stderr.
- `rows[]` 필드는 Node `LottetourCalendarRow`와 동일한 키(`depYm`, `godId`, `evtCd`, `departDate`, …)를 사용합니다.

## 운영자 절차

1. 상품 `detailUrl`에 `/evtList/...?godId=` 또는 `godId`가 쿼리에 포함된 URL을 권장합니다 (`evtDetail`만 있으면 배치가 godId를 못 찾을 수 있음).
2. `calendar_price_scheduler` 실행 전 위 환경변수를 확인합니다.
3. 차단·빈 응답 시 Node 관리자 재수집에서 Python 폴백이 자동으로 붙는지 로그를 확인합니다.

## 참고

- 표현은 **사이트 내부 AJAX / 공개 HTTP** 수준으로 기술합니다.
