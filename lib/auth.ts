/**
 * Tiny single-password gate.
 *
 * The whole app + API is protected by one shared password set in `APP_PASSWORD`
 * (server env). On success we store a cookie holding the SHA-256 of the password
 * — never the plaintext — so rotating `APP_PASSWORD` invalidates old sessions.
 *
 * Uses Web Crypto only, so it works in both the Edge middleware and Node routes.
 */

export const AUTH_COOKIE = "foodapp_auth";

/** Hex SHA-256 of the input. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whether the password gate is enabled (i.e. APP_PASSWORD is configured). */
export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}
