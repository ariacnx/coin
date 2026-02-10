"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function QuestionPage() {
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const questionDraftKey = "kettei:guest:question-draft";

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
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(questionDraftKey);
      if (saved) setDecision(saved);
    } catch {
      // Ignore malformed draft
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (decision.trim()) window.localStorage.setItem(questionDraftKey, decision);
      else window.localStorage.removeItem(questionDraftKey);
    } catch {
      // Ignore storage write failures
    }
  }, [decision]);

  function toggleSpeech() {
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

    const baseText = decision.trim();
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const next = [baseText, transcript.trim()].filter(Boolean).join(baseText ? " " : "");
      setDecision(next);
    };

    recognition.onerror = (event: any) => {
      setSpeechError(`Voice input error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechError("Could not start voice input. Try again.");
    }
  }

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
        try {
          window.localStorage.removeItem(questionDraftKey);
        } catch {
          // Ignore storage cleanup failures
        }
        window.location.href = `/session/${id}`;
      } else {
        setError("Could not start. Try again. (no session id)");
      }
    } catch {
      setError("Could not start. Try again. (network error)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8">
      <nav className="flex justify-between py-6">
        <Link href="/sessions" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          History
        </Link>
        <Link href="/login" className="text-xs uppercase tracking-widest text-gray-400 hover:text-sumi">
          Sign in
        </Link>
      </nav>

      <main className="glass-panel rounded-[2rem] md:rounded-[3rem] flex-1 p-8 md:p-16 flex flex-col justify-center">
        <p className="text-xs text-ajisai uppercase tracking-widest mb-4">Phase I: The Crossroad</p>
        <h1 className="text-3xl md:text-4xl font-light leading-tight mb-12">
          Tell me, in this very moment, what decisions weigh on your heart
        </h1>

        <form onSubmit={handleBeginRitual}>
          <textarea
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="Speak your truth or write it here..."
            required
            className="input-underline w-full py-4 text-xl font-light resize-none h-32 bg-transparent placeholder-gray-300 mb-4"
          />
          <button
            type="button"
            onClick={toggleSpeech}
            disabled={!speechSupported}
            className="mb-4 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={isListening ? "text-kintsugi" : ""}>{isListening ? "●" : "🎤"}</span>
            <span>
              {isListening ? "Listening..." : speechSupported ? "Tap to Speak" : "Voice input unavailable"}
            </span>
          </button>
          {speechError && <p className="text-sm text-red-500 mb-4">{speechError}</p>}
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
