# AssetUsageLog 검토 메모

## 현재 방식
- `PhotoPool` + `Product.schedule` 스캔으로 사용 횟수/최근 사용/상품-day 참조를 집계한다.
- 장점: 스키마 변경 없이 즉시 운영에 적용 가능하다.
- 한계: 과거 시점 추적, 변경 이력 감사, 삭제/복구 시점 추적이 약하다.

## AssetUsageLog가 필요한 이유
- 운영자가 "누가/언제/어떤 day를 어떤 자산으로 교체했는지"를 추적할 수 있어야 한다.
- 현재 스냅샷 집계는 최종 상태 중심이라 변경 히스토리를 잃는다.
- 정책/품질 이슈가 생겼을 때 회귀 분석이 어렵다.

## 권장 최소 스키마(향후)
- `id`
- `assetId` (`PhotoPool.id`)
- `productId`
- `day`
- `selectionMode` (`manual-pick`, `manual-upload`, `library-reuse`, `auto`)
- `usedAt` (서버 시각)
- `actorType` (`admin`, `system`)
- `actorId` (nullable)

## 적용 단계 제안
1. 1단계: 현재 집계 API 유지 + 로그 테이블 추가(쓰기만).
2. 2단계: 라이브러리 이력 UI를 로그 기반으로 전환.
3. 3단계: 감사 리포트(기간별 교체 빈도, 운영자별 변경량) 추가.
