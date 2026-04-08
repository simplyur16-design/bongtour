# 메인 4허브 카드 배경 이미지

- **원칙**: 텍스트·로고·워터마크 없음, 카드 하단·좌측에 타이포 여백이 보이는 구도, 프리미엄 에디토리얼 톤.
- **소스**: 최종적으로는 **제미나이 생성 이미지**로 교체합니다. 현재 `base/`의 JPG는 레이아웃·라우팅 검증용 임시 파일이며, 동일 파일명으로 덮어쓰면 됩니다.

## 활성 이미지 지정 (권장)

메인에 어떤 파일을 쓸지는 **`public/data/home-hub-active.json`** 에서 카드 키별 URL로 지정합니다.  
파일만 갱신하면 `resolveHomeHubImageSrc()` 가 메인에 반영합니다.

## 경로 규칙

```
public/images/home-hub/{season}/{cardKey}.jpg   또는 .webp
```

- `cardKey`: `overseas` | `training` | `domestic` | `bus`
- `season`: `base` | `spring` | `summer` | `autumn` | `winter` (폴더 추가 후 `lib/home-hub-images.ts`의 `HOME_HUB_ACTIVE_SEASON` 변경)

## 카테고리별 무드 (기획 참고)

| 키 | 방향 |
|----|------|
| `overseas` | 글로벌 여행, 도시·이동·풍경, 관광 포스터 느낌 지양 |
| `domestic` | 한국적 로컬·계절, ‘대한민국의 재발견’ |
| `training` | 기관 방문·교류·현장 설명, 딱딱한 회의실 스톡 지양 |
| `bus` | 단체·공항 이동·운영 신뢰, 자동차 광고 과장 지양 |
