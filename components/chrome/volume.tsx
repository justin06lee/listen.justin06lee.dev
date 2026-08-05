"use client";

import * as React from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export type VolumeSize = "sm" | "md";

export type VolumeProps = {
  /** Level, 0–1. */
  value: number;
  onChange: (value: number) => void;
  /** Muted state. Pass it and the icon becomes a mute toggle. */
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  /**
   * Collapse the slider until the control is hovered or focused. For a player
   * bar where volume is secondary to everything beside it.
   */
  collapsible?: boolean;
  /** Track width in px when open. Defaults to 80. */
  width?: number;
  size?: VolumeSize;
  disabled?: boolean;
  className?: string;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Volume: a level-reflecting icon that mutes, plus a filled slider.
 *
 * `range` is the library's general-purpose slider — a bare thumb on a bare
 * track, right for "pick a number". Volume is the specific case that needs
 * more: the fill has to show the level at a glance, muting has to be one click
 * and has to be reversible without losing the level you had, and the icon has
 * to change with the value.
 *
 * Muting keeps `value` untouched and only draws the track dimmed, so unmuting
 * restores exactly where you were. Arrow keys move by 5%, page keys by 20%,
 * and the whole control is one tab stop.
 */
export function Volume({
  value,
  onChange,
  muted = false,
  onMutedChange,
  collapsible = false,
  width = 80,
  size = "md",
  disabled = false,
  className,
}: VolumeProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const level = clamp01(value);
  const effective = muted ? 0 : level;
  const iconSize = size === "sm" ? 14 : 16;
  const Icon = muted || level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  const ratioFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const set = (next: number) => {
    if (disabled) return;
    // Touching the slider is an unambiguous "I want to hear this".
    if (muted && onMutedChange) onMutedChange(false);
    onChange(clamp01(next));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = {
      ArrowLeft: -0.05,
      ArrowDown: -0.05,
      ArrowRight: 0.05,
      ArrowUp: 0.05,
      PageDown: -0.2,
      PageUp: 0.2,
    };
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      set(event.key === "Home" ? 0 : 1);
      return;
    }
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    set(effective + step);
  };

  return (
    <div
      data-chrome-volume={collapsible ? "collapsible" : ""}
      style={collapsible ? ({ "--chrome-volume-width": `${width}px` } as React.CSSProperties) : undefined}
      className={cn("inline-flex items-center gap-2", disabled && "opacity-40", className)}
    >
      {collapsible && (
        <style precedence="default" href="chrome-volume-collapsible">{`
          [data-chrome-volume="collapsible"] [data-chrome-volume-track] {
            width: 0;
            opacity: 0;
            transition: width 200ms ease, opacity 200ms ease;
          }
          [data-chrome-volume="collapsible"]:hover [data-chrome-volume-track],
          [data-chrome-volume="collapsible"]:focus-within [data-chrome-volume-track] {
            width: var(--chrome-volume-width);
            opacity: 1;
          }
          @media (prefers-reduced-motion: reduce) {
            [data-chrome-volume="collapsible"] [data-chrome-volume-track] { transition: none; }
          }
        `}</style>
      )}

      <button
        type="button"
        disabled={disabled || !onMutedChange}
        onClick={() => onMutedChange?.(!muted)}
        aria-label={muted ? "unmute" : "mute"}
        aria-pressed={onMutedChange ? muted : undefined}
        className={cn(
          "inline-flex shrink-0 items-center justify-center text-white/60 transition-colors",
          size === "sm" ? "size-6" : "size-7",
          onMutedChange && !disabled && "hover:text-white",
        )}
      >
        <Icon size={iconSize} aria-hidden />
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? undefined : 0}
        aria-label="volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(effective * 100)}
        aria-valuetext={muted ? "muted" : `${Math.round(level * 100)} percent`}
        aria-disabled={disabled || undefined}
        onKeyDown={disabled ? undefined : handleKeyDown}
        onPointerDown={
          disabled
            ? undefined
            : (event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                set(ratioFromPointer(event.clientX));
              }
        }
        onPointerMove={
          dragging && !disabled ? (event) => set(ratioFromPointer(event.clientX)) : undefined
        }
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        data-chrome-volume-track=""
        className={cn(
          "group relative -my-2 py-2 outline-none",
          !disabled && "cursor-pointer touch-none",
          collapsible && "overflow-hidden",
        )}
        style={collapsible ? undefined : { width }}
      >
        <div className={cn("relative w-full overflow-hidden bg-white/15", size === "sm" ? "h-0.5" : "h-1")}>
          <div
            aria-hidden
            className={cn("absolute inset-y-0 left-0", muted ? "bg-white/25" : "bg-white")}
            style={{ width: `${level * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 bg-white opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
            dragging && "opacity-100",
          )}
          style={{ left: `${level * 100}%` }}
        />
      </div>
    </div>
  );
}
