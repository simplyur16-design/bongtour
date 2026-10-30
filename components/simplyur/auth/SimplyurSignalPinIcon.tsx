import Image from 'next/image';
import { SIMPLYUR_BRAND } from '@/lib/simplyur/brand';

/**
 * Sign-in / reset brand mark. Was the coral Signal Pin (design_handoff_login_1b);
 * now the approved Simplyur eSIM mark (final/esim/favicon.svg, square). Rendered at `width` px square.
 */
export function SimplyurSignalPinIcon({
  width = 44,
  className,
}: {
  width?: number;
  /** kept for call-site compatibility; the mark is square so `width` wins */
  height?: number;
  /** kept for call-site compatibility; the approved mark has fixed colours */
  fill?: string;
  className?: string;
}) {
  return (
    <Image
      src={SIMPLYUR_BRAND.symbolImage}
      alt=""
      aria-hidden
      width={width}
      height={width}
      unoptimized
      className={className}
    />
  );
}
