import { NextResponse } from "next/server";

import { adminGuard } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : null;
}

/** Renomme une track ou change sa ligne de contexte. */
export async function PATCH(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const name = clean(payload?.name, 80);
  const subtitle = clean(payload?.subtitle ?? "", 160);

  if (typeof id !== "string" || !name || name.length === 0 || subtitle === null) {
    return NextResponse.json({ error: "Modification de track invalide." }, { status: 400 });
  }

  try {
    await (await getStore()).updateTrack(id, name, subtitle);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de modifier la track." }, { status: 503 });
  }
}

function slot(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
}

/**
 * Annonce le podium d'une track : 1er, 2e, 3e. Chaque place accepte `null`,
 * ce qui permet d'en annoncer une à la fois — et de corriger une place
 * donnée trop vite devant la salle.
 */
export async function PUT(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const first = slot(payload?.first);
  const second = slot(payload?.second);
  const third = slot(payload?.third);

  if (
    typeof id !== "string" ||
    first === undefined ||
    second === undefined ||
    third === undefined
  ) {
    return NextResponse.json({ error: "Podium invalide." }, { status: 400 });
  }

  const filled = [first, second, third].filter((value): value is string => value !== null);
  if (new Set(filled).size !== filled.length) {
    return NextResponse.json(
      { error: "Un projet ne peut pas occuper deux places du podium." },
      { status: 409 }
    );
  }

  try {
    const store = await getStore();

    for (const projectId of filled) {
      if (!(await store.projectBelongsToTrack(projectId, id))) {
        return NextResponse.json(
          { error: "Ce projet n'est pas dans cette track." },
          { status: 409 }
        );
      }
    }

    await store.setPodium(id, { first, second, third });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible d'enregistrer le podium." }, { status: 503 });
  }
}
