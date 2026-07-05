"use client";

import type { CSSProperties } from "react";
import SafeImage from "@/app/components/SafeImage";
import { resolveBongsimFlagImageUrlOrFallback } from "@/lib/bongsim-flag-image-url";
import { regionPackTileVisual } from "@/lib/bongsim/recommend/region-pack-badge-visual";
import { USIMSA_COUNTRY_FLAG_PX } from "@/lib/bongsim/recommend/usimsa-country-picker-tokens";

const FLAG_EMOJI_FONT =
  "font-[family-name:var(--bongsim-flag-font)] [--bongsim-flag-font:'Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

type Props = {
  code: string;
  /** region-packs 카탈로그 이모지 (커버리지·대표국기 없을 때만) */
  emoji?: string;
  size?: number;
  className?: string;
};

/**
 * 다국가 eSIM — 국기 원형 (그리드 SSOT)
 * · 유럽 / 글로벌 → 고정 국기
 * · 그 외 → 지원국 캐러셀 (2국+) 또는 대표 국기 1장
 */
export function RegionPackBadgeIcon({
  code,
  emoji = "🌐",
  size = USIMSA_COUNTRY_FLAG_PX,
  className = "",
}: Props) {
  const visual = regionPackTileVisual(code, emoji);
  const px = `${size}px`;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f7f7f7] ${className}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      {visual.type === "flag" ? (
        <FlagFill iso={visual.iso} size={size} />
      ) : visual.type === "carousel" ? (
        <FlagCarouselCircle isos={visual.isos} size={size} />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center leading-none ${FLAG_EMOJI_FONT}`}
          style={{ fontSize: size * 0.56 }}
        >
          {visual.emoji}
        </span>
      )}
    </span>
  );
}

function FlagFill({ iso, size }: { iso: string; size: number }) {
  return (
    <SafeImage
      src={resolveBongsimFlagImageUrlOrFallback(iso)}
      alt=""
      width={size}
      height={size}
      quality={90}
      className="h-full w-full object-cover"
      sizes={`${size}px`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

/** 유럽 제외 다국가 — 원형 안 국기 캐러셀 */
function FlagCarouselCircle({ isos, size }: { isos: string[]; size: number }) {
  const loop = [...isos, ...isos];
  const durationSec = Math.max(3.5, isos.length * 1.2);

  return (
    <span className="relative h-full w-full overflow-hidden">
      <span
        className="bt-region-flag-marquee-track flex h-full"
        style={
          {
            "--bt-region-flag-marquee-dur": `${durationSec}s`,
          } as CSSProperties
        }
      >
        {loop.map((iso, i) => (
          <span
            key={`${iso}-${i}`}
            className="relative h-full shrink-0 overflow-hidden"
            style={{ width: size }}
          >
            <FlagFill iso={iso} size={size} />
          </span>
        ))}
      </span>
      <span className="bt-region-flag-marquee-static pointer-events-none absolute inset-0 motion-reduce:block hidden">
        <FlagFill iso={isos[0]!} size={size} />
      </span>
    </span>
  );
}
