import type { NextRequest } from "next/server";
import { isOwner, OWNER_COOKIE, ownerCookie, ownerKey } from "@/lib/owner";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const A_YEAR = 60 * 60 * 24 * 365;

/** Whether this browser holds the broadcaster cookie. */
export async function GET(request: NextRequest) {
  return Response.json(
    {
      owner: isOwner(request.cookies.get(OWNER_COOKIE)?.value),
      configured: Boolean(ownerKey()),
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  const key = ownerKey();
  if (!key) {
    return Response.json(
      { error: "no broadcaster key configured" },
      { status: 503, headers: NO_STORE },
    );
  }

  let submitted: unknown;
  try {
    submitted = ((await request.json()) as { key?: unknown }).key;
  } catch {
    return Response.json({ error: "expected json" }, { status: 400, headers: NO_STORE });
  }

  if (typeof submitted !== "string" || !isOwner(submitted)) {
    return Response.json({ error: "wrong key" }, { status: 401, headers: NO_STORE });
  }

  // The key rides in an httpOnly cookie from here on, so no script on the page
  // — ours or anyone else's — can read it back out.
  return Response.json(
    { owner: true },
    { headers: { ...NO_STORE, "Set-Cookie": ownerCookie(submitted, A_YEAR) } },
  );
}

export async function DELETE() {
  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "Set-Cookie": ownerCookie("", 0) },
  });
}
