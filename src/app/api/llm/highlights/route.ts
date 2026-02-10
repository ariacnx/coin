import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth";
import { ratelimitPerIp, ratelimitPerUser } from "@/lib/ratelimit";
import { checkLlmQuota, recordLlmUsage } from "@/lib/quota";
import { pool } from "@/lib/db";
import { env } from "@/lib/env";

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function json500(detail: string) {
  return NextResponse.json(
    { error: "llm_error", detail },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  try {
    const ip = getIp(req);
    const rlIp = await ratelimitPerIp.limit(ip);
    if (!rlIp.success) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    let userId: string;
    try {
      userId = await requireUser(req);
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const rlUser = await ratelimitPerUser.limit(userId);
    if (!rlUser.success) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }

    const { allowed, remaining } = await checkLlmQuota(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "quota_exceeded", remaining: 0 },
        { status: 402 }
      );
    }

    let body: { currentSessionId?: string };
    try {
      body = (await req.json()) as { currentSessionId?: string };
    } catch {
      body = {};
    }
    const currentSessionId =
      typeof body.currentSessionId === "string" && body.currentSessionId.trim().length > 0
        ? body.currentSessionId
        : null;

    const r = await pool.query(
      `select id, payload_json
       from sessions
       where user_id = $1 and deleted_at is null
       order by updated_at desc
       limit 25`,
      [userId]
    );

    const highlights = r.rows
      .filter((row) => !currentSessionId || row.id !== currentSessionId)
      .map((row) => row.payload_json as Record<string, unknown>)
      .map((p) => ({
        decision: typeof p.decision === "string" ? p.decision : "",
        insight: typeof p.insight === "string" ? p.insight : "",
        reaction: typeof p.reaction === "string" ? p.reaction : "",
        category:
          typeof p.category === "string"
            ? p.category === "others" && typeof p.categoryOther === "string" && p.categoryOther
              ? `others (${p.categoryOther})`
              : p.category
            : "",
      }))
      .filter((x) => x.insight || x.decision)
      .slice(0, 10);

    if (highlights.length === 0) {
      return NextResponse.json({ error: "no_highlights" }, { status: 400 });
    }

    const highlightsText = highlights
      .map(
        (h, i) =>
          `#${i + 1}\nCategory: ${h.category || "unknown"}\nDecision: ${h.decision || "n/a"}\nReaction: ${
            h.reaction || "n/a"
          }\nInsight: ${h.insight || "n/a"}`
      )
      .join("\n\n");

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a warm, caring reflection coach (therapist-like tone, not clinical). Your job is to help the user learn from past decisions with compassion, clarity, and practicality.\n\nRules:\n- Return JSON only. No markdown. No extra keys.\n- Keep it concise, gentle, and non-judgmental.\n- Do NOT diagnose or mention mental health conditions.\n- Use \"you\" language and validate emotions briefly (without being overly verbose).\n- Base everything strictly on the highlights; don't invent details.\n- Offer small, doable steps; avoid big life advice.\nOutput must include exactly:\n- \"pattern\": 1-2 sentences summarizing a recurring theme you notice.\n- \"guidance\": 1-2 sentences offering a kind reframe + how to approach similar moments.\n- \"nextAction\": one concrete action the user can do in under 10 minutes.\n\nIf the highlights show mixed or conflicting pulls, name the tension kindly (e.g., \"part of you wants X, and part of you wants Y\").",
        },
        {
          role: "user",
          content:
            `Reflect on these past decision highlights with a caring, therapist-like tone. Return JSON with exactly these keys:\n` +
            `"pattern" (1-2 sentences), "guidance" (1-2 sentences), "nextAction" (one concrete action under 10 minutes).\n\n` +
            `Focus on:\n` +
            `- recurring needs/values showing up\n` +
            `- common emotional reactions (without judgment)\n` +
            `- one gentle, practical experiment for next time\n\n` +
            `Highlights:\n${highlightsText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    await recordLlmUsage(userId);

    const content = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { pattern?: string; guidance?: string; nextAction?: string };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      pattern: parsed.pattern ?? "",
      guidance: parsed.guidance ?? "",
      nextAction: parsed.nextAction ?? "",
      remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("LLM HIGHLIGHTS ERROR:", message);
    return json500(message);
  }
}
