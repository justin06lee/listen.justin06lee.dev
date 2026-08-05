"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/chrome/button";
import { useOwner } from "@/hooks/use-owner";

export function StudioForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { owner, configured, signIn, signOut } = useOwner();

  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // `/studio?key=…` signs in and immediately drops the key from the url, so it
  // doesn't sit in history, the referer header, or a screenshot.
  const fromUrl = params.get("key");
  useEffect(() => {
    if (!fromUrl) return;
    let cancelled = false;
    void (async () => {
      const ok = await signIn(fromUrl);
      if (cancelled) return;
      router.replace(ok ? "/" : "/studio");
      if (!ok) setError("that key didn't work");
    })();
    return () => {
      cancelled = true;
    };
  }, [fromUrl, router, signIn]);

  if (!configured && owner !== null) {
    return (
      <div className="border border-dashed border-white/15 px-5 py-6 text-[13px] leading-6 text-white/50">
        no <code className="text-white/70">LISTEN_OWNER_KEY</code> is set on the
        server, so nothing can broadcast. add one to the environment and restart.
      </div>
    );
  }

  if (owner) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-white/70">this browser is the broadcaster.</p>
        <div className="flex items-center gap-3">
          <Button variant="solid" href="/">
            go to the player
          </Button>
          <Button
            onClick={() => {
              void signOut();
            }}
          >
            sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        const ok = await signIn(key);
        setBusy(false);
        if (ok) router.replace("/");
        else setError("that key didn't work");
      }}
    >
      <input
        type="password"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder="broadcaster key"
        autoComplete="current-password"
        aria-label="broadcaster key"
        className="w-full border border-white/20 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
      />
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      <Button type="submit" variant="solid" disabled={busy || key.length === 0}>
        {busy ? "checking" : "unlock"}
      </Button>
    </form>
  );
}
