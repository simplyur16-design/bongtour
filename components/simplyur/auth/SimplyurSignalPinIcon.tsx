/** Signal Pin mark — design_handoff_login_1b */
export function SimplyurSignalPinIcon({
  width = 44,
  height = 53,
  fill = '#FF6B4A',
  className,
}: {
  width?: number;
  height?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 120"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M50,6 C27,6 8,25 8,48 C8,76 50,116 50,116 C50,116 92,76 92,48 C92,25 73,6 50,6 Z"
        fill={fill}
      />
      <circle cx="50" cy="60" r="6.5" fill="#fff" />
      <path
        d="M34.6,52.8 A17,17 0 0 1 65.4,52.8"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M24.6,48.2 A28,28 0 0 1 75.4,48.2"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
