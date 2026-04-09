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
