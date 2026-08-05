"use client";

import { useEffect, useState } from "react";

export type Listener = { id: string; name: string };

const PING_MS = 15_000;
const STORAGE_KEY = "listen:identity";

const ADJECTIVES = [
  "quiet", "late", "amber", "slow", "north", "paper", "velvet", "static",
  "winter", "hollow", "second", "distant", "low", "soft", "iron",
];
const NOUNS = [
  "moth", "signal", "harbour", "kestrel", "tape", "lantern", "river", "ember",
  "atlas", "sparrow", "drift", "pier", "cassette", "fox", "beacon",
];

/** A stable handle per browser, so the room isn't a wall of question marks. */
function identity(): Listener {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Listener;
      if (parsed?.id && parsed?.name) return parsed;
    } catch {
      // Corrupt entry — fall through and mint a fresh one.
    }
  }
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
  const next: Listener = {
    id: crypto.randomUUID(),
    name: `${pick(ADJECTIVES)} ${pick(NOUNS)}`,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * Heartbeats this tab into the room and reports who else is in it.
 *
 * `sendBeacon` on the way out, because a normal fetch fired during `pagehide`
 * is cancelled with the page — the beacon is the only request the browser
 * promises to deliver after you've closed the tab.
 */
export function usePresence(): { people: Listener[]; count: number } {
  const [people, setPeople] = useState<Listener[]>([]);

  useEffect(() => {
    // Minted inside the effect: identity() reads localStorage, which doesn't
    // exist on the server, and nothing rendered depends on who we are.
    const self = identity();

    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(self),
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { people: Listener[] };
        if (!cancelled) setPeople(payload.people ?? []);
      } catch {
        // A missed heartbeat just means the room forgets us for a cycle.
      }
    };

    void ping();
    const id = setInterval(ping, PING_MS);

    const onHide = () => {
      navigator.sendBeacon?.(
        "/api/presence",
        new Blob([JSON.stringify({ id: self.id, leaving: true })], { type: "application/json" }),
      );
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, []);

  return { people, count: people.length };
}
