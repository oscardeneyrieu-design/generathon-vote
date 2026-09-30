"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Notice } from "@/components/Bits";

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
        throw new Error(body?.error ?? "Code incorrect.");
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Code incorrect.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12">
      <form
        onSubmit={submit}
        className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-3xl border border-black/10 bg-black/[.02] p-6 sm:p-8 dark:border-white/15 dark:bg-white/[.03]"
      >
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Espace organisateur</h1>
          <p className="muted text-sm">
            Ouvrir et fermer les paris, saisir les projets, annoncer les gagnants.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="label" htmlFor="admin-code">
            Code d&apos;accès
          </label>
          <input
            id="admin-code"
            className="field"
            type="password"
            value={code}
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>

        {error && <Notice>{error}</Notice>}

        <button
          type="submit"
          className="btn btn-gold rounded-xl py-3 text-base font-bold"
          disabled={busy || code.length === 0}
        >
          {busy ? "Vérification…" : "Entrer"}
        </button>
      </form>
    </main>
  );
}
