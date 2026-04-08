'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export type FilterState = {
  noShopping: boolean
  guideFeeIncluded: boolean
  hotelRating4: boolean
}

type Props = {
  filters: FilterState
  onFilterChange: (key: keyof FilterState, value: boolean) => void
  loadingDone: boolean
}

const FILTERS: { key: keyof FilterState; label: string }[] = [
  { key: 'noShopping', label: '노쇼핑 전용' },
  { key: 'guideFeeIncluded', label: '가이드경비 포함' },
  { key: 'hotelRating4', label: '호텔 평점 4.0 이상' },
]

export default function TransparencyFilters({ filters, onFilterChange, loadingDone }: Props) {
  return (
    <motion.div
      className="flex flex-wrap items-center gap-2 sm:gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={loadingDone ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.25, duration: 0.4 }}
    >
      <span className="mr-1 text-sm font-medium text-gray-600 sm:mr-2">투명성 필터</span>
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onFilterChange(key, !filters[key])}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition sm:px-5 sm:py-2.5 ${
            filters[key]
              ? 'border-bong-orange bg-bong-orange text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:border-bong-orange/50 hover:bg-bong-orange/5'
          }`}
        >
          {label}
        </button>
      ))}
    </motion.div>
  )
}
