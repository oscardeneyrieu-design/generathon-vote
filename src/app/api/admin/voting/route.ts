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

/** Ouvre ou ferme le vote pour tout le monde, d'un seul interrupteur. */
export async function PATCH(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const open = payload?.open;

  if (typeof open !== "boolean") {
    return NextResponse.json({ error: "Expected { open: boolean }." }, { status: 400 });
  }

  try {
    await (await getStore()).setVotingOpen(open);
    return NextResponse.json({ ok: true, votingOpen: open });
  } catch {
    return NextResponse.json({ error: "Could not change voting state." }, { status: 503 });
  }
}

/** Efface tous les paris. Les projets et les tracks restent en place. */
export async function DELETE() {
  const denied = await guard();
  if (denied) return denied;

  try {
    await (await getStore()).clearBets();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not clear bets." }, { status: 503 });
  }
}
