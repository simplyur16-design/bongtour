'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { devWarnMobileHome } from '@/lib/mobile-home-dev-log'

type Props = { children: ReactNode; section: string }

type State = { hasError: boolean }

/**
 * 모바일 홈 등 클라이언트 섹션 — 렌더 예외 시 전체 앱 대신 해당 블록만 조용히 제거.
 * (개발: `componentDidCatch` 로그)
 */
export default class MobileHomeClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    devWarnMobileHome(`error-boundary:${this.props.section}`, error?.message, info?.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) return null
    return this.props.children
  }
}
