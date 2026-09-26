import "server-only";

import { resolveBackend } from "@/lib/backend";
import type { Store } from "./types";

let cached: Store | null = null;

/**
 * Charge l'implémentation choisie, et elle seule : l'import dynamique évite
 * de tirer `node:sqlite` dans un déploiement Vercel, ou le SDK Supabase dans
 * une soirée hors ligne.
 */
export async function getStore(): Promise<Store> {
  if (cached) return cached;

  if (resolveBackend() === "sqlite") {
    const { createSqliteStore } = await import("./sqlite-store");
    cached = createSqliteStore();
  } else {
    const { createSupabaseStore } = await import("./supabase-store");
    cached = createSupabaseStore();
  }

  return cached;
}

export type { Snapshot, Store } from "./types";
