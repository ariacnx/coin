"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface SessionRitualProps {
  sessionId: string;
  initialPayload: Record<string, unknown>;
  isGuest?: boolean;
}

type Phase = "intention" | "reflection" | "ritual" | "toss" | "result" | "analysis";

export function SessionRitual({ sessionId, initialPayload, isGuest = false }: SessionRitualProps) {
  const startPhase: Phase = initialPayload.decision ? "reflection" : "intention";
  const [phase, setPhase] = useState<Phase>(startPhase);
  const [payload, setPayload] = useState({
    decision: (initialPayload.decision as string) ?? "",
    "q-regret": (initialPayload["q-regret"] as string) ?? "",
    "q-fear": (initialPayload["q-fear"] as string) ?? "",
    "q-future": (initialPayload["q-future"] as string) ?? "",
    tossResult: (initialPayload.tossResult as string) ?? null,
    reaction: (initialPayload.reaction as string) ?? null,
    insight: (initialPayload.insight as string) ?? "",
    score: (initialPayload.score as number) ?? 0,
  });
  const [llm, setLlm] = useState<{
    questions: string[];
    summary: string;
    patternHint: string;
    remaining: number;
  } | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerStatus, setRegisterStatus] = useState<"idle" | "loading" | "error">("idle");
  const [registerError, setRegisterError] = useState<string | null>(null);

  const savePayload = useCallback(
    async (updates: Partial<typeof payload>) => {
      const next = { ...payload, ...updates };
      setPayload(next);
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            ...initialPayload,
            ...next,
          },
        }),
        credentials: "include",
      });
    },
    [sessionId, payload, initialPayload]
  );

  const navigate = (p: Phase) => {
    setPhase(p);
    if (p === "ritual") startBreathing();
  };

  const startBreathing = () => {
    // Animation handled by CSS; button appears after delay
  };

  const performToss = () => {
    if (coinFlipping) return;
    setCoinFlipping(true);
    const isHeads = Math.random() > 0.5;
    const result = isHeads ? "YES" : "NO";
    savePayload({ tossResult: result });
    setTimeout(() => {
      setPhase("result");
      setCoinFlipping(false);
    }, 1800);
  };

  const selectReaction = (reaction: string) => {
    const { tossResult } = payload;
    let insight = "";
    let score = 0;
    if (reaction === "Nothing") {
      insight =
        "You feel no spark of reaction to this result. This numbness suggests the question you asked is not the real question at hand.";
      score = 15;
    } else if (reaction === "Relieved") {
      insight = `The coin said ${tossResult}, and your soul exhaled. This relief is the clearest signal. Your subconscious was already leaning toward this outcome.`;
      score = 95;
    } else if (reaction === "Anxious") {
      insight = `The coin landed on ${tossResult}, and your immediate reaction was dread or anxiety. If a "Yes" makes you anxious, your answer is "No".`;
      score = 80;
    }
    savePayload({ reaction, insight, score });
    setPhase("analysis");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterStatus("loading");
    setRegisterError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerEmail, password: registerPassword }),
      credentials: "include",
    });
    setRegisterStatus("idle");
    if (res.ok) {
      setShowRegister(false);
      setRegisterEmail("");
      setRegisterPassword("");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setRegisterError(
      data.error === "email_taken" ? "Email already in use." :
      data.error === "already_registered" ? "You already have an account." :
      "Something went wrong."
    );
  };

  const reflectWithAI = async () => {
    setLlmLoading(true);
    setLlmError(null);
    const context = [
      payload.decision,
      payload["q-regret"],
      payload["q-fear"],
      payload["q-future"],
      payload.tossResult,
      payload.reaction,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("/api/llm/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
      credentials: "include",
    });
    setLlmLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "quota_exceeded") setLlmError("Quota exceeded (10 free calls).");
      else setLlmError("Something went wrong.");
      return;
    }
    const data = await res.json();
    setLlm({ questions: data.questions, summary: data.summary, patternHint: data.patternHint, remaining: data.remaining });
  };

  const showPhase = (p: Phase) => phase === p;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-between items-center py-6">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] font-medium text-gray-400 hover:text-sumi">
          Kettei <span className="opacity-50">/ 決定</span>
        </Link>
        <Link href="/" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          ← Sessions
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 min-h-[600px] relative overflow-hidden">
        {/* Phase I: Intention */}
        {showPhase("intention") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col justify-center">
            <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase I: The Crossroad</p>
            <h1 className="text-3xl md:text-4xl font-light leading-tight mb-12">
              What decision weighs on your mind today?
            </h1>
            <textarea
              value={payload.decision}
              onChange={(e) => setPayload((p) => ({ ...p, decision: e.target.value }))}
              onBlur={() => savePayload({ decision: payload.decision })}
              placeholder="Speak your truth or write it here..."
              className="input-underline w-full py-4 text-xl font-light resize-none h-32 bg-transparent placeholder-gray-300 mb-12"
            />
            <div className="mt-auto flex justify-end">
              <button
                onClick={() => navigate("reflection")}
                className="group flex items-center gap-4 px-8 py-3 rounded-full border border-gray-200 hover:border-kintsugi transition-all"
              >
                <span className="text-xs uppercase tracking-widest text-gray-500 group-hover:text-black">
                  Begin Ritual
                </span>
                <span className="text-lg">→</span>
              </button>
            </div>
          </section>
        )}

        {/* Phase II: Reflection */}
        {showPhase("reflection") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col overflow-y-auto">
            <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase II: Reflection</p>
            <h2 className="text-2xl font-light mb-10">Examine the shadows of this choice.</h2>
            <div className="space-y-12 mb-16">
              <div>
                <label className="block text-sm font-medium mb-3">
                  Would you regret <span className="italic">not</span> taking this path?
                </label>
                <input
                  type="text"
                  value={payload["q-regret"]}
                  onChange={(e) => setPayload((p) => ({ ...p, "q-regret": e.target.value }))}
                  onBlur={() => savePayload({ "q-regret": payload["q-regret"] })}
                  className="input-underline w-full py-2 bg-transparent"
                  placeholder="Why or why not?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">What is the heaviest fear holding you back?</label>
                <input
                  type="text"
                  value={payload["q-fear"]}
                  onChange={(e) => setPayload((p) => ({ ...p, "q-fear": e.target.value }))}
                  onBlur={() => savePayload({ "q-fear": payload["q-fear"] })}
                  className="input-underline w-full py-2 bg-transparent"
                  placeholder="Name the fear..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Where is the &apos;You&apos; of one year from now?</label>
                <input
                  type="text"
                  value={payload["q-future"]}
                  onChange={(e) => setPayload((p) => ({ ...p, "q-future": e.target.value }))}
                  onBlur={() => savePayload({ "q-future": payload["q-future"] })}
                  className="input-underline w-full py-2 bg-transparent"
                  placeholder="Visualize the outcome..."
                />
              </div>
            </div>
            <div className="mt-auto flex justify-between items-center pb-8">
              <button
                onClick={() => navigate("intention")}
                className="text-xs uppercase tracking-widest text-gray-400 hover:text-black"
              >
                Back
              </button>
              <button
                onClick={() => navigate("ritual")}
                className="group flex items-center gap-4 px-8 py-3 rounded-full bg-sumi text-white hover:bg-black transition-all"
              >
                <span className="text-xs uppercase tracking-widest">Enter Silence</span>
              </button>
            </div>
          </section>
        )}

        {/* Phase III: Ritual */}
        {showPhase("ritual") && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-[200px] h-[200px] border border-ajisai/50 rounded-full animate-pulse" />
            <p className="text-xs uppercase tracking-[0.5em] text-ajisai mt-8">Breathe In</p>
            <p className="text-2xl font-light max-w-md leading-relaxed text-gray-600 mt-4 text-center">
              Clear the mind.
              <br />
              The answer is already within you.
            </p>
            <button
              onClick={() => navigate("toss")}
              className="absolute bottom-16 text-xs uppercase tracking-widest border-b border-transparent hover:border-kintsugi pb-1"
            >
              I am ready to receive
            </button>
          </section>
        )}

        {/* Phase IV: Toss */}
        {showPhase("toss") && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className={`coin-container cursor-pointer mb-8 ${coinFlipping ? "pointer-events-none" : ""}`}
              onClick={performToss}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && performToss()}
              aria-label="Tap to toss the coin"
            >
              <div className={`coin ${coinFlipping ? "flip" : ""}`}>
                <span className="text-4xl font-light">?</span>
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mt-2">Phase IV: The Catalyst</p>
            <p className={`text-lg font-light mt-2 transition-opacity duration-300 ${coinFlipping ? "opacity-0" : "animate-pulse"}`}>
              Tap the coin to release control.
            </p>
          </section>
        )}

        {/* Phase V: Result */}
        {showPhase("result") && (
          <section className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Phase V: The Outcome</p>
            <h2 className="text-6xl font-light text-kintsugi mb-12">{payload.tossResult}</h2>
            <p className="text-center text-sm mb-10 text-gray-500 italic">
              How does this revelation make you <span className="italic">actually</span> feel?
            </p>
            <div className="space-y-4 w-full max-w-md">
              {[
                { id: "Relieved", label: "I feel relieved." },
                { id: "Anxious", label: "I feel anxious / disappointed." },
                { id: "Nothing", label: "I feel nothing / numb." },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => selectReaction(id)}
                  className="w-full p-5 bg-white/50 hover:bg-white border border-transparent hover:border-kintsugi rounded-2xl text-left text-sm transition-all flex justify-between items-center group"
                >
                  <span>{label}</span>
                  <span className="opacity-0 group-hover:opacity-100">✓</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Phase VI: Analysis + Reflect with AI */}
        {showPhase("analysis") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col overflow-y-auto">
            <div className="inline-block px-3 py-1 border border-kintsugi rounded-full text-[10px] uppercase tracking-widest text-kintsugi mb-4">
              Phase VI: The Mirror Review
            </div>
            <h2 className="text-3xl font-light mb-10">The mirror reveals your truth.</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/60 p-6 rounded-2xl border border-white">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 block">Your Gut Feeling</span>
                <span className="text-xl font-medium">{payload.reaction === "Nothing" ? "Numbness" : payload.reaction}</span>
              </div>
              <div className="bg-sumi text-white p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                <span className="text-[10px] uppercase tracking-widest opacity-60 mb-2 block">The Coin Said</span>
                <span className="text-3xl font-light text-kintsugi">{payload.tossResult}</span>
              </div>
            </div>

            <div className="bg-paper p-8 rounded-2xl border border-gray-200 mb-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-kintsugi" />
              <h3 className="text-xs uppercase tracking-widest text-ajisai mb-4">Insight</h3>
              <p className="text-lg leading-relaxed font-light italic text-gray-700">{payload.insight}</p>
            </div>

            {isGuest && (
              <div className="mb-8 p-6 rounded-2xl border border-kintsugi/50 bg-white/50">
                <h3 className="text-xs uppercase tracking-widest text-ajisai mb-2">Save your progress</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create an account with email and password to keep your sessions across devices.
                </p>
                {showRegister ? (
                  <form onSubmit={handleRegister}>
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="Email"
                      required
                      className="input-underline w-full py-2 bg-transparent mb-4"
                    />
                    <input
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="Password (min 8 characters)"
                      required
                      minLength={8}
                      className="input-underline w-full py-2 bg-transparent mb-4"
                    />
                    {registerError && <p className="text-sm text-red-500 mb-4">{registerError}</p>}
                    <button
                      type="submit"
                      disabled={registerStatus === "loading"}
                      className="px-6 py-2 rounded-full bg-kintsugi text-white text-sm disabled:opacity-50"
                    >
                      {registerStatus === "loading" ? "Creating..." : "Create account"}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowRegister(true)}
                    className="px-6 py-2 rounded-full border border-kintsugi text-kintsugi text-sm hover:bg-kintsugi hover:text-white transition-colors"
                  >
                    Create account
                  </button>
                )}
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xs uppercase tracking-widest text-ajisai mb-4">Reflect with AI</h3>
              <button
                onClick={reflectWithAI}
                disabled={llmLoading}
                className="px-6 py-3 rounded-full border border-kintsugi text-kintsugi hover:bg-kintsugi hover:text-white transition-colors text-sm uppercase tracking-widest disabled:opacity-50"
              >
                {llmLoading ? "Thinking..." : "Mirror, not Oracle"}
              </button>
              {llmError && <p className="text-sm text-red-500 mt-2">{llmError}</p>}
              {llm && (
                <div className="mt-6 space-y-4">
                  {llm.questions.length > 0 && (
                    <div>
                      <span className="text-xs uppercase tracking-widest text-gray-400">Questions</span>
                      <ul className="list-disc list-inside mt-2 text-gray-700">
                        {llm.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {llm.summary && (
                    <div>
                      <span className="text-xs uppercase tracking-widest text-gray-400">Summary</span>
                      <p className="mt-2 text-gray-700">{llm.summary}</p>
                    </div>
                  )}
                  {llm.patternHint && (
                    <div>
                      <span className="text-xs uppercase tracking-widest text-gray-400">Pattern</span>
                      <p className="mt-2 text-gray-700">{llm.patternHint}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">LLM calls remaining: {llm.remaining}</p>
                </div>
              )}
            </div>

            <div className="mt-auto text-center">
              <Link
                href="/"
                className="text-xs uppercase tracking-widest border-b border-gray-300 hover:border-black pb-1 transition-all"
              >
                Back to Sessions
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
