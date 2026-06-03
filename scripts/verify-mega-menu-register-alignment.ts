/**
 * 메가메뉴 도시 leaf ↔ 등록·browse·트리 정합 (DB 불필요).
 *   npm run verify:mega-menu-register-alignment
 */
import { auditMegaMenuCityLeafRegisterAlignment } from '@/lib/mega-menu-register-alignment-audit'

function main(): void {
  const report = auditMegaMenuCityLeafRegisterAlignment()
  const summary = {
    cityLeavesChecked: report.cityLeavesChecked,
    ok: report.ok,
    blockingCount: report.blockingCount,
    warningOnlyCount: report.warningOnlyCount,
    sample: report.rows.slice(0, 30),
  }
  console.log(JSON.stringify(summary, null, 2))
  if (report.blockingCount > 0) {
    console.error(
      `\n[verify:mega-menu-register-alignment] ${report.blockingCount} city leaf(es) block browse/tags (missing slug, browse keys, or SSOT haystack).`,
    )
    process.exit(1)
  }
  if (report.warningOnlyCount > 0) {
    console.warn(
      `\n[verify:mega-menu-register-alignment] ${report.warningOnlyCount} leaf(es) have tree/match alias warnings (non-blocking).`,
    )
  }
  console.log('\n[verify:mega-menu-register-alignment] OK — all city leaves align.')
}

main()
