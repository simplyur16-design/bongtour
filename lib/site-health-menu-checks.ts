/**
 * 매시 점검 — 메가메뉴 항목(사장님 2026-11-22 00:50 메뉴 자동 정리). 기록만 한다(kind 'code').
 * - menu-hidden-empty: 공개 상품 0이라 자동으로 숨겨진 메뉴 링크(정보).
 * - menu-shown-empty: 메뉴에 보이는데(수>0) 실제 목록 API가 0건 — 손님이 빈 목록을 보게 되는 링크.
 * - menu-broken-link: 메뉴 링크 페이지가 200이 아님.
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 매시 빈 메뉴·깨진 링크 점검 — manifest
 */
import type { HealthCheck, HealthFinding } from '@/lib/site-health-registry'
import type { MegaMenuLiveCounts } from '@/lib/mega-menu-live-menu'

export type MenuLinkProbe = { href: string; pageStatus: number; listTotal: number | null }

export type MenuHealthCtx = {
  /** 메뉴 원본 링크 전체 */
  hrefs: string[]
  counts: MegaMenuLiveCounts | null
  /** 이번 실행에서 실제로 읽어 본 링크(표본) */
  probes: MenuLinkProbe[]
}

const f = (checkId: string, href: string, detail: string): HealthFinding => ({ checkId, target: href, detail })

export const MENU_HEALTH_CHECKS: ReadonlyArray<HealthCheck<MenuHealthCtx>> = [
  {
    id: 'menu-hidden-empty',
    area: 'menu',
    kind: 'code',
    summary: '공개 상품 0이라 자동 숨김된 메뉴 링크',
    find: (ctx) => (ctx.counts ? ctx.hrefs.filter((h) => ctx.counts![h] === 0).map((h) => f('menu-hidden-empty', h, 'count 0 (hidden)')) : []),
  },
  {
    id: 'menu-shown-empty',
    area: 'menu',
    kind: 'code',
    summary: '메뉴에 보이는데 목록이 0건',
    find: (ctx) =>
      ctx.probes
        .filter((p) => p.listTotal === 0 && (ctx.counts?.[p.href] ?? 1) > 0)
        .map((p) => f('menu-shown-empty', p.href, `count ${ctx.counts?.[p.href] ?? '?'} list 0`)),
  },
  {
    id: 'menu-broken-link',
    area: 'menu',
    kind: 'code',
    summary: '메뉴 링크 페이지가 200 아님',
    // 연결 실패(0)는 일시 장애로 보고 건너뜀
    find: (ctx) =>
      ctx.probes.filter((p) => p.pageStatus !== 0 && p.pageStatus !== 200).map((p) => f('menu-broken-link', p.href, `HTTP ${p.pageStatus}`)),
  },
]
