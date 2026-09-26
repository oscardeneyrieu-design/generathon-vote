"use client";

import { useLayoutEffect, useRef } from "react";

import { formatShare } from "./Bits";
import type { Standing } from "@/lib/types";

type Props = {
  standings: Standing[];
  /** Nombre de parieurs de la track — sert à distinguer « 0 % » de « pas encore de pari ». */
  voters: number;
  /** Tronque la liste. `/board` n'en montre que quelques-uns, lisibles à trois mètres. */
  limit?: number;
  scale?: "compact" | "board";
};

export function Leaderboard({ standings, voters, limit, scale = "compact" }: Props) {
  const rows = limit ? standings.slice(0, limit) : standings;
  const listRef = useFlip(rows.map((row) => row.projectId));
  const isBoard = scale === "board";

  return (
    <ol
      ref={listRef}
      className="m-0 list-none p-0"
      style={{ borderTop: "3px solid var(--color-ink)" }}
    >
      {rows.map((row) => {
        const classes = ["rank-row"];
        if (row.isMine) classes.push("rank-row-mine");
        if (row.isWinner) classes.push("rank-row-correct");

        return (
          <li
            key={row.projectId}
            data-flip-id={row.projectId}
            className={classes.join(" ")}
            style={
              isBoard
                ? { gridTemplateColumns: "2.5rem 1fr auto", padding: "0.7rem 0.75rem" }
                : undefined
            }
          >
            <span
              className="rank-bar"
              style={{
                // Zéro parieur : barre à zéro plutôt qu'à pleine largeur, pour
                // qu'une liste vierge ne ressemble pas à une égalité parfaite.
                transform: `scaleX(${voters === 0 ? 0 : row.bets / voters})`,
              }}
            />

            <span className="rank-num" style={isBoard ? { fontSize: "1rem" } : undefined}>
              {String(row.rank).padStart(2, "0")}
            </span>

            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  className="truncate font-bold"
                  style={{
                    fontSize: isBoard ? "1.25rem" : "1rem",
                    fontStretch: "92%",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {row.name}
                </span>
                {row.isWinner && <span className="t-label shrink-0">Winner</span>}
                {row.isMine && !row.isWinner && <span className="t-label shrink-0">Your bet</span>}
              </span>
              {(row.team || row.brand) && (
                <span className="t-meta truncate" style={{ fontSize: isBoard ? "0.8125rem" : "0.75rem" }}>
                  {[row.team, row.brand].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>

            <span className="flex items-baseline gap-3 justify-self-end">
              <span className="t-meta" style={isBoard ? { fontSize: "0.875rem" } : undefined}>
                {row.bets}
              </span>
              <span
                className="rank-share"
                style={{
                  fontSize: isBoard ? "1.75rem" : undefined,
                  minWidth: "4.5ch",
                  textAlign: "right",
                }}
              >
                {formatShare(row.share)}
                <span style={{ fontSize: "0.5em", marginLeft: "0.15em" }}>%</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * FLIP sur le réordonnancement. C'est le seul moment chorégraphié du produit
 * et il porte une information réelle : un projet vient d'en doubler un autre.
 * Mesure via offsetTop, pas getBoundingClientRect — sinon un scroll entre
 * deux rendus se traduirait par un faux déplacement.
 */
function useFlip(ids: string[]) {
  const listRef = useRef<HTMLOListElement>(null);
  const previous = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = Array.from(list.querySelectorAll<HTMLLIElement>("[data-flip-id]"));
    const next = new Map<string, number>();
    const moved: Array<{ el: HTMLLIElement; delta: number }> = [];

    for (const el of items) {
      const id = el.dataset.flipId;
      if (!id) continue;

      const top = el.offsetTop;
      next.set(id, top);

      const before = previous.current.get(id);
      if (!reduce && before !== undefined && before !== top) {
        moved.push({ el, delta: before - top });
      }
    }

    previous.current = next;
    if (moved.length === 0) return;

    for (const { el, delta } of moved) {
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
    }

    const frame = requestAnimationFrame(() => {
      moved.forEach(({ el }, index) => {
        el.style.transition = `transform var(--dur-flip) var(--ease-out-expo) ${index * 18}ms`;
        el.style.transform = "";
      });
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);

  return listRef;
}
