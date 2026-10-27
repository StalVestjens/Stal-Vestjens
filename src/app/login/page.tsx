import { redirect } from "next/navigation";
import { getSession, login } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  if (await getSession()) redirect("/");
  const { fout } = await searchParams;

  async function doLogin(fd: FormData) {
    "use server";
    const s = await login(String(fd.get("email")), String(fd.get("password")));
    if (!s) redirect("/login?fout=1");
    redirect("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={doLogin} className="card p-8 w-full max-w-sm space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest muted">Stalbeheer</div>
          <h1 className="text-xl font-bold mt-1">Inloggen</h1>
        </div>
        {fout && <p className="text-sm text-[var(--danger)]">E-mailadres of wachtwoord klopt niet.</p>}
        <div className="field"><label className="label">E-mail</label><input name="email" type="email" className="input" required autoFocus /></div>
        <div className="field"><label className="label">Wachtwoord</label><input name="password" type="password" className="input" required /></div>
        <button className="btn btn-primary w-full justify-center" type="submit">Inloggen</button>
      </form>
    </main>
  );
}
