import { heartbeat, leave } from "@/lib/presence";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** Trim to something that can't be used to inject markup or blow up the ui. */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "expected json" }, { status: 400, headers: NO_STORE });
  }

  const { id, name, leaving } = (body ?? {}) as Record<string, unknown>;
  const listenerId = clean(id, 64);
  if (!listenerId) {
    return Response.json({ error: "id is required" }, { status: 400, headers: NO_STORE });
  }

  if (leaving === true) {
    leave(listenerId);
    return new Response(null, { status: 204, headers: NO_STORE });
  }

  const people = heartbeat(listenerId, clean(name, 24) ?? "someone");
  return Response.json(
    { count: people.length, people: people.map(({ id, name }) => ({ id, name })) },
    { headers: NO_STORE },
  );
}
