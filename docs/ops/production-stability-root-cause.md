# 프로덕션 간헐 502·허브 멈춤 — 근본 원인 및 해결 (2026-06)

## 한 줄 요약

**웹 트래픽과 배치 cron이 같은 Node 프로세스에 있었고**, browse 콜드 빌드(최대 1만 건)·self-HTTP·DB `connection_limit=1`이 겹치면 **전체 502**.

**해결:** production 기본 `web` 역할(HTTP 전용) + **worker** 서비스에 cron 분리 + browse는 **클라이언트 API만**.

---

## 아키텍처 (목표)

```
[브라우저] → Railway "bongtour" (web)
              BONGTOUR_INSTRUMENTATION_ROLE=web
              BONGSIM_FULFILL_OWNER=worker   ← 필수(worker 있을 때)
              ├─ Next.js HTTP만
              └─ OrderPaid outbox INSERT + kick no-op (발급 HTTP 안 함)

Railway "bongtour-worker" (도메인 없음, replica 1)
              BONGTOUR_INSTRUMENTATION_ROLE=worker
              ├─ OrderPaid + EsimQrNotify 드레인 (15s interval + 1분 cron)
              ├─ USIMSA 동시 슬롯 BONGSIM_USIMSA_MAX_INFLIGHT=2
              ├─ node-cron 배치(달력·sweep·…)
              └─ Prisma/pg 풀 (별도 limit)

(선택) Railway "bongtour-fulfill" — 발급만
              BONGTOUR_INSTRUMENTATION_ROLE=fulfill
              web: BONGSIM_FULFILL_OWNER=fulfill
              worker: 배치만 (발급 owner≠worker)
```

동일 repo·동일 Next start 이미지(`railway.json` `exec node …/next start`). **코드 배포 1회** 후 Railway에서 worker(또는 fulfill) 서비스만 추가하면 됨.

**worker 미구축( web 단독 ):** `BONGSIM_FULFILL_OWNER` unset → web이 발급 drain (호환).  
**worker 구축 후:** web에 `BONGSIM_FULFILL_OWNER=worker` 없으면 web이 계속 발급해 풀 경합이 남는다.

**worker 미구축 시 배치:** `instrumentation.ts` 가 6공급사 **일 1회 sweep** 을 web-fallback 으로 등록 (`DISABLE_WEB_SUPPLIER_SWEEP_CRON=1` 로 끔). 3h calendar batch는 기본 OFF.

---

## 코드 SSOT

| 모듈 | 역할 |
|------|------|
| `lib/instrumentation-process-role.ts` | `web` / `worker` / `fulfill` / `all` + `BONGSIM_FULFILL_OWNER` |
| `instrumentation.ts` | 역할·발급 owner별 cron 등록 |
| `lib/prisma-connection-limit.ts` | prod 기본 connection_limit=3 |
| `lib/products-browse-cached.ts` | browse in-flight dedupe |
| `lib/internal-loopback-origin.ts` | cron self-fetch → 127.0.0.1 |
| `app/components/home/AirHotelProductGridClient.tsx` | 메인 browse 클라이언트 전용 |

### 역할별 cron

| 역할 | 등록 |
|------|------|
| **web** | HTTP. 발급 cron은 `BONGSIM_FULFILL_OWNER=web`(단독)일 때만 |
| **worker** | 배치 cron + (owner=worker 시) OrderPaid/EsimQrNotify 15s·1분 |
| **fulfill** | 발급 드레인만 (배치 없음) |
| **all** | 개발용 — production에서는 경고 로그 |

`RAILWAY_SERVICE_NAME`에 `worker`/`cron` → worker, `fulfill` → fulfill.

---

## Railway “Deploy Crashed” 메일 폭주 (운영)

<!-- REGRESSION-FREEZE[railway-start-exec-next]: Deploy Crashed false-positive + Notification Rules — manifest -->

**증상:** `bongtour` + `bongtour-worker` 가 **같은 시각**에 메일로 오고, 하루 수십~백 통. 사이트는 정상인 경우가 많음.

**원인 (우선순위):**

1. **재배포 시 구 컨테이너 종료를 Crash로 집계** — `startCommand`가 `npm start`이면 npm이 PID 1이라 SIGTERM 후 **non-zero exit** → Railway가 “Deploy Crashed” 메일. web·worker가 **같은 repo**라 push 1회 = 메일 2통.
2. **main 푸시가 잦음** — 배포 N회 × 2서비스 ≈ 메일 수. (오늘처럼 연속 핫픽스 시 70~80통 가능)
3. (드묾) worker에 `/api/health` 헬스체크가 실패해 진짜 재시작 루프 — Railway 대시보드 Deployments에서 **Failed/Crashed가 Active 직후 구 배포에만** 찍히면 1번, **새 배포가 반복 Crashed**면 3번.

**조치:**

| 조치 | 어디 |
|------|------|
| `exec node …/next start` (npm 래퍼 제거) | repo `railway.json` — REGRESSION-FREEZE[`railway-start-exec-next`] |
| Crash 메일 끄기/완화 | [Notification Rules](https://railway.com/account/notifications) |
| worker 헬스체크 | worker 서비스 Settings → Healthcheck **비우기 권장**(HTTP 공개 불필요). web만 `/api/health` |
| 배포 빈도 | 핫픽스 묶어서 push |

`RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30`~(60) 을 서비스 Variables에 두면 교체 시 graceful shutdown 여유가 생긴다.

---

## Railway 설정 (1회)

### 1) 기존 공개 서비스 (web)

```env
BONGTOUR_INSTRUMENTATION_ROLE=web
BONGSIM_FULFILL_OWNER=worker
BONGTOUR_PRISMA_CONNECTION_LIMIT=5
BONGSIM_PG_POOL_MAX=10
```

(미설정 시 production은 자동 `web`. **worker가 있으면 `BONGSIM_FULFILL_OWNER=worker` 필수.**  
동시 접속 ~100명(조회·결제 확정) 목표: web pg 10 + Prisma 5.)

### 2) worker 서비스 (배치 + 발급 — 권장 최소 구성)

1. Railway → **New Service** → 같은 GitHub repo 연결
2. 서비스 이름: `bongtour-worker` (이름에 worker 포함 시 역할 자동 추론)
3. **Public networking 끔** (도메인 없음)
4. Healthcheck **비움**
5. env:

```env
BONGTOUR_INSTRUMENTATION_ROLE=worker
BONGTOUR_PRISMA_CONNECTION_LIMIT=2
BONGSIM_PG_POOL_MAX=8
BONGSIM_PG_CONNECT_TIMEOUT_MS=12000
BONGSIM_USIMSA_MAX_INFLIGHT=2
BONGSIM_FULFILL_DRAIN_INTERVAL_MS=15000
BONGTOUR_CRON_SECRET=… (web과 동일)
DATABASE_URL=… (web과 동일)
```

OrderPaid tick이 `timeout exceeded when trying to connect` 이고 풀 stats가
`{ idle: 0, total: max }` 이면 **saturated backoff**(heal 없이 짧게 대기 후 재시도).
슬롯이 비어 있는데도 타임아웃이면 기존대로 catalog heal.

6. Replica **1** 고정

### 2b) (선택) 발급 전용 fulfill 서비스

배치와 발급을 더 나누려면 worker 대신/추가로:

```env
# 서비스명 예: bongtour-fulfill
BONGTOUR_INSTRUMENTATION_ROLE=fulfill
BONGTOUR_PRISMA_CONNECTION_LIMIT=1
BONGSIM_PG_POOL_MAX=4
BONGSIM_USIMSA_MAX_INFLIGHT=2
```

web: `BONGSIM_FULFILL_OWNER=fulfill`  
기존 worker: 배치만 (발급 owner≠worker → worker는 OrderPaid cron 안 돎)

### 커넥션 예산 — Supabase 세션 풀 `pool_size`

web·worker·(fulfill)·마이그레이션이 **같은 슬롯을 나눠 쓴다.** 합이 한도에 닿으면
`FATAL: (EMAXCONNSESSION)` → 전면 `db_error` / `query_failed`.

결제·무상발급 HTTP는 outbox INSERT만 하고, USIMSA·알림톡은 **fulfill owner** 가 큐로 처리.
동시 발급 상한: `BONGSIM_USIMSA_MAX_INFLIGHT` (기본 2).  
**100명 동시 “발급”이 아니라 100명 동시 “접속”** — 발급은 큐에 쌓여 순차 처리되는 것이 정상이다.

Supabase → Settings → Database → Connection pooling → **Pool Size = 40** (미만이면 올리지 말 것).

| 소비자 | Prisma | `pg` 풀 | 합 |
|---|---|---|---|
| web (발급 off, 동시접속용) | 5 | 10 | 15 |
| worker (배치+발급) | 2 | 8 | 10 |
| `prisma migrate deploy` | — | — | ~2 |
| **합계** | | | **~27 / 40** |

배포 중 구 인스턴스 겹침 ≈ 35 근처. **web replica를 늘리기 전에** 이 합을 다시 계산할 것 (replica 2 = 거의 풀 고갈).

`DIRECT_URL` 은 풀러가 아니라 실제 직결 주소(`db.<ref>.supabase.co:5432`)여야 한다.
풀러를 가리키면 마이그레이션이 이 15슬롯을 두고 앱과 경쟁한다.

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
- `railway.json` — `exec node …/next start` + web healthcheck `/api/health`
- `lib/detail-payload-postdeploy.ts` — web 배포 시 postdeploy skip
