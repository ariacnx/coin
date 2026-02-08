import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { getUserIdFromRequest, getOrCreateGuestUser } from "@/lib/auth";

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json([]);
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  let query = "select id, created_at, updated_at, payload_json from sessions where user_id = $1 and deleted_at is null";
  const params: (string | Date)[] = [userId];

  if (since) {
    query += " and updated_at > $2";
    params.push(since);
  }
  query += " order by updated_at desc";

  const r = await pool.query(query, params);
  return NextResponse.json(
    r.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      payload: row.payload_json,
    }))
  );
}

const postSchema = z.object({ payload: z.record(z.unknown()).default({}) });

export async function POST(req: Request) {
  const userId = await getOrCreateGuestUser(req);
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const r = await pool.query(
    "insert into sessions (user_id, payload_json) values ($1, $2) returning id, created_at, updated_at, payload_json",
    [userId, JSON.stringify(parsed.data.payload)]
  );
  const row = r.rows[0];
  return NextResponse.json({
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    payload: row.payload_json,
  });
}
