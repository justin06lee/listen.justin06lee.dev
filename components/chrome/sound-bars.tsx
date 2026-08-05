import { cn } from "@/lib/utils";

export type SoundBarsSize = "sm" | "md" | "lg";

export type SoundBarsProps = {
  /** How many bars. Defaults to 4. */
  bars?: number;
  /** Freeze the bars low — the paused state. */
  paused?: boolean;
  size?: SoundBarsSize;
  /** CSS color of the bars. Defaults to currentColor, so it inherits the row it sits in. */
  accent?: string;
  /** Seconds for one full cycle of the slowest bar. Defaults to 1.1. */
  speed?: number;
  /** Screen-reader text. Pass null when an adjacent label already says it. */
  label?: string | null;
  className?: string;
};

const SIZE: Record<SoundBarsSize, { box: string; bar: string; gap: string }> = {
  sm: { box: "h-2.5", bar: "w-[2px]", gap: "gap-[2px]" },
  md: { box: "h-3.5", bar: "w-[3px]", gap: "gap-[3px]" },
  lg: { box: "h-5", bar: "w-1", gap: "gap-1" },
};

// Fixed, mutually-prime-ish factors: a bar's period and phase come from its
// index, never from Math.random, or the server and client would disagree about
// the animation and every remount would reshuffle the pattern.
const PERIOD = [1, 0.68, 1.22, 0.84, 1.08, 0.62, 0.94, 1.16];
const PHASE = [0, -0.37, -0.71, -0.14, -0.52, -0.88, -0.25, -0.63];
/** Resting heights, so the paused and reduced-motion states still read as a meter. */
const REST = [0.45, 0.28, 0.6, 0.34, 0.5, 0.24, 0.4, 0.55];

/**
 * The little dancing meter that marks the row currently playing.
 *
 * Four bars scaling on the y axis — no canvas, no state, no javascript at all.
 * Each bar's period and phase are a pure function of its index so the pattern
 * is stable across server render, hydration and remount.
 *
 * Under reduced motion (and when `paused`) the bars hold their resting heights
 * instead of vanishing: the meter is carrying "this is the one that's playing",
 * and a flat line would drop that meaning. The `label` is the same information
 * for anyone who can't see the bars at all.
 */
export function SoundBars({
  bars = 4,
  paused = false,
  size = "md",
  accent = "currentColor",
  speed = 1.1,
  label = "playing",
  className,
}: SoundBarsProps) {
  const count = Math.max(1, Math.min(12, Math.round(bars)));
  const s = SIZE[size];

  return (
    <span
      className={cn("inline-flex items-end", s.box, s.gap, className)}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <style precedence="default" href="chrome-sound-bars-keyframes">{`
        @keyframes chrome-sound-bar {
          0%, 100% { transform: scaleY(var(--chrome-bar-low)); }
          50% { transform: scaleY(1); }
        }
        .chrome-sound-bar {
          animation: chrome-sound-bar var(--chrome-bar-period) ease-in-out infinite;
          animation-delay: var(--chrome-bar-phase);
        }
        @media (prefers-reduced-motion: reduce) {
          .chrome-sound-bar { animation: none; transform: scaleY(var(--chrome-bar-rest)); }
        }
      `}</style>

      {Array.from({ length: count }, (_, i) => {
        const rest = REST[i % REST.length]!;
        return (
          <span
            key={i}
            className={cn("h-full origin-bottom", s.bar, !paused && "chrome-sound-bar")}
            style={
              {
                background: accent,
                transform: paused ? `scaleY(${rest})` : undefined,
                "--chrome-bar-period": `${(PERIOD[i % PERIOD.length]! * speed).toFixed(3)}s`,
                "--chrome-bar-phase": `${(PHASE[i % PHASE.length]! * speed).toFixed(3)}s`,
                "--chrome-bar-low": rest.toFixed(2),
                "--chrome-bar-rest": rest.toFixed(2),
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
