import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard() {
  return (await isAdmin())
    ? null
    : NextResponse.json({ error: "Admin session required." }, { status: 401 });
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : null;
}

/** Renomme une track ou change sa ligne de contexte. */
export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const name = clean(payload?.name, 80);
  const subtitle = clean(payload?.subtitle ?? "", 160);

  if (typeof id !== "string" || !name || name.length === 0 || subtitle === null) {
    return NextResponse.json({ error: "Invalid track update." }, { status: 400 });
  }

  try {
    await (await getStore()).updateTrack(id, name, subtitle);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update track." }, { status: 503 });
  }
}

/**
 * Désigne le gagnant d'une track. `null` efface la désignation — c'est le
 * moyen de corriger une annonce faite trop vite devant la salle.
 */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const winnerProjectId = payload?.winnerProjectId ?? null;

  if (typeof id !== "string" || (winnerProjectId !== null && typeof winnerProjectId !== "string")) {
    return NextResponse.json({ error: "Invalid winner." }, { status: 400 });
  }

  try {
    const store = await getStore();

    if (winnerProjectId && !(await store.projectBelongsToTrack(winnerProjectId, id))) {
      return NextResponse.json(
        { error: "That project is not in this track." },
        { status: 409 }
      );
    }

    await store.setWinner(id, winnerProjectId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not set winner." }, { status: 503 });
  }
}
