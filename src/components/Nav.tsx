"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Vandaag", icon: "📅" },
  { href: "/paarden", label: "Paarden", icon: "🐴" },
  { href: "/planning", label: "Planning", icon: "🗓️" },
  { href: "/gezondheid", label: "Gezondheid", icon: "💉" },
  { href: "/wedstrijden", label: "Wedstrijden", icon: "🏆" },
  { href: "/postvak", label: "Postvak", icon: "📥" },
  { href: "/klanten", label: "Klanten", icon: "👥" },
  { href: "/facturen", label: "Facturen", icon: "🧾", owner: true },
  { href: "/transport", label: "Transport", icon: "🚚" },
  { href: "/zonnepanelen", label: "Zonnepanelen", icon: "☀️" },
  { href: "/rvo", label: "RVO I&R", icon: "🏛️" },
  { href: "/instellingen", label: "Instellingen", icon: "⚙️", owner: true },
  { href: "/account", label: "Mijn account", icon: "👤" },
];

export function Nav({ isOwner }: { isOwner: boolean }) {
  const path = usePathname();
  return (
    <nav className="nav flex md:flex-col gap-1 overflow-x-auto">
      {items.filter((i) => !i.owner || isOwner).map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : ""}>
            <span>{i.icon}</span><span className="whitespace-nowrap">{i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
