/**
 * Les trois tracks du Generathon #2, telles qu'annoncées aux participants.
 * Elles sont créées au premier démarrage puis modifiables depuis l'admin ;
 * la clé, elle, ne bouge pas — c'est ce qui apparaît dans les URL.
 */
export const SEED_TRACKS = [
  {
    key: "short-film",
    name: "Three Minutes to Move",
    subtitle: "Short film — Limbic narration, not just a voice-over.",
    position: 1,
  },
  {
    key: "animation",
    name: "Animate the Shift",
    subtitle: "Animation video — The future of the 2D animated sitcom.",
    position: 2,
  },
  {
    key: "ad",
    name: "Sell the Feeling",
    subtitle: "Ad — The best emotional ad for one of the six brands.",
    position: 3,
  },
] as const;

/** Seule la track Ad expose un champ marque. */
export const BRAND_TRACK_KEY = "ad";
