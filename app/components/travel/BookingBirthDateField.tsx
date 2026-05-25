'use client'

import {
  formatBirthDateDigitsForDisplay,
  normalizeBirthDateDigitsInput,
} from '@/lib/booking-birth-date-input'

type Props = {
  id?: string
  label: React.ReactNode
  digits: string
  onDigitsChange: (digits: string) => void
  className?: string
}

const inputClassName =
  'w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-3 text-base tabular-nums text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft'

const inputClassNameCompact =
  'mt-1 w-full rounded border border-bt-border-strong bg-bt-surface px-3 py-2.5 text-base tabular-nums text-bt-body outline-none focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft'

export function BookingBirthDateField({ id, label, digits, onDigitsChange, className }: Props) {
  return (
    <div className={className}>
      {label}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 19780216"
        maxLength={10}
        value={formatBirthDateDigitsForDisplay(digits)}
        onChange={(e) => onDigitsChange(normalizeBirthDateDigitsInput(e.target.value))}
        className={inputClassName}
        required
      />
    </div>
  )
}

export function BookingBirthDateFieldCompact({
  id,
  label,
  digits,
  onDigitsChange,
}: {
  id?: string
  label: React.ReactNode
  digits: string
  onDigitsChange: (digits: string) => void
}) {
  return (
    <div>
      {label}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="예: 19780216"
        maxLength={10}
        value={formatBirthDateDigitsForDisplay(digits)}
        onChange={(e) => onDigitsChange(normalizeBirthDateDigitsInput(e.target.value))}
        className={inputClassNameCompact}
        required
      />
    </div>
  )
}
