import { placeLabel, plural } from "./Bits";
import type { Standing } from "@/lib/types";

/**
 * Le podium annoncé d'une track. Il suit l'ordre officiel, pas l'ordre des
 * paris : un outsider peut gagner, et c'est précisément ce qu'on veut montrer.
 */
export function Podium({ podium, large = false }: { podium: Standing[]; large?: boolean }) {
  if (podium.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {podium.map((entry) => {
        const first = entry.place === 1;
        return (
          <li
            key={entry.projectId}
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 ${
              first ? "border-gold bg-gold text-black" : "border-gold/40 bg-gold/10"
            }`}
          >
            <span className="font-semibold">🏆 {placeLabel(entry.place!)}</span>
            <span className={`font-bold tracking-tight ${large && first ? "text-xl" : ""}`}>
              {entry.name}
            </span>
            {entry.isMine && <span className="pill pill-mine">✓ Ton pari</span>}
            <span className={`ml-auto text-xs ${first ? "text-black/70" : "faint"}`}>
              {plural(entry.bets, "pari")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
