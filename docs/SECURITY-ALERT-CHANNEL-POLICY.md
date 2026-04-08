# 보안 알림 채널 정책 (Webhook -> Slack/Email 확장)

## 현재 상태
- `SECURITY_ALERT_WEBHOOK_URL` 설정 시 webhook 전송
- 미설정 시 구조화 로그만 기록

## 확장 목표
1. Slack 라우팅
2. Email 라우팅
3. 환경별(dev/staging/prod) 정책 분기
4. 중복/과다 알림 방지

## 권장 라우팅
- dev: 로그만(선택적으로 Slack low-priority)
- staging: Slack 알림 + 낮은 임계치 테스트
- prod: Slack + Email 동시 알림(고위험만)

## 중복 방지 정책
- 동일 키(`ip+path+event-class`)에 대해 5~10분 쿨다운
- 첫 알림/해제 알림 분리
- 반복 알림은 집계형 메시지로 축약

## 구현 확장 포인트
- `lib/security-anomaly-notifier.ts`
  - webhook 외 `notifySlack`, `notifyEmail` 함수 분리
  - 환경별 라우팅 룰 추가
  - dedupe cache(메모리/Redis) 추가

## 운영 주의사항
- 연락처/이메일 등 PII를 알림 본문에 과도하게 포함하지 않는다.
- 알림 실패 자체도 로그로 남겨 추적한다.
