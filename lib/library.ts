/**
 * The library. This file is the whole catalogue — hand-written, versioned with
 * the site, no database and no admin ui.
 *
 * Audio lives in `public/music/` and is referenced by path (`/music/foo.mp3`).
 * `src` also accepts a full URL, so any track that gets too big for the repo
 * can move to a bucket without touching anything else.
 *
 * `bun run scan` walks public/music and prints entries for anything not
 * already listed here, so adding files is: drop them in, run it, paste.
 */

export type LibraryTrack = {
  /** Stable id — the room state stores this, so don't renumber casually. */
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** Path under public/ (e.g. "/music/glass.mp3") or an absolute URL. */
  src: string;
  /** Cover path or URL. Optional; the tile falls back to a disc glyph. */
  art?: string;
  /**
   * Length in seconds. Optional — the player reads the real duration off the
   * file on first play. Filling it in just means the track list shows a length
   * before anyone has played it.
   */
  duration?: number;
};

export type Playlist = {
  id: string;
  name: string;
  description?: string;
  /** Ids from TRACKS, in play order. Unknown ids are ignored, not fatal. */
  trackIds: string[];
};

export const TRACKS: LibraryTrack[] = [
  // {
  //   id: "glass",
  //   title: "glass",
  //   artist: "someone",
  //   album: "a record",
  //   src: "/music/glass.mp3",
  //   art: "/music/art/a-record.jpg",
  // },
];

export const PLAYLISTS: Playlist[] = [
  // {
  //   id: "work",
  //   name: "work",
  //   description: "for the hours that need to disappear",
  //   trackIds: ["glass"],
  // },
];

const BY_ID = new Map(TRACKS.map((track) => [track.id, track]));

export function trackById(id: string | null | undefined): LibraryTrack | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

export function playlistById(id: string | null | undefined): Playlist | null {
  return id ? (PLAYLISTS.find((playlist) => playlist.id === id) ?? null) : null;
}

/** A playlist's tracks, skipping ids that no longer resolve. */
export function playlistTracks(playlist: Playlist | null | undefined): LibraryTrack[] {
  if (!playlist) return [];
  return playlist.trackIds
    .map((id) => BY_ID.get(id))
    .filter((track): track is LibraryTrack => Boolean(track));
}

/** Up to four distinct covers, for the mosaic tile a playlist gets instead of art. */
export function playlistArt(playlist: Playlist): string[] {
  const seen: string[] = [];
  for (const track of playlistTracks(playlist)) {
    if (track.art && !seen.includes(track.art)) seen.push(track.art);
    if (seen.length === 4) break;
  }
  return seen;
}

/** Every track, as its own playlist — what "the whole library" means. */
export const EVERYTHING: Playlist = {
  id: "everything",
  name: "everything",
  description: "the whole library, in the order it was added",
  trackIds: TRACKS.map((track) => track.id),
};

export const LIBRARY_IS_EMPTY = TRACKS.length === 0;
