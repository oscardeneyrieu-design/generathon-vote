"use client";

import { resolveBackend } from "@/lib/backend";
import { createSqliteSource } from "./sqlite-source";
import { createSupabaseSource } from "./supabase-source";
import type { LiveSource } from "./types";

let cached: LiveSource | null = null;

export function getLiveSource(): LiveSource {
  if (!cached) {
    cached = resolveBackend() === "sqlite" ? createSqliteSource() : createSupabaseSource();
  }
  return cached;
}

export type { LiveSource, Snapshot, TransportStatus } from "./types";
