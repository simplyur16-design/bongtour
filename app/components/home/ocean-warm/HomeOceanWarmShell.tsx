import type { ReactNode } from 'react'
import './ocean-warm-home-live.css'

/** 홈 루트 스코프 — tokens + live CSS. */
export default function HomeOceanWarmShell({ children }: { children: ReactNode }) {
  return <div className="bt-ocean-warm ow-home-live flex min-h-screen flex-col">{children}</div>
}
