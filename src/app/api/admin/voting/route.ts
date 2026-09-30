import { NextResponse } from "next/server";

import { adminGuard } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ouvre ou ferme les paris pour tout le monde.
 *
 * `{ open: true, closesAt: "<ISO>" }` lance le compte à rebours : les paris
 * restent ouverts jusqu'à cette heure puis se ferment seuls (le serveur
 * refuse tout pari après, les écrans basculent d'eux-mêmes).
 * `{ open: true }` ouvre sans limite, `{ open: false }` ferme tout de suite.
 */
export async function PATCH(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const open = payload?.open;
  const rawClosesAt = payload?.closesAt ?? null;

  if (typeof open !== "boolean" || (rawClosesAt !== null && typeof rawClosesAt !== "string")) {
    return NextResponse.json({ error: "Format attendu : { open, closesAt? }." }, { status: 400 });
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
    await (await getStore()).setVoting({ open, closesAt });
    return NextResponse.json({ ok: true, votingOpen: open, closesAt });
  } catch {
    return NextResponse.json({ error: "Impossible de changer l'état des paris." }, { status: 503 });
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
