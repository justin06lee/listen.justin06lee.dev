"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type MarqueeProps = {
  children: React.ReactNode;
  /** Scroll speed in px per second. Constant regardless of content width. */
  speed?: number;
  /** Scroll right instead of left. */
  reverse?: boolean;
  /** Gap between repeats, in px. */
  gap?: number;
  /** Node rendered between repeats — a bullet, a slash, a tape stripe. */
  separator?: React.ReactNode;
  /** Halt while the pointer is over the band. */
  pauseOnHover?: boolean;
  /** Mask the left and right edges so content arrives and leaves softly. */
  fade?: boolean;
  className?: string;
};

/**
 * Infinite scrolling ticker band.
 *
 * Speed is specified in px/s and the duration is derived from the measured
 * content width, so a short label and a long sentence travel at the same rate —
 * a fixed duration would make them scroll at wildly different speeds.
 *
 * The copy count is computed rather than hardcoded to two: content narrower
 * than the container needs as many repeats as it takes to cover the gap plus
 * one, or the band would show a hole between loops.
 *
 * Under reduced motion the animation is dropped entirely and the first copy
 * sits still — a ticker that can't be paused is a genuine accessibility
 * problem, and a static label is a legitimate reading of the same content.
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  gap = 32,
  separator,
  pauseOnHover = true,
  fade = false,
  className,
}: MarqueeProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [repeats, setRepeats] = React.useState(2);

  React.useEffect(() => {
    const host = hostRef.current;
    const measure = measureRef.current;
    if (!host || !measure) return;

    const update = () => {
      const contentWidth = measure.getBoundingClientRect().width;
      const hostWidth = host.getBoundingClientRect().width;
      if (!contentWidth) return;
      setWidth(contentWidth);
      // One copy scrolls out while the rest cover the viewport behind it.
      setRepeats(Math.max(2, Math.ceil(hostWidth / (contentWidth + gap)) + 1));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [gap, children]);

  const shift = width + gap;
  const duration = shift > 0 ? shift / Math.max(1, speed) : 0;

  const copy = (index: number) => (
    <div
      key={index}
      ref={index === 0 ? measureRef : undefined}
      aria-hidden={index > 0}
      className="flex shrink-0 items-center"
      style={{ gap, marginRight: gap }}
    >
      {children}
      {separator}
    </div>
  );

  return (
    <div
      ref={hostRef}
      data-marquee=""
      className={cn("relative w-full overflow-hidden", className)}
      style={
        fade
          ? {
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }
          : undefined
      }
    >
      <style precedence="default" href="chrome-marquee-keyframes">{`
        @keyframes chrome-marquee-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(calc(var(--chrome-marquee-shift) * -1), 0, 0); }
        }
        .chrome-marquee-track {
          animation: chrome-marquee-scroll var(--chrome-marquee-duration) linear infinite;
          will-change: transform;
        }
        [data-marquee]:hover .chrome-marquee-track[data-pause-on-hover] {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .chrome-marquee-track { animation: none; }
        }
      `}</style>

      <div
        data-pause-on-hover={pauseOnHover ? "" : undefined}
        className={cn("flex w-max", duration > 0 && "chrome-marquee-track")}
        style={
          {
            "--chrome-marquee-shift": `${shift}px`,
            "--chrome-marquee-duration": `${duration}s`,
            animationDirection: reverse ? "reverse" : undefined,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: repeats }, (_, index) => copy(index))}
      </div>
    </div>
  );
}
