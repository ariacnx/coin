import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { SessionRitual } from "@/components/SessionRitual";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Auth is done via getUserIdFromRequest - we need the request
  // Next.js doesn't pass req to page by default - we use headers()
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const req = new Request("http://localhost", { headers: Object.fromEntries(headersList) });
  const userId = await getUserIdFromRequest(req);

  if (!userId) redirect("/");

  const r = await pool.query(
    "select s.payload_json, u.email from sessions s join users u on u.id = s.user_id where s.id = $1 and s.user_id = $2 and s.deleted_at is null",
    [id, userId]
  );
  if (r.rows.length === 0) redirect("/");

  const payload = (r.rows[0].payload_json ?? {}) as Record<string, unknown>;
  const isGuest = r.rows[0].email == null;

  return <SessionRitual sessionId={id} initialPayload={payload} isGuest={isGuest} />;
}
