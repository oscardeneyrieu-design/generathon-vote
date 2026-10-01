"use client";

import { useId } from "react";

import { plural } from "./Bits";
import type { ProjectSeries } from "@/lib/types";

type Props = {
  series: ProjectSeries[];
  /** Nombre de courbes tracées. Au-delà, c'est illisible. */
  limit?: number;
  /**
   * Dimensions du dessin. Le graphique prend toute la largeur disponible et
   * garde ces proportions : deux graphiques de même taille dans des colonnes
   * de même largeur ont exactement la même hauteur, courbes ou pas.
   */
  width?: number;
  height?: number;
  /**
   * Heure de clôture programmée (ISO). Les courbes se prolongent jusqu'à
   * maintenant, mais pas au-delà de la clôture.
   */
  closesAt?: string | null;
};

const LABEL_WIDTH = 150;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const PAD_LEFT = 38;

/**
 * Évolution du nombre de paris, une courbe par projet.
 *
 * - Axe vertical linéaire, de zéro au projet le plus soutenu : « monter »
 *   veut dire « plus de monde y croit ».
 * - Axe horizontal en temps, du premier pari à maintenant. La courbe est en
 *   escalier : un compte ne change qu'au moment d'un pari, et reste stable
 *   entre deux.
 * - Étiquettes en bout de courbe plutôt qu'une légende.
 */
export function BetsChart({ series, limit = 5, width: WIDTH = 640, height = 200, closesAt }: Props) {
  const clipId = useId();
  const drawn = series.slice(0, limit).filter((entry) => entry.points.length > 0);
  const frame = { aspectRatio: `${WIDTH} / ${height}` };

  if (drawn.length === 0) {
    return (
      <div style={frame} className="grid place-items-center rounded-lg bg-black/[.03] dark:bg-white/[.04]">
        <p className="muted px-4 text-center text-sm">Pas encore de pari : la courbe démarre au premier.</p>
      </div>
    );
  }

  const plotRight = WIDTH - LABEL_WIDTH;
  const plotWidth = plotRight - PAD_LEFT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;

  const start = Math.min(...drawn.map((entry) => entry.points[0].time));
  const lastEvent = Math.max(...drawn.map((entry) => entry.points[entry.points.length - 1].time));
  const deadline = closesAt ? Date.parse(closesAt) : NaN;
  const end = Math.max(lastEvent, Number.isNaN(deadline) ? Date.now() : Math.min(Date.now(), deadline));
  const span = Math.max(end - start, 60_000);

  // Un peu de marge au-dessus du premier : la courbe de tête ne colle pas au cadre.
  const maxBets = Math.max(2, Math.ceil(Math.max(...drawn.map((entry) => entry.currentBets)) * 1.1));

  const x = (time: number) => PAD_LEFT + ((time - start) / span) * plotWidth;

  /** Escalier : horizontal jusqu'au pari suivant, puis saut vertical. */
  const stepPath = (entry: ProjectSeries) => {
    const [first, ...rest] = entry.points;
    let d = `M${x(first.time)},${y(first.bets)}`;
    for (const point of rest) d += ` H${x(point.time)} V${y(point.bets)}`;
    return `${d} H${x(start + span)}`;
  };
  const y = (bets: number) => PAD_TOP + (1 - bets / maxBets) * plotHeight;

  return (
    <figure className="m-0" style={frame}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`Évolution des paris. En tête : ${drawn
          .slice(0, 3)
          .map((entry) => `${entry.name}, ${plural(entry.currentBets, "pari")}`)
          .join(" ; ")}.`}
        className="block overflow-visible"
        fontSize={10}
        fontWeight={600}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD_LEFT} y={0} width={plotWidth} height={height} />
          </clipPath>
        </defs>

        {/* Pas de graduation collée au libellé « PARIS », qui la chevaucherait. */}
        {betTicks(maxBets)
          .filter((tick) => y(tick) > PAD_TOP + 8)
          .map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={plotRight}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeDasharray="2 4"
            />
            <text x={PAD_LEFT - 6} y={y(tick) + 3.5} textAnchor="end" fill="currentColor" fillOpacity={0.5}>
              {tick}
            </text>
          </g>
        ))}

        <line
          x1={PAD_LEFT}
          x2={plotRight}
          y1={PAD_TOP + plotHeight}
          y2={PAD_TOP + plotHeight}
          stroke="currentColor"
          strokeOpacity={0.25}
        />
        {[0, 1 / 3, 2 / 3, 1].map((fraction, index, all) => (
          <text
            key={fraction}
            x={PAD_LEFT + fraction * plotWidth}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === all.length - 1 ? "end" : "middle"}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {formatTime(start + fraction * span, span)}
          </text>
        ))}
        <text x={PAD_LEFT - 6} y={PAD_TOP - 4} textAnchor="end" fill="currentColor" fillOpacity={0.5}>
          PARIS
        </text>

        <g clipPath={`url(#${clipId})`}>
          {/* Tracé du dernier au premier : le plus soutenu passe par-dessus. */}
          {[...drawn].reverse().map((entry) => {
            const style = strokeFor(entry, drawn.indexOf(entry));
            return (
              <path
                key={entry.projectId}
                d={stepPath(entry)}
                fill="none"
                stroke={style.stroke}
                strokeOpacity={style.opacity}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {labelRows(drawn, y, plotHeight).map(({ entry, index, labelY }) => {
          const last = entry.points[entry.points.length - 1];
          const style = strokeFor(entry, index);
          return (
            <g key={`label-${entry.projectId}`}>
              <line
                x1={x(start + span)}
                x2={plotRight + 8}
                y1={y(last.bets)}
                y2={labelY}
                stroke={style.stroke}
                strokeOpacity={0.35}
              />
              <text x={plotRight + 12} y={labelY + 3.5} fontSize={11} fill="currentColor">
                <tspan fontWeight={700} fill={style.stroke} fillOpacity={style.opacity}>
                  {entry.currentBets}
                </tspan>
                <tspan dx={6} fontWeight={500}>
                  {truncate(entry.name, 18)}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/**
 * Ton pari en bleu, le podium annoncé en doré, le reste en gris (le favori
 * plus foncé). Les couleurs sont les mêmes que dans les cartes et le classement.
 */
function strokeFor(entry: ProjectSeries, index: number) {
  if (entry.isMine) return { stroke: "var(--mine)", opacity: 1, width: 3, dash: undefined };
  if (entry.place !== null) return { stroke: "var(--gold-line)", opacity: 1, width: 3, dash: undefined };
  const opacity = [0.85, 0.55, 0.42, 0.32, 0.25][Math.min(index, 4)];
  return { stroke: "currentColor", opacity, width: index === 0 ? 2.5 : 2, dash: undefined };
}

/** Empile les étiquettes qui se recouvriraient, en gardant l'ordre des courbes. */
function labelRows(drawn: ProjectSeries[], y: (bets: number) => number, plotHeight: number) {
  const minGap = 15;
  const rows = drawn.map((entry, index) => ({
    entry,
    index,
    labelY: y(entry.points[entry.points.length - 1].bets),
  }));

  rows.sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].labelY - rows[i - 1].labelY < minGap) rows[i].labelY = rows[i - 1].labelY + minGap;
  }

  const overflow = rows.length > 0 ? rows[rows.length - 1].labelY - (plotHeight + PAD_TOP) : 0;
  if (overflow > 0) for (const row of rows) row.labelY -= overflow;

  return rows;
}

/** Trois ou quatre graduations entières et rondes, de zéro au maximum. */
function betTicks(max: number): number[] {
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((candidate) => max / candidate <= 4) ?? 100;
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  return ticks;
}

/** « 14:05 » sur une journée, « sam. 14:05 » au-delà. */
function formatTime(time: number, span: number): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return span > 20 * 3_600_000 ? `${date.toLocaleDateString("fr-FR", { weekday: "short" })} ${clock}` : clock;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
