import { createClient, type Client } from "@libsql/client";

export type RoomState = {
  trackId: string | null;
  playlistId: string | null;
  /** Position in seconds, true as of `updatedAt`. */
  position: number;
  playing: boolean;
  /** Server ms. Every timestamp here is the server's clock, never a client's. */
  updatedAt: number;
};

/** No word from the broadcaster in this long and the room is considered dark. */
export const STALE_MS = 90_000;

const EMPTY: RoomState = {
  trackId: null,
  playlistId: null,
  position: 0,
  playing: false,
  updatedAt: 0,
};

/**
 * One row, holding what is playing.
 *
 * Turso when it's configured, an in-process object when it isn't — a fresh
 * clone runs with no accounts and no env, and the only thing lost is that the
 * room forgets itself when the server restarts.
 *
 * Writes are rare by design: the broadcaster posts on track change, play,
 * pause and seek, plus a heartbeat every twenty seconds. Position between
 * those is extrapolated on read, so a two-hour listening session is a few
 * hundred writes rather than one per second.
 */
let client: Client | null = null;
let ready: Promise<void> | null = null;
let memory: RoomState = { ...EMPTY };

function turso(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  client ??= createClient({ url, authToken });
  return client;
}

async function schema(db: Client): Promise<void> {
  ready ??= db
    .execute(
      `CREATE TABLE IF NOT EXISTS room_state (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         track_id TEXT,
         playlist_id TEXT,
         position REAL NOT NULL DEFAULT 0,
         playing INTEGER NOT NULL DEFAULT 0,
         updated_at INTEGER NOT NULL DEFAULT 0
       )`,
    )
    .then(() => undefined);
  return ready;
}

export async function readRoom(): Promise<RoomState> {
  const db = turso();
  if (!db) return { ...memory };

  await schema(db);
  const result = await db.execute("SELECT * FROM room_state WHERE id = 1");
  const row = result.rows[0];
  if (!row) return { ...EMPTY };

  return {
    trackId: (row.track_id as string | null) ?? null,
    playlistId: (row.playlist_id as string | null) ?? null,
    position: Number(row.position ?? 0),
    playing: Number(row.playing ?? 0) === 1,
    updatedAt: Number(row.updated_at ?? 0),
  };
}

export async function writeRoom(next: Omit<RoomState, "updatedAt">): Promise<RoomState> {
  const state: RoomState = { ...next, updatedAt: Date.now() };

  const db = turso();
  if (!db) {
    memory = state;
    return state;
  }

  await schema(db);
  await db.execute({
    sql: `INSERT INTO room_state (id, track_id, playlist_id, position, playing, updated_at)
          VALUES (1, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            track_id = excluded.track_id,
            playlist_id = excluded.playlist_id,
            position = excluded.position,
            playing = excluded.playing,
            updated_at = excluded.updated_at`,
    args: [
      state.trackId,
      state.playlistId,
      state.position,
      state.playing ? 1 : 0,
      state.updatedAt,
    ],
  });
  return state;
}

export type RoomSnapshot = {
  trackId: string | null;
  playlistId: string | null;
  /** Position extrapolated to the instant of this read, on the server clock. */
  position: number;
  playing: boolean;
  /** False once the broadcaster has been quiet past STALE_MS. */
  live: boolean;
  /** Seconds since the last word from the broadcaster. */
  silentFor: number;
};

/**
 * The room as of right now.
 *
 * Position is rolled forward here rather than in the browser, so both ends of
 * the calculation use the same clock. The client then anchors this number
 * against its own `Date.now()` on arrival, which keeps clock skew between two
 * machines out of the arithmetic entirely.
 */
export function snapshot(state: RoomState): RoomSnapshot {
  const silentFor = state.updatedAt === 0 ? Infinity : (Date.now() - state.updatedAt) / 1000;
  const live = silentFor * 1000 < STALE_MS;

  return {
    trackId: state.trackId,
    playlistId: state.playlistId,
    position: state.playing && live ? state.position + silentFor : state.position,
    // A stale room is never "playing", however it was left.
    playing: state.playing && live,
    live,
    silentFor: Number.isFinite(silentFor) ? silentFor : -1,
  };
}
