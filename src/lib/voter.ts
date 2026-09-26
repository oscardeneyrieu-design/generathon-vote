"use client";

const KEY = "publicvote.voter";

/**
 * Identifiant anonyme et local. Pas de compte, pas de pseudo : l'appareil
 * est l'identité. Un même téléphone ne peut donc voter qu'une fois par
 * manche, et vider son stockage local revient à devenir un nouveau votant —
 * limite assumée pour un jeu de salle.
 */
export function getVoterId(): string {
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 8) return existing;

  const fresh =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

  window.localStorage.setItem(KEY, fresh);
  return fresh;
}
