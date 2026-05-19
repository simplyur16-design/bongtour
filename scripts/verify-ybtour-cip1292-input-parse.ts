/**
 * ybtour CIP1292-260521ZE00 — 항공·쇼핑·옵션 정형 입력란 결정론 파싱 스모크.
 * 실행: npx tsx scripts/verify-ybtour-cip1292-input-parse.ts
 */
import fs from 'fs'
import path from 'path'
import {
  parseYbtourFlightInput,
  parseYbtourOptionalInput,
  parseYbtourShoppingInput,
} from '../lib/register-input-parse-ybtour'

const FIX = path.join(__dirname, 'fixtures')
const PREFIX = 'ybtour-cip1292-260521ZE00'

function read(suffix: string) {
  return fs.readFileSync(path.join(FIX, `${PREFIX}-${suffix}`), 'utf8')
}

function main() {
  const airline = read('paste-airline.txt')
  const shopping = read('paste-shopping.txt')
  const optional = read('paste-optional.txt')

  const flight = parseYbtourFlightInput(airline, null)
  const shop = parseYbtourShoppingInput(shopping, shopping)
  const opt = parseYbtourOptionalInput(optional)

  const outNo = flight.outbound?.flightNo?.trim() ?? ''
  const inNo = flight.inbound?.flightNo?.trim() ?? ''
  const shopRows = shop.rows ?? []
  const optRows = opt.rows ?? []

  console.log('flight:', { outNo, inNo, status: flight.debug?.status, reviewNeeded: flight.reviewNeeded })
  console.log('shopping rows:', shopRows.length)
  console.log('optional rows:', optRows.length)

  const errors: string[] = []
  if (!outNo.includes('ZE887')) errors.push(`outbound expected ZE887, got ${outNo || '(empty)'}`)
  if (!inNo.includes('ZE888')) errors.push(`inbound expected ZE888, got ${inNo || '(empty)'}`)
  if (shopRows.length !== 2) errors.push(`expected 2 shopping rows, got ${shopRows.length}`)
  if (optRows.length < 5) errors.push(`expected >=5 optional rows, got ${optRows.length}`)

  if (errors.length) {
    console.error('FAIL:', errors.join('; '))
    process.exit(1)
  }
  console.log('OK: ybtour CIP1292 input-parse smoke')
}

main()
