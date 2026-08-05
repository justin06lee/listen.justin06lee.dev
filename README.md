# listen.justin06lee.dev

my own music player, running in a tab while i work. the library is mp3s that
ship with the site, the playlists are a hand-written file, and whatever i'm
playing is published to a single row so anyone else on the page hears the same
track at the same second.

no accounts, no streaming service, no daemon on the laptop. the website *is*
the player.

## the library

`lib/library.ts` is the entire catalogue — hand-written, versioned with the
site. audio lives in `public/music/` and is referenced by path:

```bash
# drop files into public/music, then
bun run scan     # prints entries for anything not already listed
```

paste what it prints into `TRACKS`, group ids into `PLAYLISTS`, done. `duration`
is optional — the player reads the real length off the file on first play — and
`src` also takes a full URL, so any track that outgrows the repo can move to a
bucket without touching anything else.

keep an eye on the total size in `public/music`. git and most deploys start
complaining somewhere past a few hundred megabytes.

## broadcasting

set `LISTEN_OWNER_KEY`, then visit `/studio?key=…` once on the browser you play
from. the key is exchanged for an httpOnly cookie and dropped from the url
immediately, so it never sits in history or a screenshot. from then on that
browser gets the controls and everyone else gets the listen-only page.

the broadcaster's player posts to `/api/room` on every deliberate change —
track, play, pause, seek — plus a heartbeat every twenty seconds. no word for
ninety seconds and the room goes dark rather than pretending the last track is
still sitting there paused.

## how the sync works

the room row holds `(position, playing, updatedAt)`. reads roll the position
forward on the **server's** clock, and the browser anchors that number against
its own `Date.now()` on arrival — so clock skew between two machines never
enters the arithmetic.

correction runs on the listener's side every two seconds against a predicted
target, not just when a poll lands:

- more than 2s out → seek. something jumped; catch up and stop pretending.
- 0.25–2s out → bend `playbackRate` by up to 5% until the gap closes. inaudible,
  and the alternative is a click every few seconds.
- inside 0.25s → leave it alone.

pressing pause while tuned in takes the controls instead of fighting the
corrector: you drop to your own playback, with a "tune back in" button. picking
anything from the library does the same.

## the room store

turso when `TURSO_DATABASE_URL` is set, an in-process object when it isn't — a
fresh clone runs with no accounts and no env, and the only thing lost is that
the room forgets itself on restart. writes are rare by design (a two-hour
session is a few hundred, not one a second).

`/api/presence` counts tabs that pinged in the last 45 seconds, held in memory.
exact on one instance; behind several it reads low. `lib/presence.ts` is a
drop-in swap for a shared store.

## running it

```bash
bun install
cp .env.example .env.local   # optional — without it, local player only
bun dev
```

## the ui

every component comes from [chrome](https://chrome.justin06lee.dev)
(`bunx @justin06lee/chrome@latest add …`). the audio family — `playhead`,
`album-art`, `vinyl`, `sound-bars`, `spectrum`, `waveform`, `transport`,
`volume`, `track-list`, `lyrics`, `live-badge`, `avatar-stack`, `shelf` — was
built for this site and lives in the registry, so it's owned code here and a
component page there.
