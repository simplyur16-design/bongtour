/**
 * 자동 등록 전환 허용 목록(문과장 사진 검수 통과분만) — 봉실장 10/31 10:31 지시:
 * "등록 전환은 문과장이 사진을 통과시킨 상품만. 새로 채운 상품은 검수 통과 뒤 다음 배치에서."
 * - 목록에 없으면 자동 검사를 통과해도 registered 로 바꾸지 않고 '사진 검수 대기'로 남긴다.
 * - 목록에 넣는 것은 문과장 검수 통과 기록이 있는 상품만, 커밋으로만.
 * 2026-10-31 1차(48개 중 20): 교체 후 통과 14 + 기존 통과 6. 출처 기록 없음 20·용량 초과 7·#16 은 재검수 뒤 추가.
 * REGRESSION-FREEZE[auto-register-review-pass]: FLIP 이어도 검수 통과 목록 밖 상품은 등록 전환 안 함 — manifest
 */
export const AUTO_REGISTER_REVIEW_PASS_IDS: readonly string[] = [
  'cmv4piesd003214itc6pwjvj2', // #2 pkg-hn-0168
  'cmvjmfmn00gi53z00cirafoqz', // #4 pkg-yb-0148
  'cmvcjz78h1xke1wlkragkr60r', // #8 pkg-mt-0297
  'cmv3pm575077pd11evkefyacj', // #11 pkg-yb-0103
  'cmusembtg005p11e2o6ocpnm5', // #14 pkg-hn-0123
  'cmte6t3vy01ajnd9utuk01sef', // #18 fit-xx-0001
  'cmvh7k1cu0dcnaicvibm5ags2', // #19 fit-mt-0066
  'cmv84kka0002a1wlkm66phptu', // #25 pkg-hn-0186
  'cmv9jwr9n0i2p1wlkj6ix1gg4', // #27 pkg-hn-0187
  'cmvjnl58l0h4n3z002r51wd44', // #31 pkg-vg-0098
  'cmv8lxkr707fw1wlkn8d78suk', // #34 pkg-mt-0276
  'cmv4q1xv000r014it9egbof1v', // #35 pkg-hn-0178
  'cmvjsxim20l2v3z00l9cqphcc', // #36 pkg-vg-0100
  'cmv4t6bgd0mkdvfap8az2nueo', // #38 pkg-vg-0080
  'cmv6po84m000757k1x714hoch', // #42 pkg-hn-0181
  'cmv6qcu2d002557k1jhoijn8k', // #43 pkg-hn-0183
  'cmvmmzwfw09jx3byyt9s2oum4', // #44 pkg-vg-0104
  'cmvi5xxb700f03z006k9e5h97', // #45 pkg-mt-0314
  'cmvb6vequ1db01wlkggbhpef3', // #46 pkg-vg-0091
  'cmv4ut2fh00oodnoatdgejh21', // #48 pkg-lt-0120
] as const

const PASS = new Set(AUTO_REGISTER_REVIEW_PASS_IDS)

export function isAutoRegisterReviewPassed(productId: string): boolean {
  return PASS.has(productId)
}
