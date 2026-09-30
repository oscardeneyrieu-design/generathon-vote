"use client";

import { useId } from "react";

import { formatOdds } from "@/lib/odds";
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
};

const LABEL_WIDTH = 150;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const PAD_LEFT = 38;

/**
 * Évolution des cotes, une courbe par projet.
 *
 * - Axe vertical inversé et logarithmique : une cote qui baisse est une bonne
 *   nouvelle, donc « monter » veut dire « mieux placé » ; et en linéaire les
 *   favoris s'écraseraient sur une bande.
 * - Axe horizontal en nombre de parieurs, pas en temps : une nuit de
 *   hackathon produirait des heures de plat.
 * - Étiquettes en bout de courbe plutôt qu'une légende.
 */
export function OddsChart({ series, limit = 5, width: WIDTH = 640, height = 200 }: Props) {
  const clipId = useId();
  const drawn = series.slice(0, limit).filter((entry) => entry.points.length > 1);
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

  const maxBettors = Math.max(1, ...drawn.map((entry) => entry.points.at(-1)?.bettors ?? 0));

  const allOdds = drawn.flatMap((entry) => entry.points.map((point) => point.odds));
  const minOdds = Math.max(1, Math.min(...allOdds));
  const maxOdds = Math.max(minOdds * 1.6, ...allOdds);
  const logMin = Math.log(minOdds);
  const logSpan = Math.log(maxOdds) - logMin || 1;

  const x = (bettors: number) => PAD_LEFT + (bettors / maxBettors) * plotWidth;
  // Inversion : cote faible en haut.
  const y = (odds: number) =>
    PAD_TOP + ((Math.log(Math.max(odds, minOdds)) - logMin) / logSpan) * plotHeight;

  return (
    <figure className="m-0" style={frame}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`Évolution des cotes. Favoris : ${drawn
          .slice(0, 3)
          .map((entry) => `${entry.name} à ${formatOdds(entry.currentOdds)}`)
          .join(", ")}.`}
        className="block overflow-visible"
        fontSize={10}
        fontWeight={600}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD_LEFT} y={0} width={plotWidth} height={height} />
          </clipPath>
        </defs>

        {oddsTicks(minOdds, maxOdds).map((tick) => (
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
              {formatOdds(tick)}
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
        <text x={PAD_LEFT} y={height - 8} fill="currentColor" fillOpacity={0.5}>
          PARIEURS →
        </text>
        <text x={plotRight} y={height - 8} textAnchor="end" fill="currentColor" fillOpacity={0.5}>
          {maxBettors}
        </text>
        <text x={PAD_LEFT - 6} y={PAD_TOP - 4} textAnchor="end" fill="currentColor" fillOpacity={0.5}>
          COTE
        </text>

        <g clipPath={`url(#${clipId})`}>
          {/* Tracé du dernier au premier : le favori passe par-dessus. */}
          {[...drawn].reverse().map((entry) => {
            const style = strokeFor(entry, drawn.indexOf(entry));
            return (
              <polyline
                key={entry.projectId}
                points={entry.points.map((p) => `${x(p.bettors)},${y(p.odds)}`).join(" ")}
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
                x1={x(last.bettors)}
                x2={plotRight + 8}
                y1={y(last.odds)}
                y2={labelY}
                stroke={style.stroke}
                strokeOpacity={0.35}
              />
              <text x={plotRight + 12} y={labelY + 3.5} fontSize={11} fill="currentColor">
                <tspan fontWeight={700} fill={style.stroke} fillOpacity={style.opacity}>
                  {formatOdds(entry.currentOdds)}
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

/** Empile les étiquettes qui se recouvriraient, en gardant l'ordre des cotes. */
function labelRows(drawn: ProjectSeries[], y: (odds: number) => number, plotHeight: number) {
  const minGap = 15;
  const rows = drawn.map((entry, index) => ({
    entry,
    index,
    labelY: y(entry.points[entry.points.length - 1].odds),
  }));

  rows.sort((a, b) => a.labelY - b.labelY);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].labelY - rows[i - 1].labelY < minGap) rows[i].labelY = rows[i - 1].labelY + minGap;
  }

  const overflow = rows.length > 0 ? rows[rows.length - 1].labelY - (plotHeight + PAD_TOP) : 0;
  if (overflow > 0) for (const row of rows) row.labelY -= overflow;

  return rows;
}

/** Graduations « rondes » en échelle log. */
function oddsTicks(min: number, max: number): number[] {
  const candidates = [1, 1.5, 2, 3, 5, 8, 12, 20, 35, 50, 75, 99];
  const inRange = candidates.filter((value) => value >= min && value <= max);
  if (inRange.length >= 3) return inRange;
  return [min, Math.sqrt(min * max), max].map((value) => Math.round(value * 10) / 10);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
