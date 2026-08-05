"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ShelfProps = {
  /** The cards. Each is given `itemWidth` and made unshrinkable. */
  children: React.ReactNode;
  /** Mono uppercase heading above the row. */
  title?: React.ReactNode;
  /** Right-hand slot on the title line — a "see all" link, a count. */
  action?: React.ReactNode;
  /** Width of each item in px. Defaults to 176. */
  itemWidth?: number;
  /** Gap between items in px. Defaults to 16. */
  gap?: number;
  /** Paging buttons, shown only when the row actually overflows. Defaults to true. */
  arrows?: boolean;
  /** Snap each item to the left edge as you scroll. Defaults to true. */
  snap?: boolean;
  /** Accessible name for the scroll region. Falls back to `title` when it's a string. */
  ariaLabel?: string;
  className?: string;
};

/**
 * A horizontally scrolling row of cards.
 *
 * `gallery` is the searchable grid you send someone to when they're looking for
 * a specific thing. A shelf is the opposite errand: a browsable row you skim,
 * stacked with other rows, where the point is that there is more off the edge
 * of the screen.
 *
 * The arrows only appear once the content genuinely overflows, and each one
 * disables itself at its end — a paging control that does nothing when clicked
 * is worse than no control. Overflow is measured with a ResizeObserver rather
 * than assumed from the item count, because the same six cards overflow on a
 * phone and don't on a desktop.
 *
 * Scrolling is native, so trackpads, touch, shift+wheel and keyboard all work
 * without being reimplemented; the arrows just call `scrollBy`. The row is a
 * focusable region with a name, so keyboard users can reach it and arrow
 * through it directly.
 */
export function Shelf({
  children,
  title,
  action,
  itemWidth = 176,
  gap = 16,
  arrows = true,
  snap = true,
  ariaLabel,
  className,
}: ShelfProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const overflow = track.scrollWidth - track.clientWidth;
      // A pixel of slack: sub-pixel layout means scrollLeft rarely lands
      // exactly on the maximum, and a permanently-enabled arrow looks broken.
      setEdges({
        start: track.scrollLeft > 1,
        end: overflow > 1 && track.scrollLeft < overflow - 1,
      });
    };

    measure();
    track.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);

    return () => {
      track.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [children, itemWidth, gap]);

  const page = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Whole items, and never the full width — leaving one card visible keeps
    // your place instead of teleporting to unfamiliar content.
    const step = Math.max(itemWidth + gap, track.clientWidth - (itemWidth + gap));
    track.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  };

  const overflowing = edges.start || edges.end;
  const label = ariaLabel ?? (typeof title === "string" ? title : undefined);

  return (
    <section className={cn("w-full", className)}>
      {(title || action || arrows) && (
        <div className="mb-3 flex items-center justify-between gap-4">
          {title && (
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
              {title}
            </div>
          )}
          <div className="flex items-center gap-2">
            {action}
            {arrows && overflowing && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => page(-1)}
                  disabled={!edges.start}
                  aria-label="scroll left"
                  className="inline-flex size-7 items-center justify-center border border-white/15 text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => page(1)}
                  disabled={!edges.end}
                  aria-label="scroll right"
                  className="inline-flex size-7 items-center justify-center border border-white/15 text-white/60 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={14} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={cn(
          "flex overflow-x-auto overflow-y-hidden outline-none",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          snap && "snap-x snap-mandatory",
        )}
        style={{
          gap,
          // Fade the edge the content continues past, so an overflowing row
          // reads as cut off rather than as ending there.
          maskImage: edges.end
            ? edges.start
              ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 48px), transparent)"
              : "linear-gradient(to right, black calc(100% - 48px), transparent)"
            : edges.start
              ? "linear-gradient(to right, transparent, black 24px)"
              : undefined,
          WebkitMaskImage: edges.end
            ? edges.start
              ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 48px), transparent)"
              : "linear-gradient(to right, black calc(100% - 48px), transparent)"
            : edges.start
              ? "linear-gradient(to right, transparent, black 24px)"
              : undefined,
        }}
      >
        {React.Children.map(children, (child) =>
          child == null || child === false ? null : (
            <div
              className={cn("shrink-0", snap && "snap-start")}
              style={{ width: itemWidth }}
            >
              {child}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
