# 프로덕션 간헐 502·허브 멈춤 — 근본 원인 및 해결 (2026-06)

## 한 줄 요약

**웹 트래픽과 배치 cron이 같은 Node 프로세스에 있었고**, browse 콜드 빌드(최대 1만 건)·self-HTTP·DB `connection_limit=1`이 겹치면 **전체 502**.

**해결:** production 기본 `web` 역할(HTTP 전용) + **worker** 서비스에 cron 분리 + browse는 **클라이언트 API만**.

---

## 아키텍처 (목표)

```
[브라우저] → Railway "bongtour" (web)
              BONGTOUR_INSTRUMENTATION_ROLE=web (기본)
              ├─ Next.js HTTP만
              └─ bongsim 결제 outbox (2분, 가벼운 DB)

Railway "bongtour-worker" (도메인 없음, replica 1)
              BONGTOUR_INSTRUMENTATION_ROLE=worker
              ├─ node-cron 17종
              ├─ postdeploy detail-payload 백필
              └─ Prisma pool (별도 limit 가능)
```

동일 repo·동일 `npm start` 이미지. **코드 배포 1회** 후 Railway에서 worker 서비스만 추가하면 됨.

**worker 미구축( web 단독 ):** `instrumentation.ts` 가 6공급사 **일 1회 sweep** 을 web-fallback 으로 등록한다 (`DISABLE_WEB_SUPPLIER_SWEEP_CRON=1` 로 끔). 3h calendar batch는 기본 OFF.

---

## 코드 SSOT

| 모듈 | 역할 |
|------|------|
| `lib/instrumentation-process-role.ts` | `web` / `worker` / `all` |
| `instrumentation.ts` | 역할별 cron 등록 |
| `lib/prisma-connection-limit.ts` | prod 기본 connection_limit=5 |
| `lib/products-browse-cached.ts` | browse in-flight dedupe |
| `lib/internal-loopback-origin.ts` | cron self-fetch → 127.0.0.1 |
| `app/components/home/AirHotelProductGridClient.tsx` | 메인 browse 클라이언트 전용 |

### 역할별 cron

| 역할 | 등록 |
|------|------|
| **web** | bongsim order-paid outbox만 |
| **worker** | season·calendar·publish·sales-policy·fit-itinerary·cache-warm·rehost·sync-bookable·detail-payload·coupon·modetour·… 전부 |
| **all** | 개발용 — production에서는 경고 로그 |

`RAILWAY_SERVICE_NAME`에 `worker` 또는 `cron` 포함 시 worker로 추론.

---

## Railway 설정 (1회)

### 1) 기존 공개 서비스 (web)

```env
BONGTOUR_INSTRUMENTATION_ROLE=web
BONGTOUR_PRISMA_CONNECTION_LIMIT=5
```

(미설정 시 production은 자동 `web`)

### 2) worker 서비스 추가

1. Railway → **New Service** → 같은 GitHub repo 연결
2. 서비스 이름: `bongtour-worker` (이름에 worker 포함 시 역할 자동 추론)
3. **Public networking 끔** (도메인 없음)
4. env:

```env
BONGTOUR_INSTRUMENTATION_ROLE=worker
BONGTOUR_PRISMA_CONNECTION_LIMIT=3
BONGTOUR_CRON_SECRET=… (web과 동일)
DATABASE_URL=… (web과 동일)
```

5. Replica **1** 고정

### web에서 켜지 말 것

```env
CACHE_WARM_HTTP_CRON=1
CACHE_WARM_ON_STARTUP=1
CACHE_WARM_HEAVY_BROWSE=1
BONGTOUR_INSTRUMENTATION_ROLE=all
```

---

## browse 경로 (RSC 블로킹 제거)

| 페이지 | 방식 |
|--------|------|
| `/travel/overseas` | 클라이언트 `/api/products/browse` |
| `/travel/air-hotel` | 동일 |
| 메인 항공+호텔 그리드 | 클라이언트, limit=20 미리보기 |

허브 콜드 API는 여전히 무겁지만 **홈·허브 RSC는 즉시 렌더** → 502 연쇄 차단.

---

## 재발 체크리스트

1. web 로그: `[instrumentation-role] resolved { role: 'web', background: false }`
2. worker 로그: `background: true`, cron registered 메시지
3. web에 `/travel/overseas` 3분 cache-warm 로그 **없음**
4. `GET /api/health` 200
5. Restart로만 풀리면 → 아직 web에 background cron 또는 `role=all`

---

## 관련 파일

- `instrumentation.ts`
- `lib/instrumentation-process-role.ts`
- `railway.json` — web healthcheck `/api/health`
- `lib/detail-payload-postdeploy.ts` — web 배포 시 postdeploy skip
