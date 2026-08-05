"use client";

import * as React from "react";
import {
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type RepeatMode = "off" | "all" | "one";
export type TransportSize = "sm" | "md" | "lg";

export type TransportProps = {
  playing: boolean;
  onPlayPause: () => void;
  /** Omit either skip and its button doesn't render. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** Pass with onShuffleChange to show the shuffle toggle. */
  shuffle?: boolean;
  onShuffleChange?: (next: boolean) => void;
  /** Pass with onRepeatChange to show the repeat toggle; it cycles off → all → one. */
  repeat?: RepeatMode;
  onRepeatChange?: (next: RepeatMode) => void;
  /** Spinner in place of the play glyph — buffering, or waiting on a remote. */
  loading?: boolean;
  size?: TransportSize;
  disabled?: boolean;
  className?: string;
};

const SIZE: Record<TransportSize, { primary: string; secondary: string; icon: number; skip: number; gap: string }> = {
  sm: { primary: "size-8", secondary: "size-7", icon: 14, skip: 13, gap: "gap-1" },
  md: { primary: "size-10", secondary: "size-9", icon: 18, skip: 16, gap: "gap-1.5" },
  lg: { primary: "size-12", secondary: "size-10", icon: 22, skip: 18, gap: "gap-2" },
};

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };

/**
 * Playback controls: skip, play/pause, and the two toggles that belong with them.
 *
 * Every control is optional and appears only when you hand it a callback, so
 * the same component covers a full player and a listen-only page with nothing
 * but a play button. The primary action is the solid one — the single filled
 * element in a dark ui reads as "this is the button", which is exactly right
 * for the one that starts the sound.
 *
 * Shuffle and repeat render their state as a lit glyph with an underline dot
 * rather than a colour, since the library has no colour to spend; repeat cycles
 * off → all → one on a single button and announces the mode it moves to.
 */
export function Transport({
  playing,
  onPlayPause,
  onPrevious,
  onNext,
  shuffle,
  onShuffleChange,
  repeat = "off",
  onRepeatChange,
  loading = false,
  size = "md",
  disabled = false,
  className,
}: TransportProps) {
  const s = SIZE[size];

  const secondary = (
    label: string,
    icon: React.ReactNode,
    onClick: (() => void) | undefined,
    active = false,
  ) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "relative inline-flex items-center justify-center transition-colors disabled:opacity-30",
          s.secondary,
          active ? "text-white" : "text-white/55 hover:text-white",
          !disabled && "hover:bg-white/5",
        )}
      >
        {icon}
        {active && <span aria-hidden className="absolute bottom-0.5 size-[3px] bg-white" />}
      </button>
    ) : null;

  return (
    <div className={cn("flex items-center", s.gap, className)}>
      {secondary(
        "shuffle",
        <Shuffle size={s.skip} aria-hidden />,
        onShuffleChange ? () => onShuffleChange(!shuffle) : undefined,
        Boolean(shuffle),
      )}
      {secondary("previous track", <SkipBack size={s.skip} aria-hidden />, onPrevious)}

      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled || loading}
        aria-label={playing ? "pause" : "play"}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center bg-white text-black transition-colors",
          "hover:bg-white/90 disabled:opacity-40",
          s.primary,
        )}
      >
        {loading ? (
          <Loader2 size={s.icon} className="animate-spin motion-reduce:animate-none" aria-hidden />
        ) : playing ? (
          <Pause size={s.icon} aria-hidden />
        ) : (
          <Play size={s.icon} aria-hidden />
        )}
      </button>

      {secondary("next track", <SkipForward size={s.skip} aria-hidden />, onNext)}
      {secondary(
        repeat === "one" ? "repeat: one — switch to off" : repeat === "all" ? "repeat: all — switch to one" : "repeat: off — switch to all",
        repeat === "one" ? (
          <Repeat1 size={s.skip} aria-hidden />
        ) : (
          <Repeat size={s.skip} aria-hidden />
        ),
        onRepeatChange ? () => onRepeatChange(NEXT_REPEAT[repeat]) : undefined,
        repeat !== "off",
      )}
    </div>
  );
}
