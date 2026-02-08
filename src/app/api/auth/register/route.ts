import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireUser, setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const userId = await requireUser(req);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", message: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;

  const existing = await pool.query("select id from users where email = $1", [email]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const r = await pool.query("select email from users where id = $1", [userId]);
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (r.rows[0].email != null) {
    return NextResponse.json({ error: "already_registered" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    "update users set email = $1, password_hash = $2 where id = $3",
    [email, passwordHash, userId]
  );

  await setSessionCookie(userId);
  return NextResponse.json({ ok: true });
}
