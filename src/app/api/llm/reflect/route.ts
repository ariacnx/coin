import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth";
import { ratelimitPerIp, ratelimitPerUser } from "@/lib/ratelimit";
import { checkLlmQuota, recordLlmUsage } from "@/lib/quota";
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

    let body: { context?: string };
    try {
      body = (await req.json()) as { context?: string };
    } catch {
      body = {};
    }

    const context = typeof body.context === "string" ? body.context : "";

    const systemPrompt = `You are a Mirror, not an Oracle. Your role is to reflect back insights about the user's decision-making context—questions they might not have asked, patterns you notice, and a brief summary—without prescribing what they should do. Be concise and supportive.`;

    const userPrompt = context
      ? `The user shared this decision context:\n\n${context}\n\nRespond with a JSON object containing exactly these keys: "questions" (array of 2-4 reflective questions), "summary" (1-2 sentence summary), "patternHint" (one short observation about a pattern).`
      : `The user has not shared context yet. Respond with a JSON object containing: "questions" (array of 2-3 generic reflective questions), "summary" (empty string), "patternHint" (empty string).`;

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    await recordLlmUsage(userId);

    const content = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { questions?: string[]; summary?: string; patternHint?: string };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      parsed = { questions: [], summary: "", patternHint: "" };
    }

    return NextResponse.json({
      questions: parsed.questions ?? [],
      summary: parsed.summary ?? "",
      patternHint: parsed.patternHint ?? "",
      remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("LLM REFLECT ERROR:", message);
    if (err instanceof Error && err.cause) console.error("LLM REFLECT CAUSE:", err.cause);
    return json500(message);
  }
}
