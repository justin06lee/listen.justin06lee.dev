"use client";

import { useEffect, useState } from "react";

export type PlaybackClockOptions = {
  /** Playback position, in seconds, at the instant `startedAt` was captured. */
  position: number;
  /**
   * Wall-clock ms (or Date) at which `position` was true. Omit for a static
   * position — the clock then reports `position` unchanged.
   */
  startedAt?: number | Date;
  /** Only advance while true. Defaults to true. */
  playing?: boolean;
  /** Upper bound in seconds. The clock never reports past it. */
  duration?: number;
  /** Tick interval in ms. Defaults to 250. */
  interval?: number;
};

/**
 * Extrapolates a playback position between updates.
 *
 * A remote source of truth — a now-playing endpoint, a websocket, another
 * listener's session — can only be sampled every few seconds, but a playhead
 * has to move every frame or it reads as broken. This takes the last known
 * `(position, startedAt)` pair and reports `position + (now - startedAt)`,
 * so the ui stays smooth between samples and snaps back to the truth on each
 * new one.
 *
 * SSR-safe: the elapsed offset is zero until mount, because `Date.now()` in
 * the initial state would differ between the server render and hydration.
 * Pausing tears the interval down rather than leaving it spinning.
 */
export function usePlaybackClock({
  position,
  startedAt,
  playing = true,
  duration,
  interval = 250,
}: PlaybackClockOptions): number {
  const anchor =
    startedAt === undefined
      ? undefined
      : startedAt instanceof Date
        ? startedAt.getTime()
        : startedAt;
  const ticking = playing && anchor !== undefined;

  const [now, setNow] = useState<number | null>(null);

  // `position` and `anchor` are dependencies on purpose: a fresh sample should
  // reset the tick phase immediately instead of waiting out the current one.
  // Nothing is set synchronously here — until the first tick lands the hook
  // reports the sampled position, which is exactly what it was told.
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), Math.max(50, interval));
    return () => clearInterval(id);
  }, [ticking, interval, position, anchor]);

  const clamp = (value: number) =>
    Math.min(duration ?? Number.POSITIVE_INFINITY, Math.max(0, value));

  if (!ticking || now === null || anchor === undefined) return clamp(position);
  // A reading taken before the current anchor goes negative and clamps to zero,
  // so a stale tick after a pause or a seek reports the sample, never the past.
  return clamp(position + Math.max(0, (now - anchor) / 1000));
}

/** `4:07`, or `1:02:30` once an hour is on the clock. Negative input clamps to zero. */
export function formatPlaybackTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
