import { cookies } from "next/headers";
import { verify, sign } from "./crypto";
import { pool } from "./db";

const COOKIE = "kettei_session";

export interface SessionPayload {
  userId: string;
  exp: number;
}

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE)?.value;
  if (!raw) return null;

  const payload = verify(raw);
  if (!payload) return null;

  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(payload) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof parsed.userId !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp * 1000 < Date.now()) return null;
  return parsed.userId;
}

export async function requireUser(req: Request): Promise<string> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    throw new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return userId;
}

export async function getOrCreateGuestUser(req: Request): Promise<string> {
  const existing = await getUserIdFromRequest(req);
  if (existing) return existing;

  const r = await pool.query(
    "insert into users (email, password_hash) values (null, null) returning id"
  );
  const userId = r.rows[0].id;

  const payload = JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
  const sessionToken = sign(payload);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return userId;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const payload = JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });
  const sessionToken = sign(payload);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}
