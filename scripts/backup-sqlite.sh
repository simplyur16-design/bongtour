#!/usr/bin/env bash
# SQLite 운영 DB 자동 백업 + 보관(기본 90일 초과분 삭제).
#
# 경로 결정 순서:
#   1) 환경변수 BONGTOUR_SQLITE_PATH 가 이미 있으면 그대로 사용
#   2) 이 스크립트의 상위 폴더(프로젝트 루트)에서 .env.production → .env.local → .env 순으로
#      DATABASE_URL=file:... 를 읽음 (상대 경로면 프로젝트 루트 기준으로 절대 경로로 만듦)
#   3) 그래도 없으면 에러 메시지로 확인 방법 안내
#
# 백업 디렉터리: BONGTOUR_BACKUP_DIR 미설정 시 「DB 파일과 같은 디렉터리/backups」 (mkdir -p 로 생성)
#
# cron 예: 10 3 * * * /절대경로/bongtour/scripts/backup-sqlite.sh >> /var/log/bongtour-sqlite-backup.log 2>&1
#
# 선택 환경변수:
#   BONGTOUR_BACKUP_RETENTION_DAYS — 기본 90 (약 3개월)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

read_sqlite_path_from_dotenv() {
  local f="$1"
  [[ -f "$f" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^DATABASE_URL= ]] || continue
    local v="${line#DATABASE_URL=}"
    v="${v#\"}"
    v="${v%\"}"
    v="${v#\'}"
    v="${v%\'}"
    [[ "$v" == file:* ]] || continue
    local p="${v#file:}"
    if [[ "$p" != /* ]]; then
      p="$PROJECT_ROOT/$p"
    fi
    printf '%s' "$p"
    return 0
  done < "$f"
  return 1
}

if [[ -z "${BONGTOUR_SQLITE_PATH:-}" ]]; then
  if path="$(read_sqlite_path_from_dotenv "$PROJECT_ROOT/.env.production" 2>/dev/null)"; then
    BONGTOUR_SQLITE_PATH="$path"
  elif path="$(read_sqlite_path_from_dotenv "$PROJECT_ROOT/.env.local" 2>/dev/null)"; then
    BONGTOUR_SQLITE_PATH="$path"
  elif path="$(read_sqlite_path_from_dotenv "$PROJECT_ROOT/.env" 2>/dev/null)"; then
    BONGTOUR_SQLITE_PATH="$path"
  fi
fi

if [[ -z "${BONGTOUR_BACKUP_DIR:-}" ]]; then
  if [[ -n "${BONGTOUR_SQLITE_PATH:-}" ]]; then
    BONGTOUR_BACKUP_DIR="$(dirname "$BONGTOUR_SQLITE_PATH")/backups"
  fi
fi

: "${BONGTOUR_BACKUP_RETENTION_DAYS:=90}"

if [[ -z "${BONGTOUR_SQLITE_PATH:-}" ]]; then
  echo "backup-sqlite: DATABASE_URL(file:...) 를 찾지 못했습니다." >&2
  echo "  프로젝트: $PROJECT_ROOT" >&2
  echo "  아래 중 하나에 DATABASE_URL=file:/실제경로/xxx.db 를 두거나," >&2
  echo "  실행 전에 export BONGTOUR_SQLITE_PATH=/실제경로/xxx.db 를 지정하세요." >&2
  echo "  (예: grep DATABASE_URL $PROJECT_ROOT/.env.production)" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "backup-sqlite: sqlite3 가 필요합니다. (apt install sqlite3)" >&2
  exit 1
fi

if [[ ! -f "$BONGTOUR_SQLITE_PATH" ]]; then
  echo "backup-sqlite: DB 파일이 없습니다: $BONGTOUR_SQLITE_PATH" >&2
  echo "  서버의 DATABASE_URL 과 실제 파일 위치가 맞는지 확인하세요." >&2
  exit 1
fi

mkdir -p "$BONGTOUR_BACKUP_DIR"

stamp=$(date +%Y%m%d-%H%M%S)
out="${BONGTOUR_BACKUP_DIR}/bongtour-sqlite-${stamp}.db"

sqlite3 "$BONGTOUR_SQLITE_PATH" ".backup '$out'"
echo "$(date '+%Y-%m-%d %H:%M:%S %z') backup-sqlite: wrote $out (from $BONGTOUR_SQLITE_PATH)"

find "$BONGTOUR_BACKUP_DIR" -type f -name 'bongtour-sqlite-*.db' -mtime "+${BONGTOUR_BACKUP_RETENTION_DAYS}" -delete
echo "$(date '+%Y-%m-%d %H:%M:%S %z') backup-sqlite: retention ${BONGTOUR_BACKUP_RETENTION_DAYS}d under $BONGTOUR_BACKUP_DIR"
