"use client";

import Image from "next/image";
import { SIMPLYUR_BRAND, type SimplyurWordmarkSize } from "@/lib/simplyur/brand";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  size?: SimplyurWordmarkSize;
  showTagline?: boolean;
  /** Raster wordmark from brand PNG — pixel-perfect match to design file */
  variant?: "css" | "image";
  className?: string;
};

const SIZE_CLASS: Record<SimplyurWordmarkSize, { text: string; tagline: string; image: { w: number; h: number } }> = {
  sm: { text: "text-xl", tagline: "text-[8px] tracking-[0.22em]", image: { w: 148, h: 44 } },
  md: { text: "text-2xl sm:text-3xl", tagline: "text-[9px] sm:text-[10px] tracking-[0.24em]", image: { w: 188, h: 56 } },
  lg: { text: "text-4xl sm:text-5xl", tagline: "text-[10px] sm:text-[11px] tracking-[0.26em]", image: { w: 272, h: 80 } },
  hero: {
    text: "text-5xl sm:text-6xl md:text-7xl",
    tagline: "text-[11px] sm:text-xs tracking-[0.28em]",
    image: { w: 400, h: 118 },
  },
};

export function SimplyurWordmark({
  size = "md",
  showTagline = false,
  variant = "image",
  className = "",
}: Props) {
  const tr = useSimplyurT();
  const s = SIZE_CLASS[size];

  if (variant === "image") {
    const dim = s.image;
    return (
      <div className={`inline-flex flex-col ${className}`}>
        <Image
          src={SIMPLYUR_BRAND.wordmarkImage}
          alt="simplyur"
          width={dim.w}
          height={dim.h}
          className="h-auto w-auto max-w-full"
          priority={size === "hero"}
        />
        {showTagline ? (
          <p
            className={`mt-1.5 font-medium uppercase text-[color:var(--su-brand-simply)] ${s.tagline}`}
            style={{ fontFamily: "var(--font-simplyur)" }}
          >
            {tr("brand.tagline")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span
        className={`su-wordmark leading-none ${s.text}`}
        style={{ fontFamily: "var(--font-simplyur)" }}
        aria-label="simplyur"
      >
        <span className="font-light text-[color:var(--su-brand-simply)]">simply</span>
        <span className="font-extrabold text-[color:var(--su-brand-ur)]">ur</span>
      </span>
      {showTagline ? (
        <p
          className={`mt-2 font-medium uppercase text-[color:var(--su-brand-simply)] ${s.tagline}`}
          style={{ fontFamily: "var(--font-simplyur)" }}
        >
          {tr("brand.tagline")}
        </p>
      ) : null}
    </div>
  );
}
