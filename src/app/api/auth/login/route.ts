import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const r = await pool.query(
    "select id, password_hash from users where email = $1",
    [email]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const user = r.rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
