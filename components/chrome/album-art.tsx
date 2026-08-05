"use client";

import * as React from "react";
import { Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlbumArtSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";

export type AlbumArtProps = {
  /**
   * Cover URL. Omit (or let it fail to load) and the fallback takes over.
   *
   * An array is a mosaic — the shape a playlist or a folder has instead of a
   * cover. Up to four are laid out so the tile is always fully covered: two
   * become halves, three a half and two quarters, four a grid.
   */
  src?: string | string[];
  /** Describe the record, not the picture — "cover of Kid A by Radiohead". */
  alt?: string;
  /** Fixed sizes, or "full" to fill the container as a square. Defaults to "md". */
  size?: AlbumArtSize;
  /**
   * Bleed a blurred copy of the art out behind the tile. The ambient wash a
   * cover throws onto a dark page — off by default, since it only reads at
   * lg and up.
   */
  bleed?: boolean;
  /** Node shown when there is no art. Defaults to a disc glyph on a faint fill. */
  fallback?: React.ReactNode;
  /** Renders the tile as a button. */
  onClick?: () => void;
  /** Renders the tile as a link. */
  href?: string;
  /** Anchor component for internal hrefs (e.g. next/link). Defaults to a plain <a>. */
  linkComponent?: React.ElementType;
  /** Overlay drawn on top of the art — a play button, a hover scrim. */
  overlay?: React.ReactNode;
  className?: string;
};

const SIZE: Record<AlbumArtSize, string> = {
  xs: "size-8",
  sm: "size-10",
  md: "size-16",
  lg: "size-24",
  xl: "size-40",
  full: "w-full aspect-square",
};

const GLYPH: Record<AlbumArtSize, number> = {
  xs: 12,
  sm: 14,
  md: 20,
  lg: 28,
  xl: 40,
  full: 40,
};

/**
 * Square cover tile: art, or an honest placeholder when there isn't any.
 *
 * Cover URLs are the least reliable part of any music api — expired cdn links,
 * podcasts with no art at all, local files. So the fallback is a first-class
 * state, not an accident: `onError` swaps to it, and the tile keeps its exact
 * footprint, because a hole that changes size shifts the whole layout.
 *
 * A plain `<img>`, not a framework image component — like everything else in
 * the library, this has to work outside next.js. `loading="lazy"` and
 * `decoding="async"` are still there.
 */
export function AlbumArt({
  src,
  alt = "",
  size = "md",
  bleed = false,
  fallback,
  onClick,
  href,
  linkComponent,
  overlay,
  className,
}: AlbumArtProps) {
  // The urls that failed, rather than a boolean — a new src is then a fresh
  // attempt by construction, with no reset effect to forget. One bad cover
  // never poisons the tile for the track after it.
  const [failed, setFailed] = React.useState<string[]>([]);
  const markFailed = (url: string) => setFailed((f) => (f.includes(url) ? f : [...f, url]));

  const urls = (Array.isArray(src) ? src : src ? [src] : [])
    .filter((url) => !failed.includes(url))
    .slice(0, 4);
  const glyph = GLYPH[size];

  const picture = (url: string, index: number, extra?: string) => (
    <img
      key={`${url}-${index}`}
      src={url}
      alt={index === 0 ? alt : ""}
      loading="lazy"
      decoding="async"
      onError={() => markFailed(url)}
      className={cn("size-full object-cover", extra)}
    />
  );

  const inner = (
    <>
      {urls.length === 0 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-white/[0.04] text-white/25">
          {fallback ?? <Disc3 size={glyph} strokeWidth={1.25} aria-hidden />}
        </span>
      ) : urls.length === 1 ? (
        <span className="absolute inset-0">{picture(urls[0]!, 0)}</span>
      ) : (
        // Two halves, or a half plus two quarters, or a grid — whichever fills
        // the square with the covers actually available. The first tile spans
        // both rows below four, so there is never a visible empty cell.
        <span className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-white/10">
          {urls.map((url, index) =>
            picture(url, index, index === 0 && urls.length < 4 ? "row-span-2" : undefined),
          )}
        </span>
      )}
      {overlay}
    </>
  );

  const frame = cn(
    "relative block shrink-0 overflow-hidden border border-white/10 bg-black",
    SIZE[size],
    (onClick || href) && "transition-colors hover:border-white/25",
    className,
  );

  const Link = linkComponent ?? "a";
  const tile = href ? (
    <Link href={href} className={frame} aria-label={alt || undefined}>
      {inner}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={frame} aria-label={alt || undefined}>
      {inner}
    </button>
  ) : (
    <div className={frame}>{inner}</div>
  );

  if (!bleed) return tile;

  return (
    <div className={cn("relative isolate", size === "full" ? "w-full" : "inline-block")}>
      {urls[0] && (
        <img
          src={urls[0]}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute inset-0 -z-10 size-full scale-125 object-cover opacity-40 blur-2xl saturate-150"
        />
      )}
      {tile}
    </div>
  );
}
