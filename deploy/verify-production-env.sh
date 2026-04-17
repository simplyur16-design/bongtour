#!/usr/bin/env bash
# BongTour — 서버에서 .env 점검 (값은 출력하지 않음)
# 사용: cd /var/www/bongtour && bash deploy/verify-production-env.sh

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || exit 1

FILES=()
[[ -f ".env" ]] && FILES+=(".env")
[[ -f ".env.production" ]] && FILES+=(".env.production")

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "오류: .env 또는 .env.production 이 없습니다: $(pwd)"
  exit 1
fi

merged_line() {
  local key="$1"
  local last="" f line
  for f in "${FILES[@]}"; do
    while IFS= read -r line; do
      [[ "$line" =~ ^${key}= ]] && last="$line"
    done < <(grep -E "^${key}=" "$f" 2>/dev/null || true)
  done
  printf '%s' "$last"
}

val_of() {
  local line="$1"
  [[ -z "$line" ]] && { echo ""; return; }
  local v="${line#*=}"
  v="${v%$'\r'}"
  if [[ "$v" =~ ^\".*\"$ ]]; then v="${v#\"}"; v="${v%\"}"; fi
  if [[ "$v" =~ ^\'.*\'$ ]]; then v="${v#\'}"; v="${v%\'}"; fi
  printf '%s' "$v"
}

echo "=== BongTour env 점검: $(pwd) ==="
echo "대상 파일: ${FILES[*]}"
echo ""

fail=0

echo "[필수 — 기동·세션]"
if [[ -n "$(val_of "$(merged_line DATABASE_URL)")" ]]; then
  echo "  [OK] DATABASE_URL"
else
  echo "  [빠짐] DATABASE_URL"
  fail=1
fi
if [[ -n "$(val_of "$(merged_line AUTH_SECRET)")" ]]; then
  echo "  [OK] AUTH_SECRET"
elif [[ -n "$(val_of "$(merged_line NEXTAUTH_SECRET)")" ]]; then
  echo "  [OK] NEXTAUTH_SECRET (AUTH_SECRET 대체)"
else
  echo "  [빠짐] AUTH_SECRET 또는 NEXTAUTH_SECRET"
  fail=1
fi
if [[ -n "$(val_of "$(merged_line NEXTAUTH_URL)")" ]]; then
  echo "  [OK] NEXTAUTH_URL"
else
  echo "  [빠짐] NEXTAUTH_URL"
  fail=1
fi
pub_base_ok=0
for k in SITE_URL NEXT_PUBLIC_SITE_URL APP_URL NEXT_PUBLIC_APP_URL; do
  if [[ -n "$(val_of "$(merged_line "$k")")" ]]; then
    pub_base_ok=1
    break
  fi
done
if [[ "$pub_base_ok" -eq 1 ]]; then
  echo "  [OK] 공개 URL (SITE_URL / NEXT_PUBLIC_SITE_URL / APP_URL / NEXT_PUBLIC_APP_URL 중 하나 이상, lib/server-env.ts)"
else
  echo "  [빠짐] 공개 URL — 위 네 키 중 하나 필요(기동 검증·Origin·관리 링크). NEXT_PUBLIC_* 는 빌드 시 박히므로 배포 후 .env 만 고칠 땐 SITE_URL 등 권장."
  fail=1
fi
if [[ -n "$(val_of "$(merged_line SUPABASE_URL)")" ]]; then
  echo "  [OK] SUPABASE_URL"
else
  echo "  [빠짐] SUPABASE_URL"
  fail=1
fi
if [[ -n "$(val_of "$(merged_line SUPABASE_SERVICE_ROLE_KEY)")" ]]; then
  echo "  [OK] SUPABASE_SERVICE_ROLE_KEY"
else
  echo "  [빠짐] SUPABASE_SERVICE_ROLE_KEY"
  fail=1
fi
echo ""

echo "[선택 — 카카오 로그인 버튼]"
kc=0
[[ -n "$(val_of "$(merged_line KAKAO_CLIENT_ID)")" ]] && [[ -n "$(val_of "$(merged_line KAKAO_CLIENT_SECRET)")" ]] && kc=1
if [[ "$kc" -eq 1 ]]; then
  echo "  [OK] KAKAO_CLIENT_ID + KAKAO_CLIENT_SECRET"
else
  echo "  [미설정] 카카오 — 둘 다 채워야 버튼 표시"
fi
echo ""

echo "[선택 — 네이버 로그인 버튼]"
nv=0
[[ -n "$(val_of "$(merged_line NAVER_CLIENT_ID)")" ]] && \
[[ -n "$(val_of "$(merged_line NAVER_CLIENT_SECRET)")" ]] && {
  if [[ -n "$(val_of "$(merged_line NAVER_CALLBACK_URL)")" ]] || \
     [[ -n "$(val_of "$(merged_line NAVER_OAUTH_PUBLIC_ORIGIN)")" ]] || \
     [[ -n "$(val_of "$(merged_line NEXTAUTH_URL)")" ]] || \
     [[ -n "$(val_of "$(merged_line NEXT_PUBLIC_SITE_URL)")" ]]; then
    nv=1
  fi
}
if [[ "$nv" -eq 1 ]]; then
  echo "  [OK] NAVER_CLIENT_ID + NAVER_CLIENT_SECRET + (NAVER_CALLBACK_URL 또는 NEXTAUTH_URL 등으로 redirect_uri 결정)"
else
  echo "  [미설정] 네이버 — CLIENT_ID/SECRET 및 callback 기준 URL(NAVER_CALLBACK_URL 또는 NEXTAUTH_URL 등) 필요"
fi
echo ""

echo "[참고 — 이메일 로그인]"
echo "  env 불필요. DB User에 email·passwordHash·accountStatus=active 필요."
echo ""

echo "[권장 — 문의 접수 관리자 메일 SMTP (lib/inquiry-email.ts)]"
smtp_ok=0
[[ -n "$(val_of "$(merged_line SMTP_HOST)")" ]] && \
[[ -n "$(val_of "$(merged_line SMTP_USER)")" ]] && \
[[ -n "$(val_of "$(merged_line SMTP_PASS)")" ]] && {
  if [[ -n "$(val_of "$(merged_line INQUIRY_MAIL_FROM)")" ]] || [[ -n "$(val_of "$(merged_line SMTP_USER)")" ]]; then
    smtp_ok=1
  fi
}
if [[ "$smtp_ok" -eq 1 ]]; then
  echo "  [OK] SMTP_HOST + SMTP_USER + SMTP_PASS + 발신(INQUIRY_MAIL_FROM 또는 USER)"
else
  echo "  [미설정] 문의 알림 메일 — 미설정 시 접수는 되나 메일 실패·notification 지연 처리( docs/OPS-INQUIRY-SMTP.md )"
fi
echo ""

echo "[권장 — 로컬과 동일한 이미지·키워드·생성 파이프라인]"
# 파서 코드는 동일하나, Pexels/Gemini 키가 없으면 API가 빈 결과·fallback만 나와 검색어·대표이미지 결과가 로컬과 달라짐
if [[ -n "$(val_of "$(merged_line PEXELS_API_KEY)")" ]]; then
  echo "  [OK] PEXELS_API_KEY"
else
  echo "  [미설정] PEXELS_API_KEY — 일정/대표 이미지 Pexels 검색이 실패·placeholder 위주(로컬과 불일치 원인 1순위)"
fi
if [[ -n "$(val_of "$(merged_line GEMINI_API_KEY)")" ]]; then
  echo "  [OK] GEMINI_API_KEY"
else
  echo "  [미설정] GEMINI_API_KEY — 이미지 생성·일부 LLM 보강 없음(로컬에만 있으면 동작 차이)"
fi
nc=0
[[ -n "$(val_of "$(merged_line NCLOUD_ACCESS_KEY)")" ]] && [[ -n "$(val_of "$(merged_line NCLOUD_SECRET_KEY)")" ]] && \
  [[ -n "$(val_of "$(merged_line NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL)")" ]] && nc=1
if [[ "$nc" -eq 1 ]]; then
  echo "  [OK] Ncloud Object Storage (NCLOUD_ACCESS_KEY + SECRET + PUBLIC_BASE_URL)"
else
  echo "  [미설정] Ncloud 업로드 — 풀·월간 큐레이션 등 객체 저장 불가 시 로컬과 다름"
fi
echo ""

if [[ "$fail" -ne 0 ]]; then
  echo "필수 항목 보완: nano .env"
  echo "반영: pm2 restart bongtour --update-env"
  exit 1
fi
echo "필수 항목 충족. 카카오/네이버는 위 선택 섹션 참고."
exit 0
