'use client'

import SafeImage from '@/app/components/SafeImage'

type Props = {
  src: string
}

/** NCloud 등 외부 URL — SafeImage(클라이언트) */
export default function EsimLandingHeroBackground({ src }: Props) {
  return (
    <SafeImage
      src={src}
      alt=""
      fill
      priority
      sizes="100vw"
      className="object-cover object-center"
      aria-hidden
    />
  )
}
