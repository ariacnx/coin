import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const r = await pool.query("select id, email from users where id = $1", [userId]);
  if (r.rows.length === 0) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const row = r.rows[0];
  return NextResponse.json({
    user: {
      id: row.id,
      email: row.email,
      isGuest: row.email == null,
    },
  });
}
