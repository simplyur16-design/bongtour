/**
 * 하나투어 유럽형 상품가격 블록(기본상품 / 현지합류 / 1인 객실) 추출 검증.
 * 상품코드 EEP134260501KEC 등 본문에 대응하는 구조의 최소 샘플.
 * 실행: npx tsx scripts/verify-hanatour-europe-price-table.ts
 */
import {
  extractBasicProductThreeSlotsFromBlob,
  extractHanatourLocalJoinThreeSlotsFromBlob,
  extractHanatourSingleRoomSurchargeFromBlob,
  formatHanatourLocalJoinExcludedNote,
  finalizeHanatourRegisterParsedPricing,
} from '../lib/register-hanatour-price'
import { applyHanatourSyntheticPriceRowIfNeeded } from '../lib/register-hanatour-confirm-fallback-prices'
import type { RegisterParsed } from '../lib/register-llm-schema-hanatour'

const EUROPE_PRICE_BLOCK = `상품가격
구분\t성인\t아동\t유아
기본상품\t5,599,000원\t5,346,650원\t504,700원
현지합류\t2,490,000원\t2,490,000원\t249,000원
1인 객실 사용료 : 650,000원
1인 객실 사용시 추가요금 발생됩니다.
유류할증료 포함
`

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(2)
  }
}

function main() {
  const basic = extractBasicProductThreeSlotsFromBlob(EUROPE_PRICE_BLOCK)
  assert(basic?.adultPrice === 5_599_000, `adult ${basic?.adultPrice}`)
  assert(basic?.childPrice === 5_346_650, `child ${basic?.childPrice}`)
  assert(basic?.infantPrice === 504_700, `infant ${basic?.infantPrice}`)

  const join = extractHanatourLocalJoinThreeSlotsFromBlob(EUROPE_PRICE_BLOCK)
  assert(join?.adultPrice === 2_490_000, `join adult ${join?.adultPrice}`)
  assert(join?.childPrice === 2_490_000, `join child ${join?.childPrice}`)
  assert(join?.infantPrice === 249_000, `join infant ${join?.infantPrice}`)

  const sr = extractHanatourSingleRoomSurchargeFromBlob(EUROPE_PRICE_BLOCK)
  assert(sr?.amount === 650_000, `single room ${sr?.amount}`)

  const note = formatHanatourLocalJoinExcludedNote(EUROPE_PRICE_BLOCK)
  assert(note != null && note.includes('현지합류'), 'local join note')

  const minimal: RegisterParsed = {
    originSource: 'hanatour',
    originCode: 'EEP134260501KEC',
    title: 't',
    destination: 'd',
    duration: '9박 10일',
    schedule: [],
    prices: [],
    priceTableRawText: EUROPE_PRICE_BLOCK,
    productPriceTable: {
      adultPrice: 2_490_000,
      childExtraBedPrice: 2_490_000,
      childNoBedPrice: null,
      infantPrice: 249_000,
    },
  }
  const out = finalizeHanatourRegisterParsedPricing(minimal)
  assert(out.productPriceTable?.adultPrice === 5_599_000, 'finalize adult overwrites wrong LLM')
  assert(out.productPriceTable?.childExtraBedPrice === 5_346_650, 'finalize child')
  assert(out.productPriceTable?.infantPrice === 504_700, 'finalize infant')
  assert(out.singleRoomSurchargeAmount === 650_000, 'single room on parsed')
  assert((out.excludedText ?? '').includes('현지합류'), 'excluded has local join')
  assert((out.excludedText ?? '').includes('추가요금 발생'), 'excluded has single-room notice')

  const infantPolluted: RegisterParsed = {
    ...minimal,
    productPriceTable: {
      adultPrice: 5_599_000,
      childExtraBedPrice: 5_346_650,
      childNoBedPrice: null,
      infantPrice: 650_000,
    },
  }
  const fixedInf = finalizeHanatourRegisterParsedPricing(infantPolluted)
  assert(fixedInf.productPriceTable?.infantPrice === 504_700, 'strip single-room from infant slot')

  const swamp: RegisterParsed = {
    ...minimal,
    priceTableRawText: EUROPE_PRICE_BLOCK,
    productPriceTable: {
      adultPrice: 2_490_000,
      childExtraBedPrice: 2_490_000,
      childNoBedPrice: null,
      infantPrice: 249_000,
    },
  }
  const swampOut = finalizeHanatourRegisterParsedPricing(swamp)
  assert(swampOut.productPriceTable?.adultPrice === 5_599_000, 'swamp rescue adult')
  assert(swampOut.productPriceTable?.childExtraBedPrice === 5_346_650, 'swamp rescue child')
  assert(swampOut.productPriceTable?.infantPrice === 504_700, 'swamp rescue infant')

  const forSynth = {
    ...out,
    prices: [],
    detailBodyStructured: {
      flightStructured: {
        airlineName: 'KE',
        outbound: {
          flightNo: 'KE091',
          departureDate: '2026-05-01',
          departureTime: '14:00',
          arrivalDate: '',
          arrivalTime: '',
          departureAirport: 'ICN',
          arrivalAirport: 'FRA',
        },
        inbound: null,
      },
    },
  } as unknown as RegisterParsed
  const synth = applyHanatourSyntheticPriceRowIfNeeded(forSynth, EUROPE_PRICE_BLOCK, 'hanatour')
  assert((synth.prices?.length ?? 0) === 1, 'synthetic row count')
  assert(synth.prices![0]!.adultBase === 5_599_000, 'synth adult from basic 3-slot')
  assert(synth.prices![0]!.childBedBase === 5_346_650, 'synth child')
  assert(synth.prices![0]!.infantBase === 504_700, 'synth infant')
  assert(synth.prices![0]!.date === '2026-05-01', 'synth iso date')

  console.log('OK hanatour europe price axis sample')
}

main()
