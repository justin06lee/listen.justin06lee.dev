"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPlaybackTime, usePlaybackClock } from "@/hooks/use-playback-clock";

export type PlayheadSize = "sm" | "md";

export type PlayheadProps = {
  /** Last known position in seconds. */
  position: number;
  /** Track length in seconds. */
  duration: number;
  /**
   * Wall-clock ms (or Date) at which `position` was true. Supply it and the bar
   * advances on its own between updates — the difference between a playhead
   * that moves and one that jumps every poll.
   */
  startedAt?: number | Date;
  /** Advance only while true. Defaults to true. */
  playing?: boolean;
  /** Seconds buffered ahead, drawn as a fainter fill under the played one. */
  buffered?: number;
  /** Makes the bar seekable: click, drag or arrow-key to a position in seconds. */
  onSeek?: (seconds: number) => void;
  /** Track height. Defaults to "sm". */
  size?: PlayheadSize;
  /** Elapsed / total labels under the track. Defaults to true. */
  showTimes?: boolean;
  /** Count the right label down (`-1:23`) instead of showing the total. */
  remaining?: boolean;
  /** CSS color of the played portion. Defaults to white. */
  accent?: string;
  ariaLabel?: string;
  className?: string;
};

const trackHeight: Record<PlayheadSize, string> = {
  sm: "h-0.5",
  md: "h-1",
};

const TICK_MS = 250;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Playback scrubber: elapsed / total, a proportional fill, and optional seeking.
 *
 * Two things separate this from `progress`. It owns a clock — give it
 * `startedAt` and it extrapolates the position between updates, which is what
 * makes a remotely-sourced playhead move smoothly instead of stepping once per
 * poll. And it is seekable: pointer drag, click, and full arrow/Home/End
 * keyboard support against a real `role="slider"`.
 *
 * The fill transitions over exactly one tick interval, linearly, so the
 * interpolation lands precisely as the next tick arrives — a longer or eased
 * transition would visibly lag the true position. Dragging drops the
 * transition, because a scrubber that chases the cursor feels broken.
 */
export function Playhead({
  position,
  duration,
  startedAt,
  playing = true,
  buffered,
  onSeek,
  size = "sm",
  showTimes = true,
  remaining = false,
  accent = "#fff",
  ariaLabel = "seek",
  className,
}: PlayheadProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragRatio, setDragRatio] = React.useState<number | null>(null);

  const live = usePlaybackClock({ position, startedAt, playing, duration, interval: TICK_MS });
  const seekable = typeof onSeek === "function";
  const dragging = dragRatio !== null;

  const ratio = dragging ? dragRatio : duration > 0 ? clamp01(live / duration) : 0;
  const shown = dragging ? dragRatio * duration : live;

  const ratioFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const commit = (next: number) => onSeek?.(clamp01(next) * duration);

  const nudge = (deltaSeconds: number) => {
    if (!seekable || duration <= 0) return;
    commit((live + deltaSeconds) / duration);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!seekable) return;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => nudge(-5),
      ArrowRight: () => nudge(5),
      ArrowDown: () => nudge(-5),
      ArrowUp: () => nudge(5),
      PageDown: () => nudge(-30),
      PageUp: () => nudge(30),
      Home: () => commit(0),
      End: () => commit(1),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const percent = `${ratio * 100}%`;
  const bufferedPercent =
    buffered !== undefined && duration > 0
      ? `${clamp01(buffered / duration) * 100}%`
      : null;

  return (
    <div className={cn("w-full select-none", className)}>
      <div
        ref={trackRef}
        role={seekable ? "slider" : "progressbar"}
        tabIndex={seekable ? 0 : undefined}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatPlaybackTime(shown)} of ${formatPlaybackTime(duration)}`}
        onPointerDown={
          seekable
            ? (event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragRatio(ratioFromPointer(event.clientX));
              }
            : undefined
        }
        onPointerMove={
          seekable && dragging
            ? (event) => setDragRatio(ratioFromPointer(event.clientX))
            : undefined
        }
        onPointerUp={
          seekable
            ? (event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                if (dragRatio !== null) commit(dragRatio);
                setDragRatio(null);
              }
            : undefined
        }
        onPointerCancel={seekable ? () => setDragRatio(null) : undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "group relative -my-2 py-2 outline-none",
          seekable && "cursor-pointer touch-none",
        )}
      >
        <div className={cn("relative w-full overflow-hidden bg-white/15", trackHeight[size])}>
          {bufferedPercent && (
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 bg-white/20"
              style={{ width: bufferedPercent }}
            />
          )}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 ease-linear [transition-property:width]"
            style={{
              width: percent,
              background: accent,
              transitionDuration: dragging || !playing ? "0ms" : `${TICK_MS}ms`,
            }}
          />
        </div>
        {seekable && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 bg-white opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
              dragging && "opacity-100",
            )}
            style={{ left: percent }}
          />
        )}
      </div>

      {showTimes && (
        <div className="mt-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-white/45">
          <span>{formatPlaybackTime(shown)}</span>
          <span>
            {remaining
              ? `-${formatPlaybackTime(Math.max(0, duration - shown))}`
              : formatPlaybackTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
