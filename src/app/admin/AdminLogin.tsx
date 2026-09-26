"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Rule } from "@/components/Bits";

export function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Wrong code.");
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wrong code.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[26rem] px-4 pt-6">
      <span className="t-label">Public vote — Admin</span>
      <Rule thick />

      <h1 className="t-display pt-6">Access code</h1>
      <p className="t-meta mt-2">
        It guards opening and closing the vote. Set by the <code>ADMIN_CODE</code> environment
        variable.
      </p>

      <form onSubmit={submit} className="mt-6">
        <label className="t-label block" htmlFor="admin-code">
          Code
        </label>
        <input
          id="admin-code"
          className="field mt-2"
          type="password"
          value={code}
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setCode(event.target.value)}
          aria-describedby={error ? "admin-code-error" : undefined}
          aria-invalid={error ? true : undefined}
        />

        {error && (
          <p
            id="admin-code-error"
            role="alert"
            className="mt-3 border-2 border-[color:var(--color-ink)] px-3 py-2 text-sm font-semibold"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-solid mt-4 w-full"
          disabled={busy || code.length === 0}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
