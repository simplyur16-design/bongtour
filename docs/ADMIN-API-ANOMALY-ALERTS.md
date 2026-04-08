# Admin API 이상징후 알림 기준

## 현재 코드 기준 이벤트
- `401`: 인증 없는 관리자 API 접근
- `403`: 권한 없는 관리자 API 접근
- `429`: rate limit 초과
- `expensive`: 고비용 관리자 API 호출

## 임계치 (1분 버킷, IP 기준)
- `401` >= 10
- `403` >= 8
- `429` >= 8
- `expensive` >= 20

임계치 초과 시 구조화 이벤트를 기록하고, 외부 채널 알림 함수를 호출한다.

## 외부 연동 확장 포인트
- 현재: `SECURITY_ALERT_WEBHOOK_URL` 설정 시 webhook POST
- 미설정: 로컬 로그(`console.warn`)만 유지

## 운영 권장
- 1차: webhook 기반 알림 연결
- 2차: Slack/Email 채널 분리 및 우선순위 라우팅
- 3차: 임계치 동적 조정(시간대/엔드포인트별)
