"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

interface SessionRitualProps {
  sessionId: string;
  initialPayload: Record<string, unknown>;
  isGuest?: boolean;
}

type Phase = "intention" | "category" | "reflection" | "ritual" | "toss" | "result" | "analysis";
type CategoryOption = "career" | "relationship" | "others";
type SpeechField = "decision" | "q-regret" | "q-fear" | "q-future" | "categoryOther";

export function SessionRitual({ sessionId, initialPayload, isGuest = false }: SessionRitualProps) {
  const DEBUG_INSIGHT = false;
  const startPhase: Phase = initialPayload.decision
    ? (initialPayload.category ? "reflection" : "category")
    : "intention";
  const [phase, setPhase] = useState<Phase>(startPhase);
  const [payload, setPayload] = useState({
    decision: (initialPayload.decision as string) ?? "",
    category: (initialPayload.category as string) ?? "",
    categoryOther: (initialPayload.categoryOther as string) ?? "",
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
    remaining: number;
  } | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [highlightsAnalysis, setHighlightsAnalysis] = useState<{
    pattern: string;
    guidance: string;
    nextAction: string;
    remaining: number;
  } | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategoryOption | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const categoryRequestedRef = useRef(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechTarget, setSpeechTarget] = useState<SpeechField | null>(null);
  const recognitionRef = useRef<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerStatus, setRegisterStatus] = useState<"idle" | "loading" | "error">("idle");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const guestStorageHydratedRef = useRef(false);
  const payloadRef = useRef(payload);
  const lastAutoInsightKeyRef = useRef("");
  const guestStorageKey = `kettei:guest:session:${sessionId}`;

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const savePayload = useCallback(
    async (updates: Partial<typeof payload>) => {
      const latest = payloadRef.current;
      const next = { ...latest, ...updates };
      if (DEBUG_INSIGHT && Object.prototype.hasOwnProperty.call(updates, "insight")) {
        console.log("[INSIGHT] savePayload called", {
          sessionId,
          incomingInsight: (updates as { insight?: unknown }).insight,
          previousInsight: latest.insight,
          nextInsight: next.insight,
        });
      }
      setPayload(next);
      const resp = await fetch(`/api/sessions/${sessionId}`, {
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
      if (DEBUG_INSIGHT && Object.prototype.hasOwnProperty.call(updates, "insight")) {
        console.log("[INSIGHT] savePayload persisted", {
          ok: resp.ok,
          status: resp.status,
        });
      }
    },
    [sessionId, initialPayload]
  );

  const navigate = (p: Phase) => {
    setPhase(p);
    if (p === "ritual") startBreathing();
  };

  useEffect(() => {
    if (phase !== "category") return;
    if (categoryRequestedRef.current) return;
    if (!payload.decision.trim()) return;

    categoryRequestedRef.current = true;
    setCategoryLoading(true);
    setCategoryError(null);

    const run = async () => {
      const res = await fetch("/api/llm/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: payload.decision }),
        credentials: "include",
      });
      setCategoryLoading(false);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCategoryError(data.detail ?? "Could not analyze category.");
        return;
      }

      const data = await res.json();
      const normalized: CategoryOption =
        data.category === "career" || data.category === "relationship" || data.category === "others"
          ? data.category
          : "others";

      setCategorySuggestion(normalized);
      setPayload((prev) => (prev.category ? prev : { ...prev, category: normalized }));
    };

    void run();
  }, [phase, payload.decision]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognitionCtor));
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isGuest) return;
    if (typeof window === "undefined") return;
    if (guestStorageHydratedRef.current) return;

    guestStorageHydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(guestStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { payload?: Partial<typeof payload>; phase?: Phase };
      if (parsed.payload && typeof parsed.payload === "object") {
        setPayload((prev) => ({ ...prev, ...parsed.payload }));
      }
      if (parsed.phase) {
        setPhase(parsed.phase);
      }
    } catch {
      // Ignore malformed local backup
    }
  }, [guestStorageKey, isGuest]);

  useEffect(() => {
    if (!isGuest) return;
    if (typeof window === "undefined") return;
    if (!guestStorageHydratedRef.current) return;

    try {
      window.localStorage.setItem(
        guestStorageKey,
        JSON.stringify({
          payload,
          phase,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage write failures
    }
  }, [guestStorageKey, isGuest, payload, phase]);

  useEffect(() => {
    if (!DEBUG_INSIGHT) return;
    console.log("[INSIGHT] state change", {
      phase,
      reaction: payload.reaction,
      tossResult: payload.tossResult,
      payloadInsight: payload.insight,
      fallbackInsight,
      visibleInsight,
    });
  }, [phase, payload.reaction, payload.tossResult, payload.insight]);

  const startBreathing = () => {
    // Animation handled by CSS; button appears after delay
  };

  const deriveInsight = (reaction: string, tossResult: string | null) => {
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
    return { insight, score };
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
    const { insight, score } = deriveInsight(reaction, tossResult);
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

  const buildReflectContext = useCallback(
    () =>
      [
        payload.decision,
        payload["q-regret"],
        payload["q-fear"],
        payload["q-future"],
        payload.tossResult,
        payload.reaction,
      ]
        .filter(Boolean)
        .join("\n"),
    [payload]
  );

  const reflectWithAI = async () => {
    setLlmLoading(true);
    setLlmError(null);
    const context = buildReflectContext();

    const res = await fetch("/api/llm/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
      credentials: "include",
    });
    setLlmLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "quota_exceeded") setLlmError("Quota exceeded (100 free calls).");
      else setLlmError(data.detail ?? "Something went wrong.");
      if (DEBUG_INSIGHT) {
        console.log("[INSIGHT] reflectWithAI failed", data);
      }
      return;
    }
    const data = await res.json();
    if (DEBUG_INSIGHT) {
      console.log("[INSIGHT] reflectWithAI success", data);
    }
    const questions = Array.isArray(data.questions)
      ? data.questions.filter((q: unknown) => typeof q === "string" && q.trim().length > 0)
      : [];
    const placeholderQuestions = [
      "What do you already know is true, but have been avoiding?",
      "If you removed fear of disappointing others, what would you choose?",
      "What is one small step that would move you toward relief today?",
    ];
    setLlm({
      questions: questions.length > 0 ? questions : placeholderQuestions,
      remaining: typeof data.remaining === "number" ? data.remaining : 0,
    });

    // Keep the main Insight panel in sync with Mirror output
    const mirrorInsight = [data.summary, data.patternHint]
      .map((x: unknown) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(" ");
    if (mirrorInsight) {
      await savePayload({ insight: mirrorInsight });
      setInsightError(null);
    } else if (DEBUG_INSIGHT) {
      console.log("[INSIGHT] reflectWithAI returned empty summary/patternHint");
    }
  };

  const generateInsightWithAI = useCallback(async () => {
    setInsightLoading(true);
    setInsightError(null);
    const context = buildReflectContext();

    const res = await fetch("/api/llm/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
      credentials: "include",
    });
    setInsightLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "quota_exceeded") setInsightError("Quota exceeded (100 free calls).");
      else setInsightError(data.detail ?? "Could not generate insight.");
      if (DEBUG_INSIGHT) {
        console.log("[INSIGHT] generateInsightWithAI failed", data);
      }
      return;
    }

    const data = await res.json();
    if (DEBUG_INSIGHT) {
      console.log("[INSIGHT] generateInsightWithAI success", data);
    }
    const nextInsight = [data.summary, data.patternHint]
      .map((x: unknown) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(" ");
    if (!nextInsight) {
      const fallbackQuestion = Array.isArray(data.questions) && data.questions.length > 0 ? String(data.questions[0]) : "";
      if (fallbackQuestion) {
        await savePayload({ insight: fallbackQuestion });
        setInsightError(null);
        return;
      }
      setInsightError("No insight returned from model. Try again.");
      return;
    }

    await savePayload({ insight: nextInsight });
  }, [buildReflectContext, savePayload]);

  useEffect(() => {
    if (phase !== "analysis") return;
    if (insightLoading) return;
    if (payload.insight && payload.insight.trim().length > 0) return;
    if (!payload.reaction || !payload.tossResult) return;

    const key = `${sessionId}|${payload.reaction}|${payload.tossResult}|${payload.decision}`;
    if (lastAutoInsightKeyRef.current === key) return;
    lastAutoInsightKeyRef.current = key;
    void generateInsightWithAI();
  }, [
    phase,
    insightLoading,
    payload.insight,
    payload.reaction,
    payload.tossResult,
    payload.decision,
    sessionId,
    generateInsightWithAI,
  ]);

  const analyzePastHighlights = async () => {
    setHighlightsLoading(true);
    setHighlightsError(null);
    setHighlightsAnalysis(null);

    const res = await fetch("/api/llm/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentSessionId: sessionId }),
      credentials: "include",
    });
    setHighlightsLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "quota_exceeded") setHighlightsError("Quota exceeded (100 free calls).");
      else if (data.error === "no_highlights") setHighlightsError("No past highlights yet.");
      else setHighlightsError(data.detail ?? "Could not analyze past highlights.");
      return;
    }

    const data = await res.json();
    setHighlightsAnalysis({
      pattern: data.pattern ?? "",
      guidance: data.guidance ?? "",
      nextAction: data.nextAction ?? "",
      remaining: data.remaining ?? 0,
    });
  };

  function toggleSpeech(field: SpeechField) {
    if (typeof window === "undefined") return;
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechError("Voice input is not supported in this browser.");
      return;
    }
    setSpeechError(null);

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    const baseText = (payload[field] as string) || "";
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const next = [baseText.trim(), transcript.trim()].filter(Boolean).join(baseText.trim() ? " " : "");
      setPayload((prev) => ({ ...prev, [field]: next }));
    };

    recognition.onerror = (event: any) => {
      setSpeechError(`Voice input error: ${event.error}`);
      setIsListening(false);
      setSpeechTarget(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setSpeechTarget(null);
    };

    try {
      setIsListening(true);
      setSpeechTarget(field);
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechTarget(null);
      setSpeechError("Could not start voice input. Try again.");
    }
  }

  const micLabel = (field: SpeechField) => {
    if (!speechSupported) return "Voice input unavailable";
    if (isListening && speechTarget === field) return "Listening...";
    return "Tap to Speak";
  };

  const selectedCategory = payload.category as CategoryOption | "";
  const categoryValid =
    selectedCategory === "career" ||
    selectedCategory === "relationship" ||
    (selectedCategory === "others" && payload.categoryOther.trim().length > 0);
  const fallbackInsight = payload.reaction ? deriveInsight(payload.reaction, payload.tossResult).insight : "";
  const visibleInsight = payload.insight || fallbackInsight;
  const insightText = visibleInsight || "No insight yet. Click 'Generate insight with AI' to populate this section.";

  const showPhase = (p: Phase) => phase === p;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-between items-center py-6">
        <Link href="/" className="text-xs uppercase tracking-[0.3em] font-medium text-gray-400 hover:text-sumi">
          Kettei <span className="opacity-50">/ 決定</span>
        </Link>
        <Link href="/question" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          ← Sessions
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 min-h-[600px] relative overflow-hidden">
        {/* Phase I: Intention */}
        {showPhase("intention") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col justify-center">
            <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase I: The Crossroad</p>
            <h1 className="text-3xl md:text-4xl font-light leading-tight mb-12">
              Tell me, in this very moment, what decisions weigh on your heart
            </h1>
            <textarea
              value={payload.decision}
              onChange={(e) => setPayload((p) => ({ ...p, decision: e.target.value }))}
              onBlur={() => savePayload({ decision: payload.decision })}
              placeholder="Speak your truth or write it here..."
              className="input-underline w-full py-4 text-xl font-light resize-none h-32 bg-transparent placeholder-gray-300 mb-12"
            />
            <button
              type="button"
              onClick={() => toggleSpeech("decision")}
              disabled={!speechSupported}
              className="mb-8 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={isListening && speechTarget === "decision" ? "text-kintsugi" : ""}>
                {isListening && speechTarget === "decision" ? "●" : "🎤"}
              </span>
              <span>{micLabel("decision")}</span>
            </button>
            <div className="mt-auto flex justify-end">
              <button
                onClick={() => navigate("category")}
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

        {/* Phase II: Category */}
        {showPhase("category") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col justify-center">
            <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase II: Category</p>
            <h2 className="text-2xl md:text-3xl font-light leading-tight mb-8">
              {categorySuggestion
                ? `I sense this question is about ${categorySuggestion}.`
                : "I sense this question is about..."}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {(["career", "relationship", "others"] as CategoryOption[]).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setPayload((p) => ({ ...p, category: cat }))}
                    className={`px-4 py-3 rounded-xl border text-sm uppercase tracking-widest transition-colors ${
                      active
                        ? "border-kintsugi bg-kintsugi text-white"
                        : "border-gray-200 text-gray-500 hover:border-kintsugi hover:text-black"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {selectedCategory === "others" && (
              <div className="mb-4">
                <input
                  type="text"
                  value={payload.categoryOther}
                  onChange={(e) => setPayload((p) => ({ ...p, categoryOther: e.target.value }))}
                  placeholder="Type your category..."
                  className="input-underline w-full py-2 bg-transparent mb-3"
                />
                <button
                  type="button"
                  onClick={() => toggleSpeech("categoryOther")}
                  disabled={!speechSupported}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={isListening && speechTarget === "categoryOther" ? "text-kintsugi" : ""}>
                    {isListening && speechTarget === "categoryOther" ? "●" : "🎤"}
                  </span>
                  <span>{micLabel("categoryOther")}</span>
                </button>
              </div>
            )}

            {categoryLoading && <p className="text-sm text-gray-400 mb-4">Analyzing...</p>}
            {categoryError && <p className="text-sm text-red-500 mb-4">{categoryError}</p>}

            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => navigate("intention")}
                className="text-xs uppercase tracking-widest text-gray-400 hover:text-black"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  await savePayload({
                    category: selectedCategory || "others",
                    categoryOther: selectedCategory === "others" ? payload.categoryOther : "",
                  });
                  navigate("reflection");
                }}
                disabled={!categoryValid}
                className="group flex items-center gap-4 px-8 py-3 rounded-full bg-sumi text-white hover:bg-black transition-all disabled:opacity-50"
              >
                <span className="text-xs uppercase tracking-widest">Continue</span>
              </button>
            </div>
          </section>
        )}

        {/* Phase II: Reflection */}
        {showPhase("reflection") && (
          <section className="absolute inset-0 p-8 md:p-16 flex flex-col overflow-y-auto">
            <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase III: Reflection</p>
            <h2 className="text-2xl font-light mb-10">Examine the shadows of this choice.</h2>
            <div className="space-y-12 mb-16">
              <div>
                <label className="block text-sm font-medium mb-3">
                  What would you do if no one else&apos;s expectations existed?
                </label>
                <input
                  type="text"
                  value={payload["q-regret"]}
                  onChange={(e) => setPayload((p) => ({ ...p, "q-regret": e.target.value }))}
                  onBlur={() => savePayload({ "q-regret": payload["q-regret"] })}
                  className="input-underline w-full py-2 bg-transparent"
                  placeholder="Speak freely..."
                />
                <button
                  type="button"
                  onClick={() => toggleSpeech("q-regret")}
                  disabled={!speechSupported}
                  className="mt-3 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={isListening && speechTarget === "q-regret" ? "text-kintsugi" : ""}>
                    {isListening && speechTarget === "q-regret" ? "●" : "🎤"}
                  </span>
                  <span>{micLabel("q-regret")}</span>
                </button>
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
                <button
                  type="button"
                  onClick={() => toggleSpeech("q-fear")}
                  disabled={!speechSupported}
                  className="mt-3 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={isListening && speechTarget === "q-fear" ? "text-kintsugi" : ""}>
                    {isListening && speechTarget === "q-fear" ? "●" : "🎤"}
                  </span>
                  <span>{micLabel("q-fear")}</span>
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">A year from now, what kind of life are you living?</label>
                <input
                  type="text"
                  value={payload["q-future"]}
                  onChange={(e) => setPayload((p) => ({ ...p, "q-future": e.target.value }))}
                  onBlur={() => savePayload({ "q-future": payload["q-future"] })}
                  className="input-underline w-full py-2 bg-transparent"
                  placeholder="Visualize the outcome..."
                />
                <button
                  type="button"
                  onClick={() => toggleSpeech("q-future")}
                  disabled={!speechSupported}
                  className="mt-3 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={isListening && speechTarget === "q-future" ? "text-kintsugi" : ""}>
                    {isListening && speechTarget === "q-future" ? "●" : "🎤"}
                  </span>
                  <span>{micLabel("q-future")}</span>
                </button>
              </div>
            </div>
            {speechError && <p className="text-sm text-red-500 mb-4">{speechError}</p>}
            <div className="mt-auto flex justify-between items-center pb-8">
              <button
                onClick={() => navigate("category")}
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
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">The Coin Said</p>
            <p className="text-3xl font-light text-kintsugi mb-8">{payload.tossResult}</p>

            <h2 className="text-3xl font-light mb-4">Go with it. Your heart has long known the answer.</h2>
            <p className="text-lg leading-relaxed font-light text-gray-700 whitespace-pre-line mb-8">
              {"Hesitation is only the moment\nwhen you finally acknowledge the truth\nyou were once unwilling to admit-\ndeep down, you already want this outcome."}
            </p>

            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-ajisai mb-3">Prompt 1: Insight</p>
              <button
                onClick={generateInsightWithAI}
                disabled={insightLoading}
                className="px-4 py-1.5 rounded-full border border-kintsugi text-kintsugi hover:bg-kintsugi hover:text-white transition-colors text-[10px] uppercase tracking-widest disabled:opacity-50 mb-3"
              >
                {insightLoading ? "Generating..." : "Testing retry button"}
              </button>
              <textarea
                readOnly
                value={insightLoading ? "Generating insight..." : insightText}
                className="w-full min-h-[120px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-base leading-relaxed text-gray-900 resize-y"
              />
              {insightError && <p className="text-sm text-red-500 mt-2">{insightError}</p>}
            </div>

            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-ajisai mb-3">Prompt 2: Analyze past highlights</p>
              <button
                onClick={analyzePastHighlights}
                disabled={highlightsLoading}
                className="px-5 py-2 rounded-full border border-kintsugi text-kintsugi hover:bg-kintsugi hover:text-white transition-colors text-xs uppercase tracking-widest disabled:opacity-50 mb-3"
              >
                {highlightsLoading ? "Analyzing..." : "Run prompt 2"}
              </button>
              <textarea
                readOnly
                value={
                  highlightsAnalysis
                    ? [
                        `Pattern: ${highlightsAnalysis.pattern || "n/a"}`,
                        `Guidance: ${highlightsAnalysis.guidance || "n/a"}`,
                        `Next action: ${highlightsAnalysis.nextAction || "n/a"}`,
                        `LLM calls remaining: ${highlightsAnalysis.remaining}`,
                      ].join("\n\n")
                    : "No response yet."
                }
                className="w-full min-h-[120px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-base leading-relaxed text-gray-900 resize-y"
              />
              {highlightsError && <p className="text-sm text-red-500 mt-2">{highlightsError}</p>}
            </div>

            <div className="mb-8">
              <p className="text-xs uppercase tracking-widest text-ajisai mb-3">Prompt 3: Reflection question</p>
              <button
                onClick={reflectWithAI}
                disabled={llmLoading}
                className="px-6 py-3 rounded-full border border-kintsugi text-kintsugi hover:bg-kintsugi hover:text-white transition-colors text-sm uppercase tracking-widest disabled:opacity-50 mb-3"
              >
                {llmLoading ? "Thinking..." : "Run prompt 3"}
              </button>
              <textarea
                readOnly
                value={
                  llm && llm.questions.length > 0
                    ? llm.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")
                    : "No response yet."
                }
                className="w-full min-h-[120px] rounded-xl border border-gray-300 bg-white px-4 py-3 text-base leading-relaxed text-gray-900 resize-y"
              />
              {llmError && <p className="text-sm text-red-500 mt-2">{llmError}</p>}
              {llm && <p className="text-xs text-gray-400 mt-2">LLM calls remaining: {llm.remaining}</p>}
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-light mb-3">A small step forward</h3>
              <p className="text-base leading-relaxed text-gray-700 mb-2">
                To move toward this wish, what is one tiny action you can take right now?
              </p>
              <p className="text-sm text-gray-500">
                Example: write it down, make a simple plan, call someone.
              </p>
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

            <div className="mt-auto flex items-center justify-center gap-8">
              <Link
                href="/question"
                className="text-xs uppercase tracking-widest border-b border-gray-300 hover:border-black pb-1 transition-all"
              >
                Back to Sessions
              </Link>
              <Link
                href="/sessions"
                className="text-xs uppercase tracking-widest border-b border-gray-300 hover:border-black pb-1 transition-all"
              >
                History
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
