import { NextResponse } from "next/server";

import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anti-martèlement par appareil. La contrainte d'unicité en base empêche
 * déjà les doublons ; ceci évite juste qu'un doigt nerveux génère cinquante
 * écritures. En serverless la mémoire est par instance, donc c'est un
 * amortisseur, pas une barrière de sécurité.
 */
const lastBetAt = new Map<string, number>();
const MIN_INTERVAL_MS = 250;

function throttled(voterId: string): boolean {
  const now = Date.now();
  const previous = lastBetAt.get(voterId);

  if (lastBetAt.size > 20_000) lastBetAt.clear();
  if (previous !== undefined && now - previous < MIN_INTERVAL_MS) return true;

  lastBetAt.set(voterId, now);
  return false;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { trackId, projectId, voterId } = (payload ?? {}) as Record<string, unknown>;

  if (
    typeof trackId !== "string" ||
    typeof projectId !== "string" ||
    typeof voterId !== "string" ||
    voterId.length < 8 ||
    voterId.length > 64
  ) {
    return NextResponse.json({ error: "Invalid bet." }, { status: 400 });
  }

  if (throttled(voterId)) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  try {
    const store = await getStore();

    if (!(await store.isVotingOpen())) {
      return NextResponse.json({ error: "Betting is closed." }, { status: 409 });
    }

    // Le client envoie la track ET le projet : on vérifie que les deux
    // concordent, sinon un appel forgé pourrait fausser la répartition par
    // track tout en pointant un projet valide.
    if (!(await store.projectBelongsToTrack(projectId, trackId))) {
      return NextResponse.json(
        { error: "This project is not in that track." },
        { status: 409 }
      );
    }

    await store.placeBet(voterId, trackId, projectId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bet not saved." }, { status: 503 });
  }
}
