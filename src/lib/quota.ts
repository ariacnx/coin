import { pool } from "./db";

const LLM_QUOTA = 10;

export async function getLlmUsage(userId: string): Promise<number> {
  const r = await pool.query(
    "select count(*)::int as c from usage_ledger where user_id = $1 and action = $2",
    [userId, "llm_reflect"]
  );
  return r.rows[0]?.c ?? 0;
}

export async function checkLlmQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const used = await getLlmUsage(userId);
  if (used >= LLM_QUOTA) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: LLM_QUOTA - used - 1 };
}

export async function recordLlmUsage(userId: string): Promise<void> {
  await pool.query("insert into usage_ledger (user_id, action) values ($1, $2)", [userId, "llm_reflect"]);
}
