/**
 * @deprecated 대신 `e2e-modetour-mandatory.ts` 사용 (modetour 필수 + HTTP E2E).
 * 이 파일은 modetour 상품 없을 때 exit 1 만 하는 짧은 진단용으로 유지.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { prisma } from '../lib/prisma'

async function main() {
  const product = await prisma.product.findFirst({
    where: { brand: { brandKey: 'modetour' } },
    select: { id: true, title: true },
  })
  if (!product) {
    console.error('[진단] brandKey=modetour 상품 없음. e2e-modetour-mandatory.ts 는 실행할 수 없습니다.')
    process.exit(1)
    return
  }
  console.log('modetour 상품 존재:', product.id, product.title?.slice(0, 60))
  console.log('전체 E2E: npx tsx scripts/e2e-modetour-mandatory.ts')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
