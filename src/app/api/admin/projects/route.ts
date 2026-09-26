import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import type { ProjectInput } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_TRACK = 40;

async function guard() {
  return (await isAdmin())
    ? null
    : NextResponse.json({ error: "Admin session required." }, { status: 401 });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function toInput(source: Record<string, unknown>): ProjectInput | null {
  const name = text(source.name, 80);
  if (name.length === 0) return null;

  const brand = text(source.brand, 40);
  return { name, team: text(source.team, 80), brand: brand.length > 0 ? brand : null };
}

function failed(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const trackId = payload?.trackId;
  const input = payload ? toInput(payload) : null;

  if (typeof trackId !== "string" || !input) {
    return NextResponse.json({ error: "A project name is required." }, { status: 400 });
  }

  try {
    const store = await getStore();
    const count = await store.countProjects(trackId);

    if (count >= MAX_PER_TRACK) {
      return NextResponse.json(
        { error: `${MAX_PER_TRACK} projects max per track.` },
        { status: 400 }
      );
    }

    await store.addProject(trackId, input, count + 1);
    return NextResponse.json({ ok: true });
  } catch {
    return failed("Could not add the project.");
  }
}

export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = payload?.id;
  const input = payload ? toInput(payload) : null;

  if (typeof id !== "string" || !input) {
    return NextResponse.json({ error: "Invalid project update." }, { status: 400 });
  }

  try {
    await (await getStore()).updateProject(id, input);
    return NextResponse.json({ ok: true });
  } catch {
    return failed("Could not update the project.");
  }
}

export async function DELETE(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  try {
    await (await getStore()).deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch {
    return failed("Could not delete the project.");
  }
}

/**
 * Remplace d'un coup tous les projets d'une track. C'est le chemin prévu
 * pour saisir les soumissions : on colle la liste, une ligne par projet.
 */
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const trackId = payload?.trackId;
  const rows = payload?.rows;

  if (typeof trackId !== "string" || !Array.isArray(rows)) {
    return NextResponse.json({ error: "Expected { trackId, rows }." }, { status: 400 });
  }

  const inputs: ProjectInput[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const input = toInput(row as Record<string, unknown>);
    if (!input) continue;

    // Deux projets homonymes seraient indistinguables dans la grille de vote.
    const fingerprint = `${input.name.toLowerCase()}|${input.team.toLowerCase()}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    inputs.push(input);
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: "No usable project name." }, { status: 400 });
  }
  if (inputs.length > MAX_PER_TRACK) {
    return NextResponse.json(
      { error: `${MAX_PER_TRACK} projects max per track.` },
      { status: 400 }
    );
  }

  try {
    // Destructif : supprime les projets existants de la track, donc les paris
    // qui les désignaient (suppression en cascade). L'interface le dit avant.
    await (await getStore()).replaceProjects(trackId, inputs);
    return NextResponse.json({ ok: true, count: inputs.length });
  } catch {
    return failed("Could not replace the projects.");
  }
}
