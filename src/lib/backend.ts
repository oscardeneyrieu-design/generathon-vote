export type Backend = "supabase" | "sqlite";

/**
 * Une seule variable pilote les deux côtés. Les accès à process.env sont
 * écrits en toutes lettres : Next ne remplace `NEXT_PUBLIC_*` dans le bundle
 * navigateur que pour les accès statiques, pas pour un accès calculé.
 */
export function resolveBackend(): Backend {
  const explicit = process.env.NEXT_PUBLIC_DATA_BACKEND;
  if (explicit === "sqlite" || explicit === "supabase") return explicit;

  // Sans consigne, on déduit : des clés Supabase présentes veulent dire cloud,
  // leur absence veut dire soirée en local.
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "sqlite";
}
