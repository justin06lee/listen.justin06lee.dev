import type { NextRequest } from "next/server";
import { trackById } from "@/lib/library";
import { isOwner, OWNER_COOKIE, ownerKey } from "@/lib/owner";
import { readRoom, snapshot, writeRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const state = await readRoom();
  return Response.json(snapshot(state), { headers: NO_STORE });
}

type Body = {
  trackId?: unknown;
  playlistId?: unknown;
  position?: unknown;
  playing?: unknown;
};

export async function POST(request: NextRequest) {
  if (!ownerKey()) {
    return Response.json(
      { error: "no broadcaster key configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!isOwner(request.cookies.get(OWNER_COOKIE)?.value)) {
    return Response.json({ error: "not the broadcaster" }, { status: 401, headers: NO_STORE });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "expected json" }, { status: 400, headers: NO_STORE });
  }

  const trackId = typeof body.trackId === "string" ? body.trackId : null;
  // The room can only ever point at something in the library. A track id that
  // doesn't resolve would leave every listener stuck on a track they can't
  // load, with no way to tell that from a slow network.
  if (trackId !== null && !trackById(trackId)) {
    return Response.json({ error: "unknown track" }, { status: 400, headers: NO_STORE });
  }

  const position = typeof body.position === "number" && Number.isFinite(body.position)
    ? Math.max(0, body.position)
    : 0;

  const state = await writeRoom({
    trackId,
    playlistId: typeof body.playlistId === "string" ? body.playlistId : null,
    position,
    playing: body.playing === true,
  });

  return Response.json(snapshot(state), { headers: NO_STORE });
}
