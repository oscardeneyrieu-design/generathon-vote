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

/** Les personnes d'un projet : photo + nom, qui passent à la ligne si besoin. */
export function MemberList({ members }: { members: Member[] }) {
  if (members.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
      {members.map((member) => (
        <li key={member.id} className="flex items-center gap-1.5">
          <Avatar member={member} />
          <span className="text-sm">{member.name}</span>
        </li>
      ))}
    </ul>
  );
}
