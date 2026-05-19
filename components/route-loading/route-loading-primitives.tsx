/** Route transition loading.tsx shared pulse skeletons */

export function RouteLoadingShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bt-page">{children}</div>
}

export function PulseBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-bt-border-soft/80 ${className}`} aria-hidden />
}

export function PulseLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-bt-border-soft/70 ${className}`} aria-hidden />
}
