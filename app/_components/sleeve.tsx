"use client";

import { AlbumArt } from "@/components/chrome/album-art";
import { Vinyl } from "@/components/chrome/vinyl";

export type SleeveProps = {
  art?: string;
  alt: string;
  /** Turns the record while the source is actually playing. */
  spinning: boolean;
};

/**
 * The cover with the record half out of it.
 *
 * The vinyl sits behind the sleeve and slides further out on hover — the whole
 * reason the disc is there is to give the page one thing that moves in time
 * with the music without the music being here.
 */
export function Sleeve({ art, alt, spinning }: SleeveProps) {
  return (
    <div className="group relative w-[240px] shrink-0 sm:w-[280px]">
      <div className="pointer-events-none absolute inset-y-0 left-[38%] hidden w-full items-center sm:flex">
        <Vinyl
          src={art}
          size={240}
          spinning={spinning}
          period={6}
          className="translate-x-0 transition-transform duration-500 ease-out group-hover:translate-x-8"
        />
      </div>
      <AlbumArt src={art} alt={alt} size="full" bleed className="relative z-10" />
    </div>
  );
}
