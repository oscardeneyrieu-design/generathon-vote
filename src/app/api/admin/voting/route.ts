import { NextResponse } from "next/server";

import { adminGuard } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { isBettingOpen } from "@/lib/voting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ouvre ou ferme les paris pour tout le monde.
 *
 * `{ open: true, closesAt: "<ISO>" }` lance le compte à rebours : les paris
 * restent ouverts jusqu'à cette heure puis se ferment seuls (le serveur
 * refuse tout pari après, les écrans basculent d'eux-mêmes).
 * `{ open: true }` ouvre sans limite, `{ open: false }` ferme tout de suite.
 *
 * L'heure d'ouverture marque le début de la période sur laquelle le bonus de
 * rapidité baisse. Elle est notée à l'ouverture des paris, et gardée quand
 * on déplace seulement l'heure de fin ou qu'on rouvre après une pause.
 *
 * `closesAt` (avec `{ open: false }`) et `opensAt` peuvent aussi être imposés :
 * c'est ce qui permet au script de smoke de remettre l'état exact d'avant.
 */
export async function PATCH(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const open = payload?.open;
  const rawClosesAt = payload?.closesAt ?? null;
  const rawOpensAt = payload?.opensAt ?? null;

  if (
    typeof open !== "boolean" ||
    (rawClosesAt !== null && typeof rawClosesAt !== "string") ||
    (rawOpensAt !== null && (typeof rawOpensAt !== "string" || Number.isNaN(Date.parse(rawOpensAt))))
  ) {
    return NextResponse.json({ error: "Format attendu : { open, closesAt?, opensAt? }." }, { status: 400 });
  }

  let closesAt: string | null = null;
  if (open && rawClosesAt) {
    const deadline = Date.parse(rawClosesAt);
    if (Number.isNaN(deadline)) {
      return NextResponse.json({ error: "Heure de clôture illisible." }, { status: 400 });
    }
    if (deadline <= Date.now()) {
      return NextResponse.json({ error: "L'heure de clôture est déjà passée." }, { status: 400 });
    }
    closesAt = new Date(deadline).toISOString();
  }

  try {
    const store = await getStore();
    const current = await store.getVoting();
    const now = Date.now();

    // La période en cours continue si les paris sont ouverts, ou seulement
    // suspendus avant l'heure de fin annoncée. Sinon, une nouvelle commence.
    const running =
      isBettingOpen(current.open, current.closesAt, now) ||
      (current.closesAt !== null && Date.parse(current.closesAt) > now);
    let opensAt = current.opensAt;
    if (open && (!opensAt || !running)) opensAt = new Date(now).toISOString();
    if (payload && "opensAt" in payload) {
      opensAt = rawOpensAt === null ? null : new Date(Date.parse(rawOpensAt as string)).toISOString();
    }

    // Fermer à la main garde l'heure de fin annoncée : rouvrir avant cette
    // heure reprend la même période, et donc le même bonus de rapidité.
    let nextClosesAt = open ? closesAt : current.closesAt;
    if (!open && payload && "closesAt" in payload) {
      const imposed = rawClosesAt === null ? NaN : Date.parse(rawClosesAt as string);
      nextClosesAt = Number.isNaN(imposed) ? null : new Date(imposed).toISOString();
    }

    await store.setVoting({ open, closesAt: nextClosesAt, opensAt });
    return NextResponse.json({ ok: true, votingOpen: open, closesAt: nextClosesAt, opensAt });
  } catch (cause) {
    // Route admin : on montre la cause, c'est souvent une base pas à jour
    // (schema.sql à rejouer) et l'organisateur doit pouvoir le voir.
    const detail = cause instanceof Error ? ` (${cause.message})` : "";
    return NextResponse.json({ error: `Impossible de changer l'état des paris${detail}.` }, { status: 503 });
  }
}

/** Efface tous les paris. Les projets et les tracks restent en place. */
export async function DELETE() {
  const denied = await adminGuard();
  if (denied) return denied;

  try {
    await (await getStore()).clearBets();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible d'effacer les paris." }, { status: 503 });
  }
}
