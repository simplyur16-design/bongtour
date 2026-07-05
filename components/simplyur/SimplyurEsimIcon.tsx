type Props = { className?: string };

/** Outline chip icon from brand mock */
export function SimplyurEsimIcon({ className = "h-14 w-14" }: Props) {
  return (
    <svg className={className} viewBox="0 0 56 56" fill="none" aria-hidden>
      <rect x="4" y="4" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="22" r="2" fill="currentColor" />
      <circle cx="34" cy="22" r="2" fill="currentColor" />
      <circle cx="22" cy="34" r="2" fill="currentColor" />
      <circle cx="34" cy="34" r="2" fill="currentColor" />
    </svg>
  );
}
