import { requireSession, logout } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, b] = await Promise.all([requireSession(), getBranding()]);

  async function doLogout() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sidebar p-4 md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-2 mb-5 flex items-center gap-3">
          <img src={b.logoUrl} alt={b.naam} className="w-12 h-12 rounded-lg object-cover shrink-0" />
          <div className="min-w-0">
            <div className="font-bold leading-tight truncate">{b.naam}</div>
            <div className="text-xs sidebar-muted truncate">{session.name} · {session.role === "EIGENAAR" ? "Eigenaar" : "Medewerker"}</div>
          </div>
        </div>
        <Nav isOwner={session.role === "EIGENAAR"} />
        <form action={doLogout} className="mt-auto px-2 pt-4">
          <button className="text-sm sidebar-muted hover:opacity-100">Uitloggen</button>
        </form>
      </aside>
      <main className="p-4 md:p-8 max-w-6xl w-full">{children}</main>
    </div>
  );
}
