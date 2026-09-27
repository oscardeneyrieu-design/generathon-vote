import type { ReactNode } from "react";

export function Rule({ thick = false }: { thick?: boolean }) {
  return <hr className={thick ? "rule rule-thick" : "rule"} />;
}

/** Un chiffre et son libellé. Jamais groupé par quatre façon tableau de bord. */
export function StatPair({
  value,
  label,
  size = "md",
}: {
  value: ReactNode;
  label: string;
  size?: "md" | "lg";
}) {
  return (
    <div>
      <div
        className="font-extrabold leading-none"
        style={{
          fontSize: size === "lg" ? "2.5rem" : "1.75rem",
          fontStretch: "88%",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div className="t-label mt-1 text-[color:var(--color-ink-muted)]">{label}</div>
    </div>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return <div className="banner">{children}</div>;
}

export function SectionHeading({
  step,
  title,
  aside,
}: {
  step?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="t-label text-[color:var(--color-ink-muted)]">
        {/* Le numéro d'étape en bleu : il signale la progression du parcours,
            qui est la seule chose sur laquelle la personne peut agir. */}
        {step && <span className="ink-accent">{step} — </span>}
        {title}
      </h2>
      {aside}
    </div>
  );
}
