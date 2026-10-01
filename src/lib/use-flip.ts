"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Fait glisser les éléments d'une liste vers leur nouvelle place quand
 * l'ordre change (technique FLIP : on mesure, on replace l'élément là où il
 * était, puis on le laisse revenir). Les éléments à suivre portent
 * `data-flip="<id stable>"`.
 *
 * Sur le grand écran, un projet qui double un autre se voit monter, au lieu
 * d'apparaître d'un coup ailleurs. Sous prefers-reduced-motion, rien ne bouge :
 * l'ordre affiché suffit à dire qui est devant.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const positions = useRef(new Map<string, number>());

  // Sans tableau de dépendances : on mesure après chaque rendu, c'est
  // quelques lectures de offsetTop sur une dizaine de lignes.
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();

    for (const element of root.querySelectorAll<HTMLElement>("[data-flip]")) {
      const id = element.dataset.flip!;
      const top = element.offsetTop;
      const previous = positions.current.get(id);
      next.set(id, top);

      if (reduce || previous === undefined || previous === top) continue;

      element.style.transition = "none";
      element.style.transform = `translateY(${previous - top}px)`;
      // Le navigateur doit peindre la position de départ avant de repartir.
      requestAnimationFrame(() => {
        element.style.transition = "transform 480ms cubic-bezier(0.16, 1, 0.3, 1)";
        element.style.transform = "";
      });
    }

    positions.current = next;
  });
}
