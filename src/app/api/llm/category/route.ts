import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth";
import { ratelimitPerIp, ratelimitPerUser } from "@/lib/ratelimit";
import { env } from "@/lib/env";

type Category = "career" | "relationship" | "others";

function getIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function normalizeCategory(v: unknown): Category {
  if (typeof v !== "string") return "others";
  const x = v.toLowerCase();
  if (x === "career" || x === "relationship" || x === "others") return x;
  return "others";
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

    let body: { context?: string };
    try {
      body = (await req.json()) as { context?: string };
    } catch {
      body = {};
    }

    const context = typeof body.context === "string" ? body.context.trim() : "";
    if (!context) {
      return NextResponse.json({ category: "others", reason: "" });
    }

    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You classify user decision prompts into exactly one category: career, relationship, or others. Return compact JSON only.",
        },
        {
          role: "user",
          content:
            `Classify this decision context into one category.\n\nContext:\n${context}\n\n` +
            `Return JSON with keys: "category" ("career" | "relationship" | "others") and "reason" (short sentence).`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { category?: unknown; reason?: unknown };
    try {
      parsed = JSON.parse(content) as typeof parsed;
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      category: normalizeCategory(parsed.category),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("LLM CATEGORY ERROR:", message);
    return json500(message);
  }
}
