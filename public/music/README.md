# drop audio files here

mp3, m4a, ogg, opus, flac or wav. then `bun run scan` and paste what it prints
into TRACKS in lib/library.ts.

files in here are committed with the site and served straight from /music/…, so
keep an eye on the total: git and most deploys start to complain somewhere past
a few hundred megabytes. a track that outgrows that can move to a bucket — set
its `src` to the full url and nothing else changes.
