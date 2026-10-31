/**
 * 자동 등록 전환 허용 목록(문과장 사진 검수 통과분만) — 봉실장 10/31 10:31 지시:
 * "등록 전환은 문과장이 사진을 통과시킨 상품만. 새로 채운 상품은 검수 통과 뒤 다음 배치에서."
 * - 목록에 없으면 자동 검사를 통과해도 registered 로 바꾸지 않고 '사진 검수 대기'로 남긴다.
 * - 목록에 넣는 것은 문과장 검수 통과 기록이 있는 상품만, 커밋으로만.
 * 2026-10-31 1차(48개 중 20): 교체 후 통과 14 + 기존 통과 6. 출처 기록 없음 20·용량 초과 7·#16 은 재검수 뒤 추가.
 * 2026-10-31 2차(45): 1차 20 중 18 + rework2 통과 26 + #14(11:37 2차 사진 통과). 보류: #46·#16(조건 충족 뒤 커밋으로 추가), 불합격: #32.
 * REGRESSION-FREEZE[auto-register-review-pass]: FLIP 이어도 검수 통과 목록 밖 상품은 등록 전환 안 함 — manifest
 */
export const AUTO_REGISTER_REVIEW_PASS_IDS: readonly string[] = [
  // 1차 통과(10:31) 19개 — #14 hn-0123 은 D2-2(17177476)/D4-2(38015799) 2차 통과(11:37) 후 포함, #46 vg-0091(라이브 크레딧 미노출 캡처 대기) 제외
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
  'cmv4ut2fh00oodnoatdgejh21', // #48 pkg-lt-0120
  // 2차 재검수 통과(rework2, 11:32) 26개 — #16(slug 없음 확인 대기) 제외, #32 hn-0184 불합격 제외
  'cmv3r8pvm0b5jd11ek6l83zf7', // #1 pkg-ky-0025
  'cmv4woe6b000711kca3ro5d3b', // #3 pkg-ky-0040
  'cmvl0hm9m00mobobhhxsn81ut', // #5 pkg-yb-0149
  'cmvgqr8hy010laicv4eza58ht', // #6 pkg-yb-0140
  'cmv4n40br00wlfgblakw6z8r7', // #7 pkg-mt-0240
  'cmtd8mq7n05hxea0f09yez82m', // #9 pkg-xx-0001
  'cmv3twcal0ea4d11ek84bkjz0', // #10 pkg-lt-0093
  'cmtwvblb5005pp3k8z6bpinro', // #12 pkg-yb-0095
  'cmv2mem8d00q6zmu5bxh2e3v4', // #13 pkg-yb-0097
  'cmv85i3kq002z1wlky5ql4i51', // #15 pkg-mt-0267
  'cmteidvtt05rpgh46dglatkha', // #17 pkg-lt-0060
  'cmuy4oupf001uuqknso0t71j6', // #20 pkg-hn-0130
  'cmv4685xp03h5er04mis5tmtu', // #21 pkg-lt-0107
  'cmv469ix103vxer04mh5cp33p', // #22 pkg-lt-0108
  'cmv4v7imr019rdnoavztb0w2u', // #23 pkg-lt-0124
  'cmv47ba4c0ayger048kob5c99', // #24 fit-lt-0005
  'cmv4prm9e00bn14itn7xa453k', // #26 pkg-hn-0172
  'cmuzouo810053efxcru45fi9s', // #28 pkg-mt-0228
  'cmv9k0uwz0i5r1wlkpmvkgjdw', // #29 pkg-hn-0189
  'cmv4qk3hn00ya14it37vfyxev', // #30 pkg-mt-0242
  'cmtg15otl01vqt0fpckhws473', // #33 pkg-vg-0044
  'cmtlohd0s05g3qihbqzxl9vlg', // #37 pkg-vg-0046
  'cmv4qf3p600wz14it0a63p8ry', // #39 pkg-mt-0241
  'cmtczelvt022iq1f5hkefl3yh', // #40 pkg-yb-0056
  'cmv4sfp5b08i6vfap4ck0mvgq', // #41 pkg-yb-0120
  'cmv4svilh0l5bvfap9sa8fuav', // #47 pkg-vg-0075
] as const

const PASS = new Set(AUTO_REGISTER_REVIEW_PASS_IDS)

export function isAutoRegisterReviewPassed(productId: string): boolean {
  return PASS.has(productId)
}
