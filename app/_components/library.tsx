"use client";

import { AlbumArt } from "@/components/chrome/album-art";
import { Shelf } from "@/components/chrome/shelf";
import { TrackList, type Track as TrackRow } from "@/components/chrome/track-list";
import {
  EVERYTHING,
  PLAYLISTS,
  playlistArt,
  playlistTracks,
  type LibraryTrack,
  type Playlist,
} from "@/lib/library";

export type LibraryProps = {
  selected: Playlist;
  onSelectPlaylist: (playlist: Playlist) => void;
  onPlay: (track: LibraryTrack, playlist: Playlist) => void;
  activeTrackId: string | null;
  playing: boolean;
};

function duration(track: LibraryTrack): number | undefined {
  return track.duration;
}

export function Library({
  selected,
  onSelectPlaylist,
  onPlay,
  activeTrackId,
  playing,
}: LibraryProps) {
  const shelves = [EVERYTHING, ...PLAYLISTS];
  const tracks = playlistTracks(selected);

  const rows: TrackRow[] = tracks.map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    art: track.art,
    duration: duration(track),
  }));

  return (
    <div className="flex flex-col gap-10">
      <Shelf title="playlists" itemWidth={148}>
        {shelves.map((playlist) => {
          const art = playlist.id === EVERYTHING.id
            ? playlistArt(EVERYTHING)
            : playlistArt(playlist);
          const count = playlistTracks(playlist).length;
          const active = playlist.id === selected.id;

          return (
            <button
              key={playlist.id}
              type="button"
              onClick={() => onSelectPlaylist(playlist)}
              className="group/tile flex w-full flex-col gap-2 text-left"
            >
              <AlbumArt
                src={art.length > 0 ? art : undefined}
                size="full"
                alt={`${playlist.name}, ${count} tracks`}
                className={
                  active
                    ? "border-white/40"
                    : "transition-colors group-hover/tile:border-white/25"
                }
              />
              <span
                className={
                  "truncate text-[13px] " + (active ? "text-white" : "text-white/75")
                }
              >
                {playlist.name}
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                {count} {count === 1 ? "track" : "tracks"}
              </span>
            </button>
          );
        })}
      </Shelf>

      <TrackList
        label={selected.description ?? selected.name}
        tracks={rows}
        activeId={activeTrackId ?? undefined}
        playing={playing}
        onSelect={(row) => {
          const track = tracks.find((candidate) => candidate.id === row.id);
          if (track) onPlay(track, selected);
        }}
      />
    </div>
  );
}
