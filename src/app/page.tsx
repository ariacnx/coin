"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBeginRitual(e: React.FormEvent) {
    e.preventDefault();
    if (!decision.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { decision: decision.trim() } }),
        credentials: "include",
      });

      if (!res.ok) {
        let msg = "Could not start. Try again.";
        try {
          const data = await res.json().catch(() => ({}));
          if (data?.error) msg += ` (${data.error})`;
          else msg += ` (${res.status})`;
        } catch {
          msg += ` (${res.status})`;
        }
        setError(msg);
        return;
      }

      const s = await res.json();
      const id = s?.id;
      if (id) {
        // Use full navigation so the session page loads with the new session
        window.location.href = `/session/${id}`;
      } else {
        setError("Could not start. Try again. (no session id)");
      }
    } catch (err) {
      setError("Could not start. Try again. (network error)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-end py-6">
        <Link
          href="/login"
          className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi"
        >
          Sign in
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 p-8 md:p-16 flex flex-col justify-center">
        <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase I: The Crossroad</p>
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-12">
          What decision weighs on your mind today?
        </h1>

        <form onSubmit={handleBeginRitual}>
          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="Speak your truth or write it here..."
            required
            className="input-underline w-full py-4 text-xl font-light resize-none h-32 bg-transparent placeholder-gray-300 mb-4"
          />
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="group flex items-center gap-4 px-8 py-3 rounded-full border border-gray-200 hover:border-kintsugi transition-all disabled:opacity-50"
            >
              <span className="text-xs uppercase tracking-widest text-gray-500 group-hover:text-black">
                {loading ? "Starting..." : "Begin Ritual"}
              </span>
              <span className="text-lg">→</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
