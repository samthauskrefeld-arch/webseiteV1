import "server-only";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "./auth/session";

/** For Server Components: the logged-in user (or null). */
export async function currentUser() {
  const jar = await cookies();
  return getSessionUser(jar.get(SESSION_COOKIE)?.value);
}

export async function currentMe() {
  const u = await currentUser();
  if (!u) return null;
  const { sessionId: _s, ...me } = u;
  return me;
}
