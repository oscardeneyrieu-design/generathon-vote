import { NextResponse } from "next/server";

import { adminGuard } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nombre de personnes maximum par projet. */
const MAX_PER_PROJECT = 12;

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

/** Seules les photos envoyées ici sont acceptées, pas d'URL externe arbitraire. */
function cleanPhoto(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && /^\/api\/photo\/[\w-]{8,64}$/.test(value) ? value : undefined;
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const projectId = payload?.projectId;
  const name = cleanName(payload?.name);
  const photoUrl = cleanPhoto(payload?.photoUrl);

  if (typeof projectId !== "string" || name.length === 0 || photoUrl === undefined) {
    return NextResponse.json({ error: "Le nom de la personne est obligatoire." }, { status: 400 });
  }

  try {
    const store = await getStore();
    const snapshot = await store.snapshot();
    if (!snapshot.projects.some((project) => project.id === projectId)) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }
    if (snapshot.members.filter((member) => member.project_id === projectId).length >= MAX_PER_PROJECT) {
      return NextResponse.json({ error: `${MAX_PER_PROJECT} personnes maximum par projet.` }, { status: 400 });
    }
    await store.addMember(projectId, name, photoUrl);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible d'ajouter la personne." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const name = cleanName(payload?.name);
  const photoUrl = cleanPhoto(payload?.photoUrl);

  if (typeof id !== "string" || name.length === 0 || photoUrl === undefined) {
    return NextResponse.json({ error: "Modification invalide." }, { status: 400 });
  }

  try {
    await (await getStore()).updateMember(id, name, photoUrl);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de modifier la personne." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Identifiant manquant." }, { status: 400 });

  try {
    await (await getStore()).deleteMember(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de retirer la personne." }, { status: 503 });
  }
}
