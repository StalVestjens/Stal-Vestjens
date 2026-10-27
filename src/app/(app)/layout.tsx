import { requireSession, logout } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  async function doLogout() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-[#1f3a2c] text-white p-4 md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-2 mb-5">
          <div className="text-xs uppercase tracking-widest text-[#9fc2ad]">Stalbeheer</div>
          <div className="font-bold">{session.name}</div>
          <div className="text-xs text-[#9fc2ad]">{session.role === "EIGENAAR" ? "Eigenaar" : "Medewerker"}</div>
        </div>
        <Nav isOwner={session.role === "EIGENAAR"} />
        <form action={doLogout} className="mt-auto px-2 pt-4">
          <button className="text-sm text-[#9fc2ad] hover:text-white">Uitloggen</button>
        </form>
      </aside>
      <main className="p-4 md:p-8 max-w-6xl w-full">{children}</main>
    </div>
  );
}
