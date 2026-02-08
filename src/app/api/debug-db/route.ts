import { NextResponse } from "next/server";

// Only in dev: see which DB host the app is using (no password).
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const url = process.env.POSTGRES_URL;
  if (!url) {
    return NextResponse.json({ host: null, message: "POSTGRES_URL not set" });
  }
  try {
    const u = new URL(url.replace(/^postgres:\/\//, "https://"));
    return NextResponse.json({
      host: u.hostname,
      port: u.port,
      message: u.hostname === "127.0.0.1" || u.hostname === "localhost" ? "Still using localhost — update .env.local with Supabase URL and restart dev server" : "Using remote DB",
    });
  } catch {
    return NextResponse.json({ host: "invalid URL" });
  }
}
