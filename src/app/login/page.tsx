"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (res.ok) {
      window.location.href = "/question";
      return;
    }

    const data = await res.json().catch(() => ({}));
    setStatus("error");
    setError(data.error === "invalid_credentials" ? "Invalid email or password." : "Something went wrong.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <div className="glass-panel rounded-[2rem] md:rounded-[3rem] p-8 md:p-16 max-w-md w-full">
        <h1 className="text-2xl font-light text-sumi mb-2">Kettei</h1>
        <p className="text-xs text-ajisai uppercase tracking-widest mb-8">
          Sign in with email and password
        </p>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="input-underline w-full py-3 bg-transparent mb-4"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="input-underline w-full py-3 bg-transparent mb-6"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full py-3 rounded-full bg-sumi text-white hover:bg-black transition-colors text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {status === "loading" ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-6">
          New here? Use the app first—after your first ritual, you&apos;ll be prompted to create an account.
        </p>

        <Link href="/" className="block mt-6 text-xs text-gray-400 hover:text-sumi">
          ← Back
        </Link>
      </div>
    </div>
  );
}
