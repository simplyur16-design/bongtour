/**
 * 잘못 채워진 사진 칸 교체(사장님 2026-11-28 00:03 '잘못 채워진 칸 교체 구조 고쳐서 검사 통과하면 병합·배포해').
 * - 빈칸만이 아니라 이미 든 사진도 판정한다: 그날 공급사 원문 명소와 다른 사진, 지도·간판·노선도 등 글 위주 사진,
 *   AI(Gemini) 생성 사진, 흑백 표시 사진, 상품 안 중복 사진.
 * - 교체는 실사진 경로(풀 → Pexels → Openverse/Wikimedia CC0·PD → Unsplash)만 쓴다. 이미지 생성 없음.
 * - 실사진을 못 찾으면 기존 사진을 지우지 않고 그대로 두며 예외 목록에 사유를 남긴다(빈칸으로 만들지 않음).
 * - 교체 전 값은 AssetUsageLog(heal-day / heal-cover, notes 의 prev)에 남는다(되돌림 가능).
 * - 공개 상품: 사진 칸만, 관리자가 고른 칸 제외, 저장 시 registered 상태·같은 일정일 때만 쓴다. 근거가 확실한 불일치만(저장된 명소가 그날 원문 명소에 없음).
 * - 한 실행 교체 상한으로 외부 검색 쿼터를 지킨다(Unsplash 45/h 등 기존 가드는 그대로).
 * REGRESSION-FREEZE[photo-replace-wrong-1128]: 기존 사진 판정·교체, 못 찾으면 유지, 실행 상한 — manifest
 */
import {
  STORED_SIGHT_MISMATCH_DETAIL,
  WRONG_PHOTO_REPLACE_REASONS,
  type RegistrationPhotoBlock,
} from '@/lib/register-photo-registration-gate'

/** 한 실행에서 바꿀 수 있는 칸 수(등록대기 + 공개 합계) */
export const WRONG_PHOTO_REPLACE_MAX_PER_RUN = 12
/** 그중 공개 상품 몫 */
export const WRONG_PHOTO_REPLACE_PUBLIC_MAX_PER_RUN = 6
/** 공개 상품을 한 실행에 판정하는 상품 수(사진 측정 없음, DB 글만). 판정이 상품당 ~0.1초라 60개씩 돌려 753개를 반나절에 한 바퀴 */
export const WRONG_PHOTO_REPLACE_PUBLIC_SCAN_PER_RUN = 60

/** 실행 상한 카운터 */
export function createRunBudget(max: number): { take: () => boolean; used: () => number } {
  let n = 0
  return {
    take: () => {
      if (n >= max) return false
      n++
      return true
    },
    used: () => n,
  }
}

/**
 * 공개 상품에서 교체할 칸만 남긴다.
 * - 그날 명소 불일치는 '저장된 명소가 그날 원문 명소에 없음'(확실한 근거)만. 근거 없음(unverified)·글 없음은 건드리지 않는다.
 * - 대표 사진은 AI 생성만(목록 카드 보호). 인물·무관(제목 글 판정)은 공개 상품에서 제외.
 * - 용량·해상도·측정은 기존 야간·매시 점검 몫이라 여기서 다루지 않는다.
 */
export function publicWrongPhotoBlocks(blocks: readonly RegistrationPhotoBlock[]): RegistrationPhotoBlock[] {
  return blocks.filter((b) => {
    if (!WRONG_PHOTO_REPLACE_REASONS.has(b.reason)) return false
    // 인물·무관 사진 판정은 제목 글 기준이라 공개 상품에서는 오탐(풍경 속 사람)이 많아 교체하지 않는다(등록대기 힐은 기존대로)
    if (b.reason === 'photo_irrelevant_subject') return false
    if (b.kind === 'cover') return b.reason === 'photo_ai_generated'
    if (b.reason === 'photo_sight_mismatch') return b.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL)
    return true
  })
}

/** 공개 상품 판정 순서: 시각마다 시작 위치를 돌려 같은 상품이 앞을 막지 않게 한다 */
export function rotateForHour<T>(rows: readonly T[], now: Date, take: number): T[] {
  if (rows.length === 0) return []
  const hour = Math.floor(now.getTime() / 3_600_000)
  const start = (hour * 37) % rows.length
  const out: T[] = []
  for (let i = 0; i < Math.min(take, rows.length); i++) out.push(rows[(start + i) % rows.length]!)
  return out
}
