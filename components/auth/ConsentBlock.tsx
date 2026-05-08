'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AGE_NOTICE_BODY,
  MARKETING_NOTICE_BODY,
  PRIVACY_NOTICE_BODY,
  TERMS_NOTICE_BODY,
} from '@/lib/consent/copies'

export type ConsentBlockType = 'terms' | 'privacy' | 'marketing' | 'age'

const LABEL: Record<ConsentBlockType, string> = {
  terms: '이용약관에 동의합니다',
  privacy: '개인정보 수집·이용에 동의합니다',
  age: '만 14세 이상입니다',
  marketing: '마케팅 정보 수신에 동의합니다',
}

const BODY: Record<ConsentBlockType, string> = {
  terms: TERMS_NOTICE_BODY,
  privacy: PRIVACY_NOTICE_BODY,
  age: AGE_NOTICE_BODY,
  marketing: MARKETING_NOTICE_BODY,
}

type Props = {
  type: ConsentBlockType
  checked: boolean
  onChange: (next: boolean) => void
  required: boolean
}

export default function ConsentBlock({ type, checked, onChange, required }: Props) {
  const [open, setOpen] = useState(false)
  const tag = required ? '[필수]' : '[선택]'

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
      >
        안내 보기
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          {type === 'terms' ? (
            <>
              <p>{TERMS_NOTICE_BODY}</p>
              <Link href="/terms" className="inline-block font-medium text-bt-link hover:underline">
                이용약관 전문 보기 →
              </Link>
            </>
          ) : (
            <p className="whitespace-pre-line">{BODY[type]}</p>
          )}
        </div>
      ) : null}
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-600"
        />
        <span>
          {tag} {LABEL[type]} {required ? <span className="text-rose-600">*</span> : null}
        </span>
      </label>
    </div>
  )
}
