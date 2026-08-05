"use client";

import { useCallback, useEffect, useState } from "react";

export type OwnerState = {
  /** Null until the check comes back — don't flash controls at a listener. */
  owner: boolean | null;
  /** False when no LISTEN_OWNER_KEY is set, so nobody can broadcast at all. */
  configured: boolean;
  signIn: (key: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

/**
 * Whether this browser holds the broadcaster cookie.
 *
 * The answer comes from the server on every load rather than from anything the
 * page stores: the cookie is httpOnly and unreadable here by design, so a
 * client-side flag would only ever be a guess that a devtools edit could flip.
 */
export function useOwner(): OwnerState {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/studio", { cache: "no-store" });
        const payload = (await res.json()) as { owner: boolean; configured: boolean };
        if (cancelled) return;
        setOwner(payload.owner);
        setConfigured(payload.configured);
      } catch {
        if (!cancelled) setOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (key: string) => {
    const res = await fetch("/api/studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      cache: "no-store",
    });
    const ok = res.ok;
    setOwner(ok);
    return ok;
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/studio", { method: "DELETE", cache: "no-store" });
    setOwner(false);
  }, []);

  return { owner, configured, signIn, signOut };
}
