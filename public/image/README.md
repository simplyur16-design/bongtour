# 이미지 폴더 (image)

이 폴더에 아래 4개 파일을 넣어주세요. (이름·확장자 그대로)

| 파일명 | 용도 |
|--------|------|
| **envelope-closed.png** | 닫힌 봉투 (로딩 1단계) |
| **envelope-opened.png** | 열린 봉투, 하얀 내부 (로딩 2단계) |
| **bong-sajang-pops.png** | 봉사장이 봉투에서 뿅 하고 나오는 장면 (로딩 3단계) |
| **bong-sajang-chat.png** | 봉사장 + TALK 말풍선 (우측 하단 플로팅, 카카오톡 상담) |

코드에서는 `/image/파일명.png` 경로로 불러옵니다.  
Next.js는 `public` 폴더를 루트로 제공하므로, 위 파일들을 `public/image/` 안에 두면 됩니다.
