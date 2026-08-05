/**
 * Walks public/music and prints library entries for anything not already in
 * lib/library.ts. Paste the output into TRACKS.
 *
 * Duration comes from `ffprobe` when it's on PATH; without it the field is
 * omitted, which is fine — the player reads the real length off the file on
 * first play. It only affects whether a track shows its length before anyone
 * has played it.
 *
 *   bun run scan
 */

import { readdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { TRACKS } from "../lib/library";

const MUSIC_DIR = join(process.cwd(), "public", "music");
const AUDIO = new Set([".mp3", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wav"]);

/** "04 - Some Song.mp3" → "some song"; "artist - title.mp3" → both halves. */
function guess(file: string): { id: string; title: string; artist: string } {
  const name = basename(file, extname(file))
    .replace(/^\d+\s*[-._]\s*/, "")
    .replace(/_/g, " ")
    .trim();

  const [left, right] = name.split(/\s+-\s+/, 2);
  const title = (right ?? left ?? name).toLowerCase();
  const artist = right ? left!.toLowerCase() : "unknown";

  const id = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48);

  return { id: id || "track", title, artist };
}

async function probeDuration(path: string): Promise<number | undefined> {
  try {
    const proc = Bun.spawn(
      [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path,
      ],
      { stdout: "pipe", stderr: "ignore" },
    );
    const out = await new Response(proc.stdout).text();
    if ((await proc.exited) !== 0) return undefined;
    const seconds = Number(out.trim());
    return Number.isFinite(seconds) ? Math.round(seconds) : undefined;
  } catch {
    return undefined;
  }
}

const known = new Set(TRACKS.map((track) => track.src));
let files: string[];

try {
  files = (await readdir(MUSIC_DIR)).filter((file) => AUDIO.has(extname(file).toLowerCase()));
} catch {
  console.error(`no public/music directory yet — create it and drop files in.`);
  process.exit(1);
}

const fresh = files.filter((file) => !known.has(`/music/${file}`)).sort();

if (fresh.length === 0) {
  console.log(`nothing new — all ${files.length} file(s) in public/music are already in the library.`);
  process.exit(0);
}

const usedIds = new Set(TRACKS.map((track) => track.id));
const entries: string[] = [];

for (const file of fresh) {
  const { id, title, artist } = guess(file);
  // Two files can reasonably guess the same id; make it unique rather than
  // handing back a manifest that silently loses a track.
  let unique = id;
  let n = 2;
  while (usedIds.has(unique)) unique = `${id}-${n++}`;
  usedIds.add(unique);

  const seconds = await probeDuration(join(MUSIC_DIR, file));
  entries.push(
    [
      `  {`,
      `    id: ${JSON.stringify(unique)},`,
      `    title: ${JSON.stringify(title)},`,
      `    artist: ${JSON.stringify(artist)},`,
      `    src: ${JSON.stringify(`/music/${file}`)},`,
      seconds !== undefined ? `    duration: ${seconds},` : `    // duration: read on first play`,
      `  },`,
    ].join("\n"),
  );
}

console.log(`// ${fresh.length} new file(s) — paste into TRACKS in lib/library.ts\n`);
console.log(entries.join("\n"));
