import { NextResponse } from "next/server";

import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * État complet, backend-agnostique. C'est le chemin de lecture du mode
 * SQLite ; en mode Supabase les navigateurs lisent Postgres en direct, et
 * cette route ne sert plus qu'au diagnostic.
 */
export async function GET() {
  try {
    const store = await getStore();
    const snapshot = await store.snapshot();

    return NextResponse.json(snapshot, {
      headers: { "cache-control": "no-store" },
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Base injoignable." },
      { status: 503 }
    );
  }
}
