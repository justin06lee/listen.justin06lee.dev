"use client";

import * as React from "react";
import { AlbumArt } from "@/components/chrome/album-art";
import { SoundBars } from "@/components/chrome/sound-bars";
import { cn } from "@/lib/utils";

export type Track = {
  id: string;
  title: React.ReactNode;
  artist?: React.ReactNode;
  /** Length in seconds. */
  duration?: number;
  /** Cover url. Only used when `art` is on. */
  art?: string;
  href?: string;
  /** Right-hand caption in place of the duration — "3m ago", "added by ana". */
  meta?: React.ReactNode;
  /** Dimmed and unclickable — a region-locked or removed track. */
  unavailable?: boolean;
};

export type TrackListProps = {
  tracks: Track[];
  /** The current track. Gets the meter (or the paused meter) in place of its index. */
  activeId?: string;
  /** Whether the active track is actually sounding. Defaults to true. */
  playing?: boolean;
  onSelect?: (track: Track) => void;
  /** Show a cover thumbnail per row instead of a position number. */
  art?: boolean;
  /** Number the rows. Ignored when `art` is on. Defaults to true. */
  numbered?: boolean;
  /** Anchor component for internal hrefs (e.g. next/link). Defaults to a plain <a>. */
  linkComponent?: React.ElementType;
  /** Mono uppercase caption above the list. */
  label?: React.ReactNode;
  /** Rendered in place of the rows when `tracks` is empty. */
  empty?: React.ReactNode;
  className?: string;
};

/** `3:07`. Undefined durations render as an em dash rather than 0:00. */
function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * A queue, a history, a tracklist — rows of title / artist / duration with the
 * current one marked by a live meter.
 *
 * The marker replaces the row's number rather than sitting beside it. Keeping
 * both would push every row's text sideways by a few pixels the moment playback
 * moved, and a list that reflows while you read it is worse than one that loses
 * a number you can already infer.
 *
 * `manager-table` is for editing records and `article-list` for browsing cards;
 * this is the read-and-pick case, so a row is one control — a link when it has
 * an href, a button when it has a handler, and inert markup when it has
 * neither, instead of a clickable div.
 */
export function TrackList({
  tracks,
  activeId,
  playing = true,
  onSelect,
  art = false,
  numbered = true,
  linkComponent,
  label,
  empty,
  className,
}: TrackListProps) {
  const Link = linkComponent ?? "a";

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          {label}
        </div>
      )}

      {tracks.length === 0 ? (
        empty ?? (
          <div className="border border-dashed border-white/15 px-5 py-8 text-center text-[13px] text-white/40">
            nothing here yet
          </div>
        )
      ) : (
        <ul className="border border-white/10">
          {tracks.map((track, index) => {
            const active = track.id === activeId;
            const interactive = !track.unavailable && (Boolean(track.href) || Boolean(onSelect));

            const lead = art ? (
              <AlbumArt src={track.art} size="sm" alt="" className="border-white/10" />
            ) : (
              <span className="flex w-6 shrink-0 justify-center font-mono text-[11px] tabular-nums text-white/35">
                {active ? (
                  <SoundBars
                    size="sm"
                    paused={!playing}
                    label={null}
                    className="text-white"
                  />
                ) : numbered ? (
                  index + 1
                ) : null}
              </span>
            );

            const body = (
              <>
                {lead}
                {art && active && (
                  <SoundBars size="sm" paused={!playing} label={null} className="shrink-0 text-white" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-[14px]",
                      active ? "text-white" : "text-white/85",
                      track.unavailable && "text-white/35 line-through",
                    )}
                  >
                    {track.title}
                  </span>
                  {track.artist && (
                    <span className="truncate text-[12px] text-white/45">{track.artist}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/40">
                  {track.meta ?? formatDuration(track.duration)}
                </span>
              </>
            );

            const rowClass = cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
              interactive && "hover:bg-white/[0.04]",
              active && "bg-white/[0.03]",
              track.unavailable && "cursor-not-allowed",
            );

            return (
              <li
                key={track.id}
                aria-current={active ? "true" : undefined}
                className={index < tracks.length - 1 ? "border-b border-white/10" : undefined}
              >
                {track.href && !track.unavailable ? (
                  <Link href={track.href} className={rowClass}>
                    {body}
                  </Link>
                ) : onSelect && !track.unavailable ? (
                  <button type="button" onClick={() => onSelect(track)} className={rowClass}>
                    {body}
                  </button>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
