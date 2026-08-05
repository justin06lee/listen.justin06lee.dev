"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "./use-audio-player";

export type RoomSnapshot = {
  trackId: string | null;
  playlistId: string | null;
  position: number;
  playing: boolean;
  live: boolean;
  silentFor: number;
};

export type RoomFeed = {
  room: RoomSnapshot | null;
  /** `Date.now()` when this snapshot landed — the anchor for extrapolation. */
  receivedAt: number;
  status: "connecting" | "live" | "quiet" | "offline";
  refresh: () => void;
};

const POLL_MS = 5000;
const OFFLINE_AFTER = 2;

/**
 * Polls the room and keeps the last good snapshot.
 *
 * The snapshot's `position` is already rolled forward to the moment the server
 * read it; pairing that with the client's own arrival time is what keeps clock
 * skew between two machines out of the sync maths entirely.
 *
 * Polling stops while the tab is hidden and resumes on focus with an immediate
 * read, so a page left open overnight isn't hammering the database for nobody.
 */
export function useRoom(enabled = true): RoomFeed {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [status, setStatus] = useState<RoomFeed["status"]>("connecting");
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/room", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as RoomSnapshot;
      failures.current = 0;
      setRoom(payload);
      setReceivedAt(Date.now());
      setStatus(payload.playing ? "live" : payload.live ? "quiet" : "offline");
    } catch {
      failures.current += 1;
      if (failures.current >= OFFLINE_AFTER) setStatus("offline");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      await poll();
      if (cancelled) return;
      const delay = failures.current > 0
        ? Math.min(30_000, POLL_MS * 2 ** failures.current)
        : POLL_MS;
      timer.current = setTimeout(run, delay);
    };

    const stop = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    const onVisibility = () => {
      stop();
      if (document.visibilityState === "visible") void run();
    };

    void run();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [enabled, poll]);

  return { room, receivedAt, status, refresh: () => void poll() };
}

const HEARTBEAT_MS = 20_000;

/**
 * Publishes the broadcaster's player to the room.
 *
 * Posts on every deliberate change — the player's `epoch` — plus a heartbeat,
 * which is what lets listeners tell "paused" from "he closed the laptop": a
 * room with no word for ninety seconds goes dark rather than pretending the
 * last track is still sitting there paused.
 */
export function useBroadcast(player: Player, playlistId: string | null, enabled: boolean): void {
  // Read the live player inside the timer without restarting it every beat.
  const current = useRef({ player, playlistId });
  useEffect(() => {
    current.current = { player, playlistId };
  });

  const send = useCallback(async () => {
    const { player: p, playlistId: list } = current.current;
    // Extrapolate to now: the sample can be up to a second old, and a listener
    // syncing off a stale number starts behind and has to catch up.
    const position = p.playing
      ? p.sample.position + (Date.now() - p.sample.at) / 1000
      : p.sample.position;

    try {
      await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: p.track?.id ?? null,
          playlistId: list,
          position: p.track ? position : 0,
          playing: Boolean(p.track) && p.playing,
        }),
        cache: "no-store",
      });
    } catch {
      // A dropped beat is harmless; the next one carries the same state.
    }
  }, []);

  // Deliberate changes go out immediately.
  const epoch = player.epoch;
  const sentEpoch = useRef(-1);
  useEffect(() => {
    if (!enabled || sentEpoch.current === epoch) return;
    sentEpoch.current = epoch;
    void send();
  }, [enabled, epoch, send]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void send(), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled, send]);
}
