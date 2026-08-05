"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type VinylProps = {
  /** Art for the centre label. Without it the label is a plain disc. */
  src?: string;
  alt?: string;
  /** Diameter in px. Defaults to 160. */
  size?: number;
  /** Turn. Defaults to true. */
  spinning?: boolean;
  /** Seconds per revolution. 1.8 is 33⅓ rpm at demo speed. Defaults to 4. */
  period?: number;
  /** Drop the tonearm onto the record. */
  arm?: boolean;
  /** Label diameter as a fraction of the record. Defaults to 0.36. */
  labelRatio?: number;
  className?: string;
};

/**
 * A record on a platter: grooves, a centre label, an optional tonearm.
 *
 * The grooves are one `repeating-radial-gradient`, not a stack of rings — a
 * hundred bordered divs would cost a hundred paints per frame while it turns.
 * The spin is a css animation on a wrapper, so it composites on the gpu and the
 * label art rides along without any per-frame javascript.
 *
 * Pausing sets `animation-play-state` rather than removing the animation, which
 * leaves the record exactly where it stopped — a needle that jumps back to
 * twelve o'clock every time you pause looks broken. Reduced motion stops it
 * outright; the record is decoration, and decoration is the first thing that
 * should hold still.
 */
export function Vinyl({
  src,
  alt = "",
  size = 160,
  spinning = true,
  period = 4,
  arm = false,
  labelRatio = 0.36,
  className,
}: VinylProps) {
  const labelSize = Math.round(size * Math.min(0.7, Math.max(0.15, labelRatio)));
  const spindle = Math.max(3, Math.round(size * 0.022));

  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      <style precedence="default" href="chrome-vinyl-keyframes">{`
        @keyframes chrome-vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .chrome-vinyl-disc {
          animation: chrome-vinyl-spin var(--chrome-vinyl-period) linear infinite;
          will-change: transform;
        }
        .chrome-vinyl-disc[data-paused] { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .chrome-vinyl-disc { animation: none; }
        }
      `}</style>

      <div
        className="chrome-vinyl-disc absolute inset-0 rounded-full"
        data-paused={spinning ? undefined : ""}
        style={
          {
            "--chrome-vinyl-period": `${Math.max(0.2, period)}s`,
            background: [
              // Grooves: a hard-stop repeating ring pattern, then a wide sheen
              // sweep so the light reads as coming from one direction.
              "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.055) 0 1px, rgba(0,0,0,0) 1px 4px)",
              "conic-gradient(from 210deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0) 75%, rgba(255,255,255,0.10))",
              "radial-gradient(circle at 50% 50%, #131313 0%, #0a0a0a 62%, #050505 100%)",
            ].join(","),
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          } as React.CSSProperties
        }
      >
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-white/15 bg-white/[0.04]"
          style={{ width: labelSize, height: labelSize }}
        >
          {src && (
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          )}
        </div>

        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black ring-1 ring-white/20"
          style={{ width: spindle, height: spindle }}
        />
      </div>

      {arm && (
        <div
          aria-hidden
          className="absolute right-[6%] top-[8%] origin-top-right"
          style={{ transform: `rotate(${spinning ? 24 : 6}deg)`, transition: "transform 600ms ease" }}
        >
          <div
            className="bg-white/25"
            style={{ width: Math.round(size * 0.03), height: Math.round(size * 0.03) }}
          />
          <div
            className="absolute left-1/2 top-1/2 origin-top -translate-x-1/2 bg-white/25"
            style={{ width: 2, height: Math.round(size * 0.46) }}
          />
        </div>
      )}
    </div>
  );
}
