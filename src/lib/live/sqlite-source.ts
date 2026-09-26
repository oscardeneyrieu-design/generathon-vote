"use client";

import type { LiveSource, Snapshot } from "./types";

/**
 * Tout passe par le serveur local : lecture en HTTP, notifications en SSE.
 * Aucune requête ne quitte le réseau de la salle, et un téléphone sans data
 * fonctionne tant qu'il voit le PC.
 */
export function createSqliteSource(): LiveSource {
  return {
    async fetchSnapshot(): Promise<Snapshot> {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "État indisponible.");
      }
      return (await response.json()) as Snapshot;
    },

    subscribe({ onChange, onStatus }) {
      let source: EventSource | null = null;
      let retry: ReturnType<typeof setTimeout> | null = null;
      let closed = false;

      const connect = () => {
        if (closed) return;

        source = new EventSource("/api/stream");

        source.onopen = () => {
          onStatus("live");
          onChange();
        };

        source.onmessage = (event) => {
          // `ping` garde la connexion ouverte à travers les proxys ; seul
          // `change` mérite une relecture.
          if (event.data === "change") onChange();
        };

        source.onerror = () => {
          onStatus("reconnecting");
          source?.close();
          source = null;
          // EventSource se reconnecte seul, mais pas après un close() ; on
          // reprend la main pour contrôler le rythme.
          if (!closed && !retry) {
            retry = setTimeout(() => {
              retry = null;
              connect();
            }, 2000);
          }
        };
      };

      connect();

      return () => {
        closed = true;
        if (retry) clearTimeout(retry);
        source?.close();
      };
    },
  };
}
