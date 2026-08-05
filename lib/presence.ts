export type Listener = {
  id: string;
  name: string;
  seenAt: number;
};

/** A tab that hasn't pinged in this long has closed or gone to sleep. */
const TTL_MS = 45_000;

/**
 * Who is in the room, held in memory.
 *
 * This is deliberately the smallest thing that is *true*: it counts tabs that
 * have pinged this server process in the last 45 seconds. On a single instance
 * that is exactly right. Behind several serverless instances each one sees only
 * its own share, so the count reads low — swap this module for a shared store
 * (redis, upstash) and nothing above it changes.
 */
const listeners = new Map<string, Listener>();

function prune(now: number) {
  for (const [id, listener] of listeners) {
    if (now - listener.seenAt > TTL_MS) listeners.delete(id);
  }
}

export function heartbeat(id: string, name: string): Listener[] {
  const now = Date.now();
  prune(now);
  listeners.set(id, { id, name, seenAt: now });
  // Most recently seen first, so the stack's leading faces are the live ones.
  return [...listeners.values()].sort((a, b) => b.seenAt - a.seenAt);
}

export function leave(id: string): void {
  listeners.delete(id);
}
