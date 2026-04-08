'use client'

import { COMPARE_PRICE_ROW_HINT } from '@/lib/promotion-copy-normalize'
import { Ticket, ShoppingBag, Clock3, Plane, Route } from 'lucide-react'
import type { ProductMetaChip, ProductMetaChipKind } from '@/lib/product-meta-chips'

/**
 * 상품 상세 — 히어로/여행요약/가격 공통 시각 규칙
 */

/** 히어로 하단 메타와 동일한 pill (여행요약·부가정보 등 재사용) */
export const PRODUCT_DETAIL_META_PILL_CLASS =
  'inline-flex items-center rounded-full border border-bt-border-soft bg-bt-surface-alt px-2.5 py-1 text-xs font-medium text-bt-body'

const META_KIND_LABEL: Record<ProductMetaChipKind, string> = {
  optional: '현지옵션',
  shopping: '쇼핑',
  freeTime: '자유시간',
  airline: '항공',
  flightRouting: '경로',
}

const META_ICONS: Record<ProductMetaChipKind, typeof Ticket> = {
  optional: Ticket,
  shopping: ShoppingBag,
  freeTime: Clock3,
  airline: Plane,
  flightRouting: Route,
}

const metaShellLight: Record<ProductMetaChipKind, string> = {
  optional: 'border-bt-card-accent-border bg-bt-card-accent-soft',
  shopping: 'border-stone-200 bg-stone-50',
  freeTime: 'border-bt-card-accent-border/60 bg-bt-card-accent-soft',
  airline: 'border-slate-200/90 bg-slate-50',
  flightRouting: 'border-sky-200/90 bg-sky-50',
}

const metaShellDark: Record<ProductMetaChipKind, string> = {
  optional: 'border-teal-300/35 bg-teal-400/15',
  shopping: 'border-white/20 bg-white/10',
  freeTime: 'border-teal-200/25 bg-teal-300/10',
  airline: 'border-white/15 bg-white/[0.07]',
  flightRouting: 'border-sky-300/25 bg-sky-400/10',
}

const metaLabelLight: Record<ProductMetaChipKind, string> = {
  optional: 'text-bt-card-title',
  shopping: 'text-stone-800',
  freeTime: 'text-bt-card-title',
  airline: 'text-slate-600',
  flightRouting: 'text-sky-800',
}

const metaLabelDark: Record<ProductMetaChipKind, string> = {
  optional: 'text-teal-100',
  shopping: 'text-stone-100',
  freeTime: 'text-teal-100',
  airline: 'text-slate-200/90',
  flightRouting: 'text-sky-100',
}

const metaIconLight: Record<ProductMetaChipKind, string> = {
  optional: 'text-bt-icon-accent',
  shopping: 'text-stone-500',
  freeTime: 'text-bt-icon-accent',
  airline: 'text-slate-500',
  flightRouting: 'text-sky-600',
}

const metaIconDark: Record<ProductMetaChipKind, string> = {
  optional: 'text-teal-200/95',
  shopping: 'text-stone-200/90',
  freeTime: 'text-teal-200/90',
  airline: 'text-slate-300/80',
  flightRouting: 'text-sky-200/90',
}

const metaValueLight = 'text-bt-text-secondary'
const metaValueDark = 'text-white/[0.88]'

export type ProductMetaChipsProps = {
  chips: ProductMetaChip[]
  /** light: 밝은 카드 / dark: 히어로 어두운 배너 */
  variant?: 'light' | 'dark'
  className?: string
  /** 라벨 행 아래에 값만 두는 칩(여행요약 2행: 자유시간·항공) */
  stackValueKinds?: readonly ProductMetaChipKind[]
}

/** 히어로·여행요약 — 아이콘 + 라벨 + 값, 종류별 배경·색 구분 */
export function ProductMetaChips({
  chips,
  variant = 'light',
  className = '',
  stackValueKinds,
}: ProductMetaChipsProps) {
  if (chips.length === 0) return null
  const shell = variant === 'light' ? metaShellLight : metaShellDark
  const labelCls = variant === 'light' ? metaLabelLight : metaLabelDark
  const iconCls = variant === 'light' ? metaIconLight : metaIconDark
  const valueCls = variant === 'light' ? metaValueLight : metaValueDark
  const stackSet = stackValueKinds ? new Set(stackValueKinds) : null

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {chips.map((chip, i) => {
        const Icon = META_ICONS[chip.kind]
        const stacked = stackSet?.has(chip.kind) ?? false
        if (stacked) {
          return (
            <div
              key={`${chip.kind}-${i}`}
              className={`flex min-h-[4rem] w-full max-w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-center shadow-sm ${shell[chip.kind]}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 opacity-95 ${iconCls[chip.kind]}`} aria-hidden />
                <span className={`text-xs font-bold tracking-tight ${labelCls[chip.kind]}`}>
                  {META_KIND_LABEL[chip.kind]}
                </span>
              </div>
              <span className={`bt-wrap max-w-full px-0.5 text-xs font-medium leading-snug ${valueCls}`}>
                {chip.value}
              </span>
            </div>
          )
        }
        return (
          <div
            key={`${chip.kind}-${i}`}
            className={`inline-flex min-h-[2.25rem] w-full max-w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-center shadow-sm ${shell[chip.kind]}`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 opacity-95 ${iconCls[chip.kind]}`} aria-hidden />
            <span className={`text-xs font-bold tracking-tight ${labelCls[chip.kind]}`}>
              {META_KIND_LABEL[chip.kind]}
            </span>
            <span className={`text-xs font-medium ${valueCls}`}>{chip.value}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 본문 카드 내부 블록 — 소제목·본문·메타 중앙 정렬 */
export const PRODUCT_BODY_CARD_STACK = 'flex flex-col items-center text-center'

/** 본문 카드 소제목(카드 안) — 전역 카드 제목 토큰 */
export const PRODUCT_BODY_CARD_HEADING = 'bt-card-heading'

/** 본문 카드 키커/라벨 — 진한 앰버(전역 `.bt-card-kicker`, 배경 대비) */
export const PRODUCT_BODY_CARD_KICKER = 'bt-card-kicker tracking-[0.12em]'

export function parseTitleBracketSegments(title: string): { kind: 'tag' | 'plain'; text: string }[] {
  if (!title) return [{ kind: 'plain', text: '' }]
  const out: { kind: 'tag' | 'plain'; text: string }[] = []
  const re = /(\[[^\]]+\])/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(title)) !== null) {
    if (m.index > last) out.push({ kind: 'plain', text: title.slice(last, m.index) })
    out.push({ kind: 'tag', text: m[1]! })
    last = m.index + m[1]!.length
  }
  if (last < title.length) out.push({ kind: 'plain', text: title.slice(last) })
  if (out.length === 0) return [{ kind: 'plain', text: title }]
  return out
}

type TitleProps = {
  title: string
  className?: string
  /** 모바일 히어로 등 어두운 배경 */
  tone?: 'light' | 'dark'
}

/** 상품명: 약간 자간 + `[]` 구간만 보조 강조색 */
export function ProductDetailTitle({ title, className, tone = 'light' }: TitleProps) {
  const segments = parseTitleBracketSegments(title)
  const tagCls = tone === 'dark' ? 'font-extrabold text-teal-200' : 'font-extrabold text-bt-card-accent-strong'
  const defaultCls =
    tone === 'dark'
      ? 'bt-wrap mb-3 text-[1.35rem] font-black leading-snug tracking-[0.02em] text-white sm:text-2xl'
      : 'bt-wrap text-2xl font-black leading-[1.2] tracking-[0.02em] text-bt-title sm:text-3xl'
  return (
    <h1 className={className ?? defaultCls}>
      {segments.map((s, i) =>
        s.kind === 'tag' ? (
          <span key={i} className={tagCls}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </h1>
  )
}

type KrwProps = {
  amount: number
  /** 숫자 강조 크기 */
  size?: 'xl' | '2xl'
  variant?: 'default' | 'inverse'
}

/** ₩ 작게 + 숫자 크고 굵게 (한 줄) */
export function KrwAmountDisplay({ amount, size = '2xl', variant = 'default' }: KrwProps) {
  const numClass =
    size === '2xl'
      ? 'text-2xl font-black leading-none sm:text-[1.65rem]'
      : 'text-xl font-black leading-none'
  const symMuted = variant === 'inverse' ? 'text-white/75' : 'text-bt-muted'
  const numCol = variant === 'inverse' ? 'text-white' : 'text-bt-price'
  return (
    <span className={`inline-flex items-baseline justify-end gap-1 tabular-nums ${numCol}`}>
      <span className={`text-[0.7em] font-semibold leading-none ${symMuted}`} aria-hidden>
        ₩
      </span>
      <span className={numClass}>{amount.toLocaleString('ko-KR')}</span>
    </span>
  )
}

type PriceRowProps = {
  label?: string | null
  amount: number | null
  size?: KrwProps['size']
  variant?: KrwProps['variant']
  emptyLabel?: string
}

/** 좌측 라벨 · 우측 ₩+금액 */
export function CurrentPriceRow({ label = null, amount, size = '2xl', variant = 'default', emptyLabel = '상담 시 안내' }: PriceRowProps) {
  const labelCls = variant === 'inverse' ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-bt-title shrink-0'
  return (
    <div className={`flex min-h-[2.5rem] items-baseline gap-3 ${label ? 'justify-between' : 'justify-end'}`}>
      {label ? <span className={labelCls}>{label}</span> : null}
      <span className={label ? '' : 'ml-auto'}>
        {amount != null && amount > 0 ? (
          <KrwAmountDisplay amount={amount} size={size} variant={variant} />
        ) : (
          <span className={variant === 'inverse' ? 'text-sm font-bold text-white' : 'text-base font-bold text-bt-title'}>
            {emptyLabel}
          </span>
        )}
      </span>
    </div>
  )
}

type CompareRowProps = {
  amount: number
  variant?: 'default' | 'inverse'
  /**
   * 기본: 쿠폰 적용 전 금액 (= 선택 출발일 가격 + 쿠폰 할인액, `buildPriceDisplaySsot` SSOT).
   * 「기준가」 단독 라벨 사용 금지.
   */
  label?: string
  /** 라벨 아래 설명 — 기본값은 `COMPARE_PRICE_ROW_HINT` (`lib/promotion-copy-normalize.ts`) */
  hint?: string
}

export function ComparePriceRow({
  amount,
  variant = 'default',
  label = '쿠폰 적용 전 금액',
  hint = COMPARE_PRICE_ROW_HINT,
}: CompareRowProps) {
  const inv = variant === 'inverse'
  const labelMain = inv ? 'text-white/80' : 'text-bt-meta'
  const labelHint = inv ? 'text-white/65' : 'text-bt-body'
  const strikeWrap = inv ? 'text-white' : 'text-slate-900'
  const sym = inv ? 'text-white/60' : 'text-slate-500'
  return (
    <div
      className={`flex items-start justify-between gap-3 text-xs ${inv ? '' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className={`font-semibold leading-snug ${labelMain}`}>{label}</p>
        <p className={`mt-0.5 text-[10px] leading-snug ${labelHint}`}>{hint}</p>
      </div>
      <span
        className={`inline-flex shrink-0 items-baseline gap-0.5 tabular-nums line-through ${strikeWrap}`}
      >
        <span className={`text-[0.65em] font-semibold ${sym}`}>₩</span>
        <span className="font-bold">{amount.toLocaleString('ko-KR')}</span>
      </span>
    </div>
  )
}

/** 히어로/스티키 공통 날짜 스타일 — 라벨은 보조, 값은 핵심 정보로 고정 */
export const HERO_DATE_LABEL_CLASS = 'shrink-0 font-medium !text-slate-600'
export const HERO_DATE_VALUE_CLASS = 'bt-wrap text-right text-sm font-semibold tabular-nums !text-slate-900 sm:text-base'
/** 여행 핵심정보「여행기간」한 줄(날짜 ~ 날짜) — 우측 정렬 없이 본문 흐름에 맞춤 */
export const HERO_DATE_INLINE_VALUE_CLASS = 'font-semibold tabular-nums !text-slate-900'
