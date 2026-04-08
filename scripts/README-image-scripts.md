# 이미지 관련 스크립트

## 배경색 추출 (봉투와 동일한 로딩 배경)

봉투 이미지 모서리 픽셀을 샘플링해 배경색을 뽑습니다.

```bash
npm run get-bg-color
```

출력된 hex를 `tailwind.config.ts`의 `envelope-bg`에 반영하면 됩니다. (이미 `#F6EEDA`로 적용되어 있음)

---

## 누끼(배경 제거) 작업

코드로 완전한 누끼는 무거우므로, 아래 중 하나를 추천합니다.

1. **remove.bg**  
   https://www.remove.bg  
   - `public/image/`의 PNG를 올린 뒤 다운로드 → 같은 폴더에 덮어쓰기 (또는 `-nobg.png` 등으로 저장 후 코드에서 경로만 변경)

2. **Python + rembg (로컬)**  
   - Python 설치 후:
   ```bash
   pip install rembg pillow
   python scripts/remove-bg.py
   ```
   - 배경 제거된 파일은 `public/image/nobg/`에 저장됩니다.  
     코드에서 이미지 경로를 `nobg` 폴더로 바꾸면 투명 배경 이미지를 사용할 수 있습니다.

누끼한 이미지를 쓰면 `envelope-bg` 배경색과 관계없이 어디서나 자연스럽게 붙습니다.
