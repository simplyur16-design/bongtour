<#
.SYNOPSIS
  Bongtour 프로젝트 안전 정리 스크립트

.DESCRIPTION
  - 루트의 임시·패치 파일들을 _archive/ 로 이동 (삭제 아님 — 복구 가능)
  - zip에 실수로 포함됐던 gitignore 대상 폴더 제거 (로컬에 원본 있으면 다시 생성됨)
  - 기본은 dry-run 모드. 실제 실행은 -Apply 플래그 필요.

.EXAMPLE
  # 1단계: 무엇이 옮겨질지 먼저 확인 (아무것도 안 바뀜)
  .\scripts\01-cleanup-project.ps1

  # 2단계: 확인 후 실제 실행
  .\scripts\01-cleanup-project.ps1 -Apply

  # 공격적 정리 (BONGTOUR/, DEV/, pages/ 까지 아카이브) — 내용 확인 후에만!
  .\scripts\01-cleanup-project.ps1 -Apply -Aggressive

.NOTES
  프로젝트 루트에서 실행하세요. (package.json 이 있는 디렉토리)
  실행 전 git commit 또는 stash 권장.
#>

[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Aggressive
)

$ErrorActionPreference = 'Stop'

# ============================================================
# 0. 사전 검증
# ============================================================
if (-not (Test-Path ".\package.json")) {
    Write-Host "❌ package.json 이 현재 디렉토리에 없습니다." -ForegroundColor Red
    Write-Host "   프로젝트 루트에서 실행하세요: cd <프로젝트폴더>" -ForegroundColor Yellow
    exit 1
}

$pkg = Get-Content ".\package.json" -Raw | ConvertFrom-Json
if ($pkg.name -ne 'bongtour') {
    Write-Host "⚠️  package.json의 name이 'bongtour'가 아닙니다: $($pkg.name)" -ForegroundColor Yellow
    $confirm = Read-Host "계속 진행하시겠습니까? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "중단했습니다." -ForegroundColor Yellow
        exit 0
    }
}

$mode = if ($Apply) { "APPLY (실제 실행)" } else { "DRY-RUN (미리보기만)" }
$modeColor = if ($Apply) { 'Red' } else { 'Cyan' }

Write-Host "`n=== Bongtour 정리 스크립트 ===" -ForegroundColor Cyan
Write-Host "모드: $mode" -ForegroundColor $modeColor
Write-Host "aggressive: $Aggressive" -ForegroundColor $modeColor
Write-Host ""

# ============================================================
# 1. 아카이브 디렉토리 준비
# ============================================================
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveRoot = ".\_archive\$timestamp"

if ($Apply) {
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
    Write-Host "📁 아카이브 대상: $archiveRoot`n" -ForegroundColor Green
} else {
    Write-Host "📁 (dry-run) 아카이브 예정 경로: $archiveRoot`n" -ForegroundColor Gray
}

$moveLog = @()
$deleteLog = @()

function Move-ToArchive {
    param([string]$Path, [string]$Reason)
    if (-not (Test-Path $Path)) { return }

    $script:moveLog += [PSCustomObject]@{
        Path = $Path
        Reason = $Reason
        Size = if ((Get-Item $Path) -is [System.IO.DirectoryInfo]) {
            "dir"
        } else {
            "{0:N0} bytes" -f (Get-Item $Path).Length
        }
    }

    if ($Apply) {
        $dest = Join-Path $archiveRoot $Path
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Move-Item -Path $Path -Destination $dest -Force
    }
}

function Remove-GitignoredFolder {
    param([string]$Path, [string]$Reason)
    if (-not (Test-Path $Path)) { return }

    $sizeInfo = try {
        $bytes = (Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue |
                  Measure-Object -Property Length -Sum).Sum
        "{0:N1} MB" -f ($bytes / 1MB)
    } catch { "?" }

    $script:deleteLog += [PSCustomObject]@{
        Path = $Path
        Reason = $Reason
        Size = $sizeInfo
    }

    if ($Apply) {
        Remove-Item -Path $Path -Recurse -Force
    }
}

# ============================================================
# 2. 루트 임시 파일 아카이브 (항상 실행)
# ============================================================
Write-Host "=== [1/4] 루트 임시/패치 파일 ===" -ForegroundColor Cyan

$rootJunkPatterns = @(
    '_agent_*.txt',
    '_str_replace_test.txt',
    '_tmp_*',
    '_patch-*',
    '_patch_*',
    '_klook-iframe-init.tmp.js',
    'tmp-*.json',
    'tmp-*.txt',
    'tmp_*.txt',
    'tmp_*.py',
    'patch_partner_org.py',
    'recent_changed_files.txt'
)

foreach ($pattern in $rootJunkPatterns) {
    Get-ChildItem -Path . -Filter $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
        Move-ToArchive -Path $_.Name -Reason "root temp/patch file"
    }
}

# 루트의 admin-secrets.ts (2줄짜리 스텁) — lib/admin-secrets.ts 와 다름, 혼란 유발
if (Test-Path ".\admin-secrets.ts") {
    $content = Get-Content ".\admin-secrets.ts" -Raw
    if ($content.Length -lt 200) {
        Move-ToArchive -Path "admin-secrets.ts" -Reason "root stub — use lib/admin-secrets.ts"
    } else {
        Write-Host "  ⚠️  admin-secrets.ts가 스텁보다 큼. 수동 확인 필요." -ForegroundColor Yellow
    }
}

# ============================================================
# 3. TypeScript 빌드 캐시
# ============================================================
Write-Host "`n=== [2/4] TypeScript 빌드 캐시 ===" -ForegroundColor Cyan

if (Test-Path ".\tsconfig.tsbuildinfo") {
    Remove-GitignoredFolder -Path "tsconfig.tsbuildinfo" -Reason "TS build cache (gitignored)"
}

# ============================================================
# 4. zip에만 포함됐던 gitignored 폴더 (로컬엔 원본 있음)
# ============================================================
Write-Host "`n=== [3/4] gitignored 폴더 정리 ===" -ForegroundColor Cyan
Write-Host "   (npm install 또는 prisma generate 하면 다시 생성됩니다)" -ForegroundColor Gray

$gitignoredFolders = @(
    @{ Path = "prisma-gen-runtime"; Reason = "Prisma 생성물 (gitignored, prisma generate로 재생성)" },
    @{ Path = "prisma-gen"; Reason = "Prisma 생성물 (gitignored)" },
    @{ Path = "debug\hanatour"; Reason = "디버그 덤프 (gitignored)" }
)

foreach ($item in $gitignoredFolders) {
    Remove-GitignoredFolder -Path $item.Path -Reason $item.Reason
}

# ============================================================
# 5. 공격적 모드: 구조 중복 아카이브
# ============================================================
if ($Aggressive) {
    Write-Host "`n=== [4/4] 공격적 정리 (구조 중복) ===" -ForegroundColor Cyan

    # BONGTOUR 폴더 — lib/ 와 3개 파일 중복 (내용 서로 다름!)
    if (Test-Path ".\BONGTOUR") {
        Move-ToArchive -Path "BONGTOUR" -Reason "Duplicate of lib/ with stale content — review before keeping"
    }

    if (Test-Path ".\BONGTOUR_TMP_TEST.txt") {
        Move-ToArchive -Path "BONGTOUR_TMP_TEST.txt" -Reason "test file"
    }

    # DEV 폴더 — 한진투어 미완 코드 15개 + debug script
    if (Test-Path ".\DEV") {
        Move-ToArchive -Path "DEV" -Reason "Hanjintour integration in progress — merge to lib/ or keep in branch"
    }

    # pages 폴더 — App Router 프로젝트인데 Pages Router 잔재
    if (Test-Path ".\pages") {
        Move-ToArchive -Path "pages" -Reason "Pages Router remnant in App Router project — review"
    }

    # backups 폴더 — travel_reviews backup JSON
    if (Test-Path ".\backups") {
        $backupFiles = Get-ChildItem ".\backups" -File
        if ($backupFiles.Count -gt 0) {
            Move-ToArchive -Path "backups" -Reason "Old DB backups — consider moving to cloud storage"
        }
    }

    # public/errors, public/uploads — 둘 다 gitignored
    if (Test-Path ".\public\errors") {
        Remove-GitignoredFolder -Path "public\errors" -Reason "Error screenshots (gitignored)"
    }
} else {
    Write-Host "`n=== [4/4] 공격적 정리 스킵 ===" -ForegroundColor Gray
    Write-Host "   BONGTOUR/, DEV/, pages/ 등도 정리하려면 -Aggressive 플래그 추가" -ForegroundColor Gray
}

# ============================================================
# 6. 결과 리포트
# ============================================================
Write-Host "`n`n=============================================" -ForegroundColor Cyan
Write-Host "                정리 리포트" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`n📦 아카이브 대상 (_archive/$timestamp 로 이동):" -ForegroundColor Yellow
if ($moveLog.Count -eq 0) {
    Write-Host "   (없음)" -ForegroundColor Gray
} else {
    $moveLog | Format-Table -AutoSize Path, Size, Reason
}

Write-Host "🗑️  완전 삭제 대상 (gitignored, 복구 필요 없음):" -ForegroundColor Yellow
if ($deleteLog.Count -eq 0) {
    Write-Host "   (없음)" -ForegroundColor Gray
} else {
    $deleteLog | Format-Table -AutoSize Path, Size, Reason
}

Write-Host "=============================================" -ForegroundColor Cyan

if ($Apply) {
    Write-Host "`n✅ 완료!" -ForegroundColor Green
    Write-Host "   이동된 파일들은 _archive/$timestamp 에서 복원 가능합니다." -ForegroundColor Gray
    Write-Host "   확인 후 문제 없으면 _archive 폴더를 삭제하세요." -ForegroundColor Gray
    Write-Host ""
    Write-Host "다음 단계:" -ForegroundColor Cyan
    Write-Host "  1. git status 로 변경사항 확인" -ForegroundColor White
    Write-Host "  2. npm run build 로 빌드 테스트" -ForegroundColor White
    Write-Host "  3. npm run dev 로 동작 확인" -ForegroundColor White
    Write-Host "  4. 문제 없으면 git commit" -ForegroundColor White
} else {
    Write-Host "`n💡 위 내용은 '미리보기'입니다. 실제로는 아무것도 바뀌지 않았습니다." -ForegroundColor Cyan
    Write-Host "   실제 실행하려면: .\scripts\01-cleanup-project.ps1 -Apply" -ForegroundColor White
    if (-not $Aggressive) {
        Write-Host "   공격적 정리 포함:   .\scripts\01-cleanup-project.ps1 -Apply -Aggressive" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "⚠️  실행 전 권장:" -ForegroundColor Yellow
    Write-Host "   - git commit 또는 git stash 로 현재 상태 저장" -ForegroundColor White
    Write-Host "   - npm run build 한 번 돌려서 깨끗한 상태인지 확인" -ForegroundColor White
}
Write-Host ""
