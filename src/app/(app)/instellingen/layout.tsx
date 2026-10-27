import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireSession("EIGENAAR");
  return (
    <>
      <PageHeader title="Instellingen" />
      <SettingsTabs />
      {children}
      <p className="text-xs muted mt-8">Hulp nodig? <Link href="/instellingen/koppelingen" className="underline">Koppelingen</Link> bevat per dienst de stappen om toegang aan te vragen.</p>
    </>
  );
}
