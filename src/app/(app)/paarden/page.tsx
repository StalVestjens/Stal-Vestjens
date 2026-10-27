import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";

const STATUS: Record<string, { label: string; tone?: "ok" | "warn" | "danger" }> = {
  AANWEZIG: { label: "Aanwezig", tone: "ok" },
  AFWEZIG: { label: "Afwezig", tone: "warn" },
  VERKOCHT: { label: "Verkocht" },
  OVERLEDEN: { label: "Overleden" },
};

export default async function HorsesPage({ searchParams }: { searchParams: Promise<{ q?: string; alle?: string }> }) {
  await requireSession();
  const { q, alle } = await searchParams;
  const horses = await db.horse.findMany({
    where: {
      ...(alle ? {} : { status: { in: ["AANWEZIG", "AFWEZIG"] } }),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { ueln: { contains: q } }, { chipNumber: { contains: q } }, { owner: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { owner: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Paarden" subtitle={`${horses.length} paarden`} actions={<Link href="/paarden/nieuw" className="btn btn-primary">+ Nieuw paard</Link>} />
      <form className="flex gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Zoek op naam, UELN, chip of eigenaar" className="input max-w-sm" />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="alle" value="1" defaultChecked={!!alle} /> Ook verkocht/overleden</label>
        <button className="btn">Zoeken</button>
      </form>
      <Card>
        {horses.length === 0 ? <Empty>Nog geen paarden. Voeg je eerste paard toe.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Naam</th><th>Geslacht</th><th>Geboren</th><th>Eigenaar</th><th>Stal</th><th>Discipline</th><th>Status</th></tr></thead>
            <tbody>
              {horses.map((h) => (
                <tr key={h.id}>
                  <td><Link href={`/paarden/${h.id}`} className="font-medium">{h.name}</Link>{h.nickname && <span className="muted"> ({h.nickname})</span>}</td>
                  <td>{h.sex ? { HENGST: "Hengst", MERRIE: "Merrie", RUIN: "Ruin" }[h.sex] : "–"}</td>
                  <td>{fmtDate(h.birthDate)}</td>
                  <td>{h.owner ? <Link href={`/klanten/${h.owner.id}`}>{h.owner.name}</Link> : <span className="muted">Eigen</span>}</td>
                  <td>{h.stall ?? "–"}</td>
                  <td>{[h.discipline, h.level].filter(Boolean).join(" ") || "–"}</td>
                  <td><Badge tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
