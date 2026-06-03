/**
 * 솔라피 카카오 템플릿 본문·변수 확인 (운영 디버그).
 * Usage: npx tsx scripts/inspect-solapi-kakao-template.ts [templateId]
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const key = process.env.SOLAPI_API_KEY?.trim()
  const secret = process.env.SOLAPI_API_SECRET?.trim()
  const tid =
    process.argv[2]?.trim() ||
    process.env.SOLAPI_TPL_PRIVATE_QUOTE?.trim() ||
    process.env.SOLAPI_TPL_BUS?.trim() ||
    ''

  if (!key || !secret) {
    console.error('SOLAPI_API_KEY / SOLAPI_API_SECRET 필요 (.env.local)')
    process.exit(1)
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const paths = [
    `/kakao/v2/templates/${tid}`,
    `/kakao/v1/templates/${tid}`,
    `/kakao/v2/templates?templateId=${encodeURIComponent(tid)}`,
  ]

  for (const p of paths) {
    const url = `https://api.solapi.com${p}`
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
    const body = await res.text()
    console.log('\n---', url, res.status, '---')
    try {
      console.log(JSON.stringify(JSON.parse(body), null, 2).slice(0, 4000))
    } catch {
      console.log(body.slice(0, 2000))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
