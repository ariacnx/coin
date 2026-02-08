import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const putSchema = z.object({ payload: z.record(z.unknown()) });

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser(req);
  const { id } = await params;
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const r = await pool.query(
    "update sessions set payload_json = $1, updated_at = now() where id = $2 and user_id = $3 and deleted_at is null returning id",
    [JSON.stringify(parsed.data.payload), id, userId]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireUser(req);
  const { id } = await params;

  const r = await pool.query(
    "update sessions set deleted_at = now(), updated_at = now() where id = $1 and user_id = $2 and deleted_at is null returning id",
    [id, userId]
  );
  if (r.rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
