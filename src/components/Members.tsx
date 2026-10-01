import type { Member } from "@/lib/types";

/** Initiales pour une personne sans photo : « Chloé Martin » → « CM ». */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Photo ronde, ou initiales sur fond doré comme sur generathon.tech. */
export function Avatar({ member, size = 28 }: { member: Pick<Member, "name" | "photo_url">; size?: number }) {
  if (member.photo_url) {
    return (
      <img
        src={member.photo_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-full border-2 border-white object-cover dark:border-neutral-900"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full border-2 border-white bg-gold font-bold text-black dark:border-neutral-900"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(member.name)}
    </span>
  );
}

/**
 * Version compacte, pour les cartes de la grille : photos qui se chevauchent,
 * puis les prénoms sur une ou deux lignes.
 */
export function MemberStack({ members }: { members: Member[] }) {
  if (members.length === 0) return null;

  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex -space-x-2" aria-hidden="true">
        {members.slice(0, 5).map((member) => (
          <Avatar key={member.id} member={member} size={30} />
        ))}
      </span>
      <span className="line-clamp-2 text-xs text-black/60 dark:text-white/60">
        {members.map((member) => member.name).join(", ")}
      </span>
    </span>
  );
}
