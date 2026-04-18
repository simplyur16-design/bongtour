#!/usr/bin/env bash
# 서버(Linux)에서 실행: 톡톡 채팅 URL / 프로필 URL / 배너 data-id 를 .env.production(또는 .env)에 한 줄씩 upsert.
# 사용:
#   curl -fsSL .../server-upsert-naver-talktalk-env.sh | bash -s
#   또는 레포에서:
#   bash scripts/server-upsert-naver-talktalk-env.sh
#   bash scripts/server-upsert-naver-talktalk-env.sh /var/www/bongtour .env.production
#
# 이후 NEXT_PUBLIC_* 변경이면: npm ci && npm run build && pm2 restart <이름> --update-env

set -euo pipefail

APP_DIR="${1:-/var/www/bongtour}"
ENV_REL="${2:-.env.production}"

CHAT_URL="${NAVER_TALKTALK_CHAT_URL:-https://talk.naver.com/W2R7VAU}"
PROFILE_URL="${NAVER_TALKTALK_PROFILE_URL:-https://talk.naver.com/profile/w2r7vau}"
BANNER_ID="${NAVER_TALKTALK_BANNER_ID:-173064}"

upsert_kv() {
  local file="$1"
  local key="$2"
  local val="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]] && grep -q "^${key}=" "$file" 2>/dev/null; then
    grep -v "^${key}=" "$file" >"$tmp" || true
    mv "$tmp" "$file"
  fi
  printf '%s="%s"\n' "$key" "$val" >>"$file"
}

cd "$APP_DIR" || {
  echo "ERROR: 디렉터리 없음: $APP_DIR" >&2
  exit 1
}

ENV_FILE="$APP_DIR/$ENV_REL"
if [[ ! -f "$ENV_FILE" ]] && [[ -f "$APP_DIR/.env" ]]; then
  ENV_FILE="$APP_DIR/.env"
  echo "[info] $ENV_REL 없음 → .env 사용: $ENV_FILE"
fi

touch "$ENV_FILE"
echo "[info] 대상 파일: $ENV_FILE"

upsert_kv "$ENV_FILE" "NEXT_PUBLIC_NAVER_TALKTALK_URL" "$CHAT_URL"
upsert_kv "$ENV_FILE" "NEXT_PUBLIC_NAVER_TALKTALK_PROFILE_URL" "$PROFILE_URL"
upsert_kv "$ENV_FILE" "NEXT_PUBLIC_NAVER_TALKTALK_BANNER_ID" "$BANNER_ID"

echo "[ok] 적용된 키(값 일부만 표시):"
grep -E '^NEXT_PUBLIC_NAVER_TALKTALK' "$ENV_FILE" || true

echo
echo "[다음] NEXT_PUBLIC_* 는 빌드 시 클라이언트에 박힙니다. 배포 서버에서:"
echo "  cd $APP_DIR && npm ci && npm run build && pm2 restart <앱이름> --update-env"
