# 서버 적용 (요약)

## env 교정·점검

서버 SSH 후:

```bash
cd /var/www/bongtour
bash deploy/verify-production-env.sh
```

- **필수** 누락이면 exit code 1 → `nano .env` 로 채운 뒤 `pm2 restart bongtour --update-env`
- **카카오**: `KAKAO_CLIENT_ID` + `KAKAO_CLIENT_SECRET` (둘 다)
- **네이버**: `NAVER_CLIENT_ID` + `NAVER_CLIENT_SECRET` + `NAVER_CALLBACK_URL` (셋 다, 콜백 URL은 네이버 개발자센터와 동일)
- **이메일 로그인**: env 없음 · DB 사용자만

---

코드(CSP·`public-mutation-origin` 등) 반영 후:

```bash
cd /var/www/bongtour
git pull
npm ci
npm run build
pm2 restart bongtour --update-env
```

nginx(www 리다이렉트·프록시 헤더)는 `nginx-bongtour-site.conf.example` 참고 → `sudo nginx -t` → `sudo systemctl reload nginx`.

환경 변수: `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` / `BONGTOUR_API_BASE` / `NAVER_CALLBACK_URL` 은 **브라우저에 치는 도메인과 동일**(예: `https://bongtour.com`).

전체 절차: `docs/DEPLOY-NAVER-CLOUD.md`.

---

## ybtour 관리자 출발일·가격 재수집 (Python Playwright)

관리자 상품 상세의 **출발일/가격 재수집**은 Node가 `python3 -m scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper <상세URL>` 을 한 번 실행합니다.  
서버의 **시스템** `python3`에 `pip` / `playwright` 가 없으면 (`No module named pip`, `No module named playwright`) **라이브 수집은 항상 실패**하고 `product-price-rebuild` 폴백만 됩니다.

**권장:** 레포 루트에 전용 venv 를 두고, PM2/`.env` 에 그 Python 경로를 넘깁니다.

```bash
cd /var/www/bongtour

# pip 없을 때 (Debian/Ubuntu 예시)
# sudo apt-get update && sudo apt-get install -y python3-pip python3-venv

python3 -m venv .venv
./.venv/bin/pip install -U pip wheel
./.venv/bin/pip install playwright
./.venv/bin/playwright install --with-deps chromium
```

`.env` (또는 PM2 `env`) 에 다음을 넣은 뒤 `pm2 restart bongtour --update-env` :

- `PYTHON=/var/www/bongtour/.venv/bin/python`  
  (호환: `PYTHON_EXECUTABLE` 동일 역할 — `lib/resolve-python-executable.ts` 참고)
- (선택) PM2 `cwd`가 레포가 아니면 `BONGTOUR_REPO_ROOT=/var/www/bongtour`

동작 확인:

```bash
cd /var/www/bongtour
PYTHONPATH=/var/www/bongtour /var/www/bongtour/.venv/bin/python -m scripts.calendar_e2e_scraper_ybtour.calendar_price_scraper "https://prdt.ybtour.co.kr/product/detailPackage?goodsCd=TEST&menu=PKG"
```

표준 JSON 한 줄(`{"ok":...`)이 stdout 에 나오고 프로세스 exit code 가 0 이면 Node 쪽과 맞물립니다.
