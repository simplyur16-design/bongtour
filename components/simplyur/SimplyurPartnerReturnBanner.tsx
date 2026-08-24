'use client'

import { useEffect, useState } from 'react'
import { useSimplyurT } from '@/components/simplyur/SimplyurIntlProvider'
import {
  clearSimplyurPartnerReturn,
  readSimplyurPartnerReturn,
} from '@/components/simplyur/SimplyurPartnerReturnCapture'

/**
 * Shown while shopping when guest arrived from simplyurtrip affiliate.
 */
export function SimplyurPartnerReturnBanner() {
  const tr = useSimplyurT()
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    const data = readSimplyurPartnerReturn()
    if (data?.partner === 'simplyurtrip' || data?.returnTo) {
      setHref(data.returnTo)
    }
  }, [])

  if (!href) return null

  return (
    <div className="border-b border-[color:var(--su-border)] bg-[color:var(--su-celadon-light)] px-4 py-2.5 text-center text-sm">
      <a
        href={href}
        className="font-semibold text-[color:var(--su-celadon-dark)] underline-offset-2 hover:underline"
        onClick={() => clearSimplyurPartnerReturn()}
      >
        {tr('checkout.continueTrip')}
      </a>
      <span className="mx-1.5 text-[color:var(--su-ink-muted)]">·</span>
      <span className="text-[color:var(--su-ink-muted)]">{tr('affiliate.fromTrip')}</span>
    </div>
  )
}
