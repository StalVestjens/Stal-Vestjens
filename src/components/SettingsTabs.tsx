"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [["/instellingen", "Bedrijf"], ["/instellingen/gebruikers", "Medewerkers"], ["/instellingen/velden", "Eigen velden"], ["/instellingen/diensten", "Diensten & tarieven"], ["/instellingen/koppelingen", "Koppelingen"]];

export function SettingsTabs() {
  const p = usePathname();
  return (
    <div className="flex gap-1 flex-wrap mb-4 border-b border-[var(--line)]">
      {tabs.map(([h, l]) => <Link key={h} href={h} className={`px-3 py-2 text-sm border-b-2 -mb-px ${p === h ? "border-[var(--accent)] font-semibold" : "border-transparent muted"}`}>{l}</Link>)}
    </div>
  );
}
