"use client";

import { useEffect, useRef } from "react";
import type { Player } from "./use-audio-player";
import type { RoomFeed } from "./use-room";

/** How often to compare our position against the room's. */
const CORRECT_MS = 2000;

/**
 * Holds the local player against the room.
 *
 * The room is sampled every few seconds, but the correction runs on its own
 * faster loop against a *predicted* target — the last snapshot rolled forward
 * by however long ago it arrived. Correcting only on arrival would mean drift
 * accumulating freely in between and being yanked out every five seconds.
 *
 * `player.syncTo` decides how to close the gap: a big one is a seek, a small
 * one is a fractional change in playback rate. That's the difference between
 * listening along and being clicked at.
 */
export function useTuneIn(player: Player, feed: RoomFeed, enabled: boolean): void {
  const current = useRef({ player, feed });
  useEffect(() => {
    current.current = { player, feed };
  });

  useEffect(() => {
    if (!enabled) return;

    const correct = () => {
      const { player: p, feed: f } = current.current;
      const room = f.room;
      if (!room?.trackId) return;

      const elapsed = f.receivedAt > 0 ? (Date.now() - f.receivedAt) / 1000 : 0;
      const target = room.playing ? room.position + elapsed : room.position;

      p.syncTo({ trackId: room.trackId, position: target, playing: room.playing });
    };

    correct();
    const id = setInterval(correct, CORRECT_MS);
    return () => {
      clearInterval(id);
      // Leaving sync must not leave the element playing at 1.03x forever.
      current.current.player.resetRate();
    };
  }, [enabled]);
}
