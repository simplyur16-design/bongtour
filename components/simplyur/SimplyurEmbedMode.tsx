'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * When opened inside simplyurtrip iframe (`embed=1`), hide simplyur site chrome.
 */
export function SimplyurEmbedChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const [embed, setEmbed] = useState(false)

  useEffect(() => {
    const fromQuery = searchParams?.get('embed') === '1'
    if (fromQuery) {
      try {
        sessionStorage.setItem('simplyur_embed', '1')
      } catch {
        /* ignore */
      }
      setEmbed(true)
      return
    }
    try {
      setEmbed(sessionStorage.getItem('simplyur_embed') === '1')
    } catch {
      setEmbed(false)
    }
  }, [searchParams])

  return (
    <>
      {embed ? null : header}
      {children}
      {embed ? null : footer}
    </>
  )
}
