"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { formatPoints, PODIUM_SHARE, popularityPoints } from "@/lib/points";
import { formatWeight, MIN_WEIGHT } from "@/lib/voting";

/** v2 : le pari en deux taps est une règle nouvelle, tout le monde doit la revoir. */
const STORAGE_KEY = "pv_rules_seen_v2";

/** Vrai si cet appareil a déjà lu les règles jusqu'au bout. */
export function hasSeenRules(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Navigation privée ou stockage bloqué : on remontrera les règles, tant pis.
    return false;
  }
}

function markRulesSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Idem : rien de grave si ça ne tient pas.
  }
}

// Couleurs fixes : l'écran est toujours noir, quel que soit le thème. Les
// teintes « favori » (gris) et « outsider » (jaune) sont celles des cartes.
const GOLD = "#e4b363";
const MINE = "#60a5fa";
const COOL = "#a3a3a3";
const WARM = "#facc15";
const LINE = "rgba(255,255,255,0.22)";
const SOFT = "rgba(255,255,255,0.06)";

/** L'exemple chiffré des règles, tiré de la vraie formule : 12 projets, 40 parieurs. */
const FAVOURITE = popularityPoints(9, 40, 12);
const OUTSIDER = popularityPoints(1, 40, 12);

type Step = { title: string; body: ReactNode; art: ReactNode };

const Em = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-white">{children}</strong>;

const STEPS: Step[] = [
  {
    title: "Devine les gagnants",
    body: (
      <>
        Trois tracks, <Em>un pari par track</Em>. Dans chacune, choisis le projet qui va gagner.
      </>
    ),
    art: <TracksArt />,
  },
  {
    title: "Deux taps pour parier",
    body: (
      <>
        Touche une carte pour la sélectionner, puis <Em>touche-la encore pour confirmer</Em>. Tu peux changer
        d&apos;avis jusqu&apos;à la clôture.
      </>
    ),
    art: <DoubleTapArt />,
  },
  {
    title: "Ose l'outsider",
    body: (
      <>
        Moins un projet a de parieurs, <Em>plus il rapporte</Em>. Tes points se figent au moment où tu paries.
      </>
    ),
    art: <CrowdArt />,
  },
  {
    title: "Parie tôt",
    body: (
      <>
        Ton bonus baisse avec le temps&nbsp;: <Em>100&nbsp;% à l&apos;ouverture</Em>, {formatWeight(MIN_WEIGHT)} à la
        clôture. Changer d&apos;avis recalcule tes points.
      </>
    ),
    art: <BonusArt />,
  },
  {
    title: "Gagne des points",
    body: (
      <>
        Ton projet finit 1er&nbsp;: <Em>100&nbsp;% de tes points</Em>. 2e&nbsp;: {formatWeight(PODIUM_SHARE[2])}.
        3e&nbsp;: {formatWeight(PODIUM_SHARE[3])}.
      </>
    ),
    art: <PodiumArt />,
  },
];

/**
 * Les règles, en plein écran noir, à la première visite. Une idée par
 * écran : une illustration, un titre, une phrase. « Suivant » pour avancer,
 * « OK, je parie » pour finir.
 */
export function RulesIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const stepRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // La page derrière ne défile pas tant que les règles sont ouvertes.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // À chaque écran, le focus revient sur son contenu : un lecteur d'écran
  // lit le nouveau titre plutôt que de rester sur le bouton.
  useEffect(() => {
    stepRef.current?.focus();
  }, [index]);

  // Le focus reste dans les règles : Tab ne doit pas partir dans la page
  // cachée derrière (aria-modal ne l'empêche pas à lui seul).
  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusables = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([tabindex='-1'])")];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const lastItem = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === stepRef.current)) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={trapFocus}
      className="rules-backdrop fixed inset-0 z-50 overflow-y-auto bg-black text-white"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]">
        <div className="flex justify-center gap-2" aria-label={`Étape ${index + 1} sur ${STEPS.length}`} role="img">
          {STEPS.map((_, dot) => (
            <span
              key={dot}
              className={`h-1.5 rounded-full transition-all ${
                dot === index ? "w-6 bg-gold" : dot < index ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div
          key={index}
          ref={stepRef}
          tabIndex={-1}
          className="rules-step flex flex-1 flex-col items-center justify-center gap-10 py-10 text-center outline-none"
        >
          <div className="w-full max-w-[17rem]">{step.art}</div>
          <div className="flex flex-col gap-3">
            <h2 id={titleId} className="text-3xl font-extrabold tracking-tight">
              {step.title}
            </h2>
            <p className="text-base leading-relaxed text-white/60">{step.body}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="btn btn-gold min-h-12 w-full rounded-full text-base"
            onClick={() => {
              if (!last) return setIndex(index + 1);
              markRulesSeen();
              onDone();
            }}
          >
            {last ? "OK, je parie" : "Suivant"}
          </button>
          <button
            type="button"
            className={`min-h-10 px-4 text-sm text-white/50 hover:text-white ${index === 0 ? "invisible" : ""}`}
            onClick={() => setIndex(Math.max(0, index - 1))}
            tabIndex={index === 0 ? -1 : undefined}
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ illustrations
// Décoratives : le texte dit tout, elles l'appuient. D'où `aria-hidden`.
// Même grammaire partout : traits fins, fonds à peine visibles, une couleur
// d'accent par dessin.

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 280 180" className="block h-auto w-full" aria-hidden="true" fontFamily="inherit">
      {children}
    </svg>
  );
}

function Cup({ x, y, size = 1, color = GOLD }: { x: number; y: number; size?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} fill={color}>
      <path d="M-10 -12 H10 V-4 C10 4 5 8 0 8 C-5 8 -10 4 -10 -4 Z" />
      <path d="M-10 -9 H-15 C-15 -2 -12 1 -9 1" fill="none" stroke={color} strokeWidth={2.5} />
      <path d="M10 -9 H15 C15 -2 12 1 9 1" fill="none" stroke={color} strokeWidth={2.5} />
      <rect x={-2} y={8} width={4} height={6} />
      <rect x={-8} y={14} width={16} height={4} rx={1.5} />
    </g>
  );
}

function Person({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <circle cx={0} cy={-7} r={5} />
      <path d="M-8 9 C-8 1 -4 -1 0 -1 C4 -1 8 1 8 9 Z" />
    </g>
  );
}

function Check({ x, y, r = 11, color = MINE }: { x: number; y: number; r?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={color} />
      <path
        d={`M${-r * 0.4} 0 L${-r * 0.1} ${r * 0.32} L${r * 0.45} ${-r * 0.32}`}
        fill="none"
        stroke="#0a0a0a"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Trois tracks, un trophée et un pari chacune. */
function TracksArt() {
  return (
    <Art>
      {[0, 1, 2].map((i) => {
        const x = 10 + i * 90;
        return (
          <g key={i}>
            <rect x={x} y={26} width={80} height={120} rx={16} fill={SOFT} stroke={LINE} />
            <Cup x={x + 40} y={74} size={1.25} />
            <Check x={x + 40} y={120} />
          </g>
        );
      })}
    </Art>
  );
}

/** Premier tap : sélection. Second tap : pari confirmé. */
function DoubleTapArt() {
  return (
    <Art>
      {/* 1 · sélection */}
      <rect x={8} y={20} width={112} height={122} rx={16} fill={SOFT} stroke={GOLD} strokeWidth={2} />
      <rect x={24} y={40} width={60} height={9} rx={4.5} fill="#ffffff" fillOpacity={0.7} />
      <rect x={24} y={56} width={38} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.3} />
      <circle cx={64} cy={104} r={22} fill="none" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={2} />
      <circle cx={64} cy={104} r={10} fill="#ffffff" />
      <text x={64} y={168} textAnchor="middle" fill={GOLD} fontSize={12} fontWeight={700}>
        1 · Sélection
      </text>

      <path d="M130 81 H148 M142 75 L148 81 L142 87" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={2} fill="none" />

      {/* 2 · confirmé */}
      <rect x={160} y={20} width={112} height={122} rx={16} fill={MINE} fillOpacity={0.14} stroke={MINE} strokeWidth={2} />
      <rect x={176} y={40} width={60} height={9} rx={4.5} fill="#ffffff" fillOpacity={0.7} />
      <rect x={176} y={56} width={38} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.3} />
      <Check x={216} y={104} r={16} />
      <text x={216} y={168} textAnchor="middle" fill={MINE} fontSize={12} fontWeight={700}>
        2 · Confirmé
      </text>
    </Art>
  );
}

/** Le favori rapporte peu, l'outsider rapporte gros : les teintes des cartes. */
function CrowdArt() {
  const crowd = Array.from({ length: 9 }, (_, i) => ({ x: 40 + (i % 3) * 26, y: 44 + Math.floor(i / 3) * 28 }));
  return (
    <Art>
      {crowd.map((p) => (
        <Person key={`${p.x}-${p.y}`} x={p.x} y={p.y} color={COOL} />
      ))}
      <text x={66} y={150} textAnchor="middle" fill="#ffffff" fontSize={24} fontWeight={800}>
        {formatPoints(FAVOURITE)}
        <tspan fontSize={11} fillOpacity={0.5} dx={3}>
          pts
        </tspan>
      </text>
      <text x={66} y={170} textAnchor="middle" fill={COOL} fontSize={11} fontWeight={600}>
        Favori · 9 paris
      </text>

      <line x1={140} y1={30} x2={140} y2={170} stroke={LINE} />

      <Person x={214} y={72} color={WARM} />
      <text x={214} y={150} textAnchor="middle" fill={WARM} fontSize={24} fontWeight={800}>
        {formatPoints(OUTSIDER)}
        <tspan fontSize={11} fillOpacity={0.7} dx={3}>
          pts
        </tspan>
      </text>
      <text x={214} y={170} textAnchor="middle" fill={WARM} fontSize={11} fontWeight={600}>
        Outsider · 1 pari
      </text>
    </Art>
  );
}

/** Le bonus de rapidité : de 100 % à l'ouverture au plancher à la clôture. */
function BonusArt() {
  const left = 28;
  const right = 252;
  const top = 40;
  const bottom = 140;
  const floorY = bottom - (bottom - top) * MIN_WEIGHT;
  return (
    <Art>
      <path d={`M${left} ${top} L${right} ${floorY} L${right} ${bottom} L${left} ${bottom} Z`} fill={GOLD} fillOpacity={0.12} />
      <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={LINE} />
      <line x1={left} y1={top} x2={right} y2={floorY} stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
      <circle cx={left} cy={top} r={5} fill={GOLD} />
      <circle cx={right} cy={floorY} r={5} fill={GOLD} />
      <text x={left} y={top - 14} fill={GOLD} fontSize={16} fontWeight={800}>
        100 %
      </text>
      <text x={right} y={floorY - 14} textAnchor="end" fill={GOLD} fontSize={16} fontWeight={800}>
        {formatWeight(MIN_WEIGHT)}
      </text>
      <text x={left} y={162} fill="#ffffff" fillOpacity={0.5} fontSize={11} fontWeight={600}>
        Ouverture
      </text>
      <text x={right} y={162} textAnchor="end" fill="#ffffff" fillOpacity={0.5} fontSize={11} fontWeight={600}>
        Clôture
      </text>
    </Art>
  );
}

/** Le podium et la part des points de chaque marche. */
function PodiumArt() {
  const steps = [
    { place: 2, label: "2e", x: 14, height: 70 },
    { place: 1, label: "1er", x: 98, height: 104 },
    { place: 3, label: "3e", x: 182, height: 50 },
  ] as const;
  const base = 172;
  return (
    <Art>
      <Cup x={140} y={36} size={1.4} />
      {steps.map((s) => {
        const first = s.place === 1;
        const top = base - s.height;
        return (
          <g key={s.place}>
            <rect x={s.x} y={top} width={84} height={s.height} rx={10} fill={first ? GOLD : SOFT} stroke={first ? GOLD : LINE} />
            <text x={s.x + 42} y={top + 22} textAnchor="middle" fill={first ? "#0a0a0a" : "#ffffff"} fillOpacity={first ? 1 : 0.6} fontSize={12} fontWeight={700}>
              {s.label}
            </text>
            <text x={s.x + 42} y={top + 42} textAnchor="middle" fill={first ? "#0a0a0a" : "#ffffff"} fontSize={16} fontWeight={800}>
              {formatWeight(PODIUM_SHARE[s.place])}
            </text>
          </g>
        );
      })}
    </Art>
  );
}
