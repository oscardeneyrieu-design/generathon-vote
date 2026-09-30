import type { ReactNode } from "react";

import type { ConnectionStatus } from "@/lib/use-live";
import type { Place } from "@/lib/types";

/** `1er`, `2e`, `3e` — la place sur le podium de la track. */
export function placeLabel(place: Place): string {
  return place === 1 ? "1er" : `${place}e`;
}

/** « 1 parieur », « 3 parieurs ». */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** Titre de page, comme « Projets » sur generathon.tech. */
export function PageHeader({
  title,
  intro,
  aside,
}: {
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro && <p className="muted max-w-[62ch]">{intro}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Un chiffre et son libellé. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="text-right">
      <div className="text-3xl font-extrabold leading-none tracking-tight">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

/** Indicateur de connexion en direct. */
export function LiveBadge({ status }: { status: ConnectionStatus }) {
  const live = status === "live";
  const copy = live ? "En direct" : status === "loading" ? "Connexion…" : "Reconnexion…";

  return (
    <span className={`pill self-start ${live ? "pill-gold" : "pill-muted"}`}>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-gold" : "bg-current"}`}
      />
      {copy}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-black/15 px-6 py-10 text-center dark:border-white/20">
      <p className="font-semibold">{title}</p>
      <p className="muted max-w-[52ch] text-sm">{body}</p>
    </div>
  );
}

export function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium"
    >
      <span>{children}</span>
      {onDismiss && (
        <button type="button" className="text-sm underline underline-offset-2" onClick={onDismiss}>
          Fermer
        </button>
      )}
    </div>
  );
}
