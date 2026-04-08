/**
 * POST /api/agent/scrape
 * API 미존재 대응 지능형 가격 탈취 — Phase 1~5, 스트리밍 로그, 재시도(스크린샷→LLM), 경로 이탈 보고
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import {
  launchAgentBrowser,
  newAgentPage,
  humanDelay,
  humanDelayLong,
  getPageSummary,
  captureErrorScreenshot,
  captureBase64,
  humanMouseCurveThenClick,
  humanHover,
  scrollIntoViewIfNeeded,
} from '@/lib/agent-browser'
import { findSelectorForStep, findSelectorWithImage } from '@/lib/agent-llm-selector'
import type { SelectorTask } from '@/lib/agent-llm-selector'

const MAX_SELECTOR_RETRIES = 3

type CalendarRow = {
  date: string
  priceAdult: number
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
  status: string
}

type StreamEvent =
  | { t: 'log'; msg: string }
  | { t: 'result'; rows: CalendarRow[] }
  | { t: 'error'; msg: string; screenshot?: string }

function push(controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'))
}

/** selector로 요소 찾아 휴먼 곡선 클릭. 실패 시 evaluate 클릭 시도 */
async function clickBySelector(
  page: Awaited<ReturnType<typeof newAgentPage>>,
  selector: string
): Promise<boolean> {
  const ok = await humanMouseCurveThenClick(page, selector)
  if (ok) return true
  try {
    await page.evaluate((s) => {
      const el = document.querySelector(s)
      if (el && el instanceof HTMLElement) el.click()
    }, selector.trim())
    return true
  } catch {
    return false
  }
}

/** 한 단계에 대해 최대 3회 재시도 (실패 시 base64 캡처 → LLM). 실패 시 스크린샷 경로 반환. */
async function findAndClickWithRetry(
  page: Awaited<ReturnType<typeof newAgentPage>>,
  task: SelectorTask,
  summary: string,
  log: (msg: string) => void,
  pushError: (event: StreamEvent) => void,
  stepLabel: string
): Promise<{ ok: true } | { ok: false; screenshot: string }> {
  for (let attempt = 1; attempt <= MAX_SELECTOR_RETRIES; attempt++) {
    const base64 = attempt > 1 ? await captureBase64(page) : undefined
    if (attempt > 1) log(`${stepLabel} 재시도 (${attempt}/${MAX_SELECTOR_RETRIES}) — 화면 캡처 후 LLM 재분석`)
    const selector = await findSelectorWithImage(summary, task, base64)
    if (!selector) {
      if (attempt === MAX_SELECTOR_RETRIES) {
        const screenshot = await captureErrorScreenshot(page, stepLabel)
        pushError({ t: 'error', msg: `${stepLabel} 식별 실패. 경로 이탈: 여행사 UI 변경 감지`, screenshot })
        return { ok: false, screenshot }
      }
      await humanDelay()
      continue
    }
    const ok = await clickBySelector(page, selector)
    if (ok) return { ok: true }
    if (attempt === MAX_SELECTOR_RETRIES) {
      const screenshot = await captureErrorScreenshot(page, stepLabel)
      pushError({ t: 'error', msg: `${stepLabel} 클릭 실패`, screenshot })
      return { ok: false, screenshot }
    }
    await humanDelay()
  }
  const screenshot = await captureErrorScreenshot(page, stepLabel)
  return { ok: false, screenshot }
}

/** 달력 HTML → LLM으로 [날짜, 성인/아동베드/아동노베드/유아, 상태] 추출 */
async function extractCalendarWithLLM(calendarHtml: string): Promise<CalendarRow[]> {
  const { getGenAI, getModelName, geminiTimeoutOpts } = await import('@/lib/gemini-client')
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `아래는 여행 출발일 달력/테이블 HTML이다.
각 출발일별로 다음을 추출하라:
- date: YYYY-MM-DD
- priceAdult: 성인 요금 (숫자만)
- priceChildWithBed: 아동 베드 포함 요금 (없으면 null)
- priceChildNoBed: 아동 노베드 요금 (없으면 null)
- priceInfant: 유아 요금 (없으면 null)
- status: 출발확정 | 예약가능 | 마감

HTML:
${calendarHtml.slice(0, 8000)}

응답은 반드시 JSON 배열만. 예:
[{"date":"2025-04-01","priceAdult":1890000,"priceChildWithBed":1690000,"priceChildNoBed":1590000,"priceInfant":100000,"status":"예약가능"}]
다른 설명 없이 JSON만.`

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const text = result.response.text()?.trim() ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0]) as Array<{
      date?: string
      priceAdult?: number
      priceChildWithBed?: number | null
      priceChildNoBed?: number | null
      priceInfant?: number | null
      status?: string
    }>
    return arr
      .filter((r) => r.date && r.priceAdult != null)
      .map((r) => ({
        date: String(r.date).slice(0, 10),
        priceAdult: Number(r.priceAdult),
        priceChildWithBed: r.priceChildWithBed != null ? Number(r.priceChildWithBed) : null,
        priceChildNoBed: r.priceChildNoBed != null ? Number(r.priceChildNoBed) : null,
        priceInfant: r.priceInfant != null ? Number(r.priceInfant) : null,
        status: ['출발확정', '예약가능', '마감'].includes(String(r.status)) ? String(r.status) : '예약가능',
      }))
  } catch {
    return []
  }
}

/** 경로 이탈 보고서 DB 저장 */
async function createPathDeviationReport(
  productId: number | null,
  step: string,
  screenshotPath: string | null
): Promise<void> {
  await prisma.agentScrapeReport.create({
    data: {
      productId: productId != null ? String(productId) : undefined,
      step,
      message: '경로 이탈: 여행사 UI 변경 감지',
      screenshotPath: screenshotPath ?? undefined,
    },
  })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  let body: {
    mainUrl?: string
    countryName?: string
    productCodeOrTitle?: string
    productId?: number
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }

  const mainUrl = (body.mainUrl || '').trim() || 'https://www.hanatour.com'
  const countryName = (body.countryName || '').trim()
  const productCodeOrTitle = (body.productCodeOrTitle || '').trim()
  const productId = body.productId != null ? Number(body.productId) : null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const log = (msg: string) => push(controller, { t: 'log', msg })
      const pushError = (event: StreamEvent) => {
        if (event.t === 'error') push(controller, event)
      }

      let browser: Awaited<ReturnType<typeof launchAgentBrowser>> | undefined
      try {
        browser = await launchAgentBrowser()
        const page = await newAgentPage(browser)
        log('[STEP 0] 브라우저 세션 초기화 완료. Stealth 활성화.')
        await page.goto(mainUrl, { waitUntil: 'networkidle2', timeout: 30000 })
        await new Promise((r) => setTimeout(r, 3000))
        log('[STEP 1] 메인 URL 접속 완료. 세션 안정화 3초 대기.')

        await humanDelayLong()

        // Phase 1: 해외여행 (호버 후 클릭)
        log('[Phase 1] 해외여행 메뉴 식별 중...')
        const summary1 = await getPageSummary(page)
        const task1: SelectorTask = {
          step: '해외여행',
          instruction: '메인 페이지에서 "해외여행" 또는 "패키지" 메뉴로 들어가는 링크/버튼을 하나 골라라.',
        }
        let phase1Ok = false
        for (let attempt = 1; attempt <= MAX_SELECTOR_RETRIES; attempt++) {
          const base64 = attempt > 1 ? await captureBase64(page) : undefined
          if (attempt > 1) log('해외여행 재시도 — 화면 캡처 후 LLM 재분석')
          const sel1 = await findSelectorWithImage(summary1, task1, base64)
          if (!sel1) {
            if (attempt === MAX_SELECTOR_RETRIES) {
              const screenshot = await captureErrorScreenshot(page, '해외여행')
              push(controller, { t: 'error', msg: '해외여행 메뉴 식별 실패. 경로 이탈: 여행사 UI 변경 감지', screenshot })
              await createPathDeviationReport(productId, '해외여행', screenshot)
              controller.close()
              return
            }
            await humanDelay()
            continue
          }
          try {
            await humanHover(page, sel1)
            await humanDelay()
          } catch {
            // hover 생략 후 클릭만
          }
          const clicked = await clickBySelector(page, sel1)
          if (clicked) {
            phase1Ok = true
            break
          }
          if (attempt === MAX_SELECTOR_RETRIES) {
            const screenshot = await captureErrorScreenshot(page, '해외여행')
            push(controller, { t: 'error', msg: '해외여행 클릭 실패', screenshot })
            await createPathDeviationReport(productId, '해외여행', screenshot)
            controller.close()
            return
          }
          await humanDelay()
        }
        if (!phase1Ok) {
          controller.close()
          return
        }
        log('[Phase 1] 해외여행 메뉴 호버 후 클릭 완료.')
        await humanDelayLong()

        // Phase 2: 국가/지역 (일본-오사카, 동남아-다낭 등)
        if (countryName) {
          log(`[Phase 2] ${countryName} 지역 진입 식별 중...`)
          const summary2 = await getPageSummary(page)
          const task2: SelectorTask = { step: '국가', instruction: '', countryName }
          const res2 = await findAndClickWithRetry(page, task2, summary2, log, pushError, '국가')
          if (!res2.ok) {
            await createPathDeviationReport(productId, '국가', res2.screenshot)
            controller.close()
            return
          }
          log(`${countryName} 상품 리스트 진입 성공.`)
          await humanDelayLong()
        }

        // Phase 3: 상품 식별 후 스크롤·클릭, then [판매상품보기] 또는 화살표
        if (productCodeOrTitle) {
          log('[Phase 3] 상품 리스트에서 대상 스크롤·진입 중...')
          const summary3 = await getPageSummary(page)
          const task3: SelectorTask = { step: '상품', instruction: '', productCodeOrTitle }
          const sel3 = await findSelectorWithImage(summary3, task3)
          if (sel3) await scrollIntoViewIfNeeded(page, sel3)
          const res3 = await findAndClickWithRetry(page, task3, summary3, log, pushError, '상품')
          if (!res3.ok) {
            await createPathDeviationReport(productId, '상품', res3.screenshot)
            controller.close()
            return
          }
          log('상품 상세 페이지 진입 성공.')
          await humanDelayLong()

          log('[Phase 3] 판매상품보기·날짜별 리스트 활성화 버튼 식별 중...')
          const summary3b = await getPageSummary(page)
          const task3b: SelectorTask = {
            step: '판매상품보기',
            instruction: '상품 우측 하단의 [판매상품보기] 또는 화살표 버튼을 골라서 날짜별 상세 리스트/달력 섹션을 여는 요소를 하나 골라라.',
          }
          const res3b = await findAndClickWithRetry(page, task3b, summary3b, log, pushError, '판매상품보기')
          if (res3b.ok) log('판매상품보기 클릭, 날짜별 상세 리스트 활성화.')
          await humanDelayLong()
        }

        // Phase 4: 달력 트리거
        log('[Phase 4] 달력 보기·예약/출발일 선택 버튼 식별 중...')
        const summary4 = await getPageSummary(page)
        const task4: SelectorTask = {
          step: '달력',
          instruction: '출발일 확인, 달력 보기, 예약하기, 일정/가격 보기 등 달력을 띄우는 버튼이나 링크를 하나 골라라.',
        }
        const res4 = await findAndClickWithRetry(page, task4, summary4, log, pushError, '달력')
        if (!res4.ok) {
          await createPathDeviationReport(productId, '달력', res4.screenshot)
          controller.close()
          return
        }
        log('달력 보기 버튼 클릭, 달력 노출 대기 중...')
        await humanDelayLong()

        await new Promise((r) => setTimeout(r, 2000))
        const calendarSelector = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table'))
          for (let i = 0; i < tables.length; i++) {
            const t = tables[i]
            const text = t.innerText || ''
            if (text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/) && text.match(/\d{1,3}(,\d{3})*/)) return 'table'
          }
          const cal = document.querySelector('[class*="calendar"], [class*="Calendar"], [id*="calendar"]')
          if (cal) return '[class*="calendar"], [id*="calendar"]'
          return null
        })
        const waitSel = calendarSelector || 'table'
        try {
          await page.waitForSelector(waitSel, { timeout: 8000 })
        } catch {
          // continue
        }

        // Phase 5: 달력 다중 월 수확 (현재 월 + [>] 다음 달 반복, 최대 3개월)
        const allRows: CalendarRow[] = []
        const seenDates = new Set<string>()
        const maxMonths = 3
        for (let monthIdx = 0; monthIdx < maxMonths; monthIdx++) {
          const calendarHtml = await page.evaluate(() => {
            const el = document.querySelector('table') || document.querySelector('[class*="calendar"]') || document.body
            return el ? el.outerHTML.slice(0, 15000) : ''
          })
          const monthRows = await extractCalendarWithLLM(calendarHtml)
          const newOnes = monthRows.filter((r) => !seenDates.has(r.date))
          newOnes.forEach((r) => {
            seenDates.add(r.date)
            allRows.push(r)
          })
          const monthLabel = monthIdx === 0 ? '현재 월' : `${monthIdx + 1}월차`
          log(`${monthLabel} 달력 데이터 수확 완료. ${monthRows.length}건 (누적 ${allRows.length}건)`)
          if (monthIdx === maxMonths - 1) break
          const summaryNext = await getPageSummary(page)
          const taskNext: SelectorTask = {
            step: '다음달',
            instruction: '달력에서 다음 달로 넘기는 [>] 버튼 또는 "다음 달", "다음달" 텍스트가 있는 버튼/링크를 하나 골라라.',
          }
          const nextSel = await findSelectorWithImage(summaryNext, taskNext)
          if (!nextSel || !(await clickBySelector(page, nextSel))) break
          log('다음 달 달력으로 이동 중...')
          await humanDelayLong()
          await new Promise((r) => setTimeout(r, 1500))
        }
        const rows = allRows
        log(`[Phase 5] 달력 수확 완료. 총 ${rows.length}건 (날짜·성인요금·예약상태)`)

        if (rows.length > 0) push(controller, { t: 'result', rows })

        if (productId != null && rows.length > 0) {
          const pid = String(productId)
          const existing = await prisma.productPrice.findMany({
            where: { productId: pid },
            select: { date: true, adult: true },
          })
          const prevByDate = new Map<string, number>()
          existing.forEach((p) => {
            const d = p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date).slice(0, 10)
            prevByDate.set(d, p.adult)
          })
          const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date))
          for (let i = 0; i < sortedRows.length; i++) {
            const r = sortedRows[i]
            const prevPrice = i > 0 ? sortedRows[i - 1].priceAdult : prevByDate.get(r.date) ?? null
            const priceGap = prevPrice != null ? r.priceAdult - prevPrice : null
            try {
              await prisma.productPrice.upsert({
                where: {
                  productId_date: { productId: pid, date: new Date(r.date) },
                },
                create: {
                  productId: pid,
                  date: new Date(r.date),
                  adult: r.priceAdult,
                  childBed: r.priceChildWithBed ?? 0,
                  childNoBed: r.priceChildNoBed ?? 0,
                  infant: r.priceInfant ?? 0,
                  priceGap: priceGap ?? 0,
                },
                update: {
                  adult: r.priceAdult,
                  childBed: r.priceChildWithBed ?? 0,
                  childNoBed: r.priceChildNoBed ?? 0,
                  infant: r.priceInfant ?? 0,
                  priceGap: priceGap ?? 0,
                },
              })
            } catch (e) {
              log(`DB upsert 실패 ${r.date}: ${String(e)}`)
            }
          }
          log('DB 반영 완료. priceAdult, priceChildWithBed, priceChildNoBed, priceInfant, priceGap 매핑 저장.')
        }

        await browser.close()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        push(controller, { t: 'error', msg })
        try {
          if (typeof browser !== 'undefined') await browser.close()
        } catch {
          // ignore
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
