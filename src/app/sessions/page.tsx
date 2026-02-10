"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SessionItem = {
  id: string;
  created_at: string;
  updated_at: string;
  payload: Record<string, unknown>;
};

export default function SessionsPage() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/sessions", { credentials: "include" });
      if (!res.ok) {
        setError("Could not load session history.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as SessionItem[];
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    void run();
  }, []);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-between py-6">
        <Link href="/question" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          ← Back
        </Link>
        <Link href="/login" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          Sign in
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 p-8 md:p-16">
        <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Session History</p>
        <h1 className="text-2xl md:text-3xl font-light leading-tight mb-8">Your past reflections</h1>

        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500">No sessions yet. Start your first journey.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((s) => {
              const decision =
                typeof s.payload?.decision === "string" && s.payload.decision.trim().length > 0
                  ? s.payload.decision
                  : "Untitled session";
              const updated = new Date(s.updated_at).toLocaleString();
              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="block p-5 rounded-2xl bg-white/60 border border-white hover:border-kintsugi transition-colors"
                >
                  <p className="text-base md:text-lg font-light text-gray-800 mb-2 line-clamp-2">{decision}</p>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Last updated: {updated}</p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
