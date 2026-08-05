import { createHash, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "listen_owner";

/** Undefined when no key is configured — nobody can broadcast in that case. */
export function ownerKey(): string | undefined {
  const key = process.env.LISTEN_OWNER_KEY;
  return key && key.length > 0 ? key : undefined;
}

/**
 * Constant-time comparison against the configured key.
 *
 * `timingSafeEqual` throws on length mismatch, and a plain length check before
 * it would leak the key's length — so both sides are hashed to a fixed width
 * first and the comparison always runs over the same number of bytes.
 */
export function isOwner(token: string | undefined): boolean {
  const key = ownerKey();
  if (!key || !token) return false;

  const digest = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(digest(token), digest(key));
}

/** The Set-Cookie value that marks this browser as the broadcaster. */
export function ownerCookie(key: string, maxAgeSeconds: number): string {
  const parts = [
    `${OWNER_COOKIE}=${encodeURIComponent(key)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
