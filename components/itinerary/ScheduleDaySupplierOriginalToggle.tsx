'use client'

/**
 * 일차 카드 '원문 보기' — 기본 닫힘, 클릭 시 공급사 원문(저장값 그대로) 펼침.
 * 원문이 저장되지 않은 일차는 아무것도 렌더하지 않는다.
 * JSX 대신 createElement — vitest(jsx: preserve)에서도 실제 컴포넌트로 토큰 무결성 테스트를 돌리기 위함.
 */
import { createElement as h, useId, useState } from 'react'
import {
  buildScheduleDaySupplierOriginalView,
  type ScheduleDaySupplierOriginal,
} from '@/lib/schedule-day-supplier-original'

type Props = {
  day: {
    day: number
    title?: string | null
    routeText?: string | null
    supplierOriginal?: ScheduleDaySupplierOriginal | null
  }
  /** 테스트·샘플 렌더용 초기 상태 (기본 닫힘) */
  defaultOpen?: boolean
}

export function ScheduleDaySupplierOriginalToggle({ day, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const view = buildScheduleDaySupplierOriginalView(day)
  if (!view) return null

  const route = view.routeLine
    ? h(
        'p',
        { className: 'mb-2 rounded-lg bg-[#EFEDF8] px-3 py-1.5 text-xs sm:text-sm fit-tx-primary' },
        h('span', { className: 'mr-1.5 font-semibold' }, '경로'),
        view.routeLine,
      )
    : null
  const items =
    view.items.length > 0
      ? h(
          'ul',
          { className: 'divide-y divide-dashed divide-[#DAD4EE]' },
          view.items.map((it, i) =>
            h(
              'li',
              { key: i, className: 'py-1.5 text-sm fit-tx-primary' },
              it.label
                ? h(
                    'span',
                    { className: 'mr-1.5 inline-block rounded border border-[#C9C2E3] px-1.5 text-[11px] text-[#534AB7]' },
                    it.label,
                  )
                : null,
              it.name ? h('span', { className: 'font-semibold' }, it.name) : null,
              it.text ? h('span', { className: 'block whitespace-pre-line text-[13px] text-[#475569]' }, it.text) : null,
            ),
          ),
        )
      : null
  const hotel = view.hotelText
    ? h(
        'div',
        { className: 'mt-3 rounded-xl bg-[#F8F6FC] px-3 py-2' },
        h('p', { className: 'text-xs font-bold fit-tx-primary' }, '숙소'),
        h('p', { className: 'whitespace-pre-line text-sm fit-tx-primary' }, view.hotelText),
      )
    : null
  const meals =
    view.meals.length > 0
      ? h(
          'div',
          { className: 'mt-2 rounded-xl bg-[#F8F6FC] px-3 py-2' },
          h('p', { className: 'text-xs font-bold fit-tx-primary' }, '식사'),
          h(
            'dl',
            { className: 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm fit-tx-primary' },
            view.meals.map((m) =>
              h(
                'div',
                { key: m.label, className: 'contents' },
                h('dt', { className: 'font-semibold text-[#85510B]' }, m.label),
                h('dd', null, m.value),
              ),
            ),
          ),
        )
      : null

  return h(
    'div',
    { className: 'rounded-2xl border border-[#DAD4EE] bg-white', 'data-supplier-original-toggle': '' },
    h(
      'button',
      {
        type: 'button',
        'aria-expanded': open,
        'aria-controls': panelId,
        onClick: () => setOpen((v) => !v),
        className:
          'flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold fit-tx-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f8fc7]',
      },
      h('span', null, '원문 보기'),
      h('span', { 'aria-hidden': true, className: `text-xs transition-transform ${open ? 'rotate-180' : ''}` }, '▼'),
    ),
    h(
      'div',
      {
        id: panelId,
        role: 'region',
        'aria-label': `${day.day}일차 원문`,
        hidden: !open,
        className: 'border-t border-[#DAD4EE] px-4 py-3',
      },
      route,
      items,
      hotel,
      meals,
    ),
  )
}
