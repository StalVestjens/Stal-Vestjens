import { redirect } from "next/navigation";
import { getSession, login } from "@/lib/auth";
import { getBranding } from "@/lib/branding";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  if (await getSession()) redirect("/");
  const { fout } = await searchParams;
  const b = await getBranding();

  async function doLogin(fd: FormData) {
    "use server";
    const s = await login(String(fd.get("email")), String(fd.get("password")));
    if (!s) redirect("/login?fout=1");
    redirect("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={doLogin} className="card p-8 w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center text-center gap-3">
          <img src={b.logoUrl} alt={b.naam} className="w-28 h-28 rounded-2xl object-cover shadow" />
          <div>
            <h1 className="text-xl font-bold">{b.naam}</h1>
            <p className="text-sm muted">Inloggen</p>
          </div>
        </div>
        {fout && <p className="text-sm text-[var(--danger)]">E-mailadres of wachtwoord klopt niet.</p>}
        <div className="field"><label className="label">E-mail</label><input name="email" type="email" className="input" required autoFocus autoComplete="username" /></div>
        <div className="field"><label className="label">Wachtwoord</label><input name="password" type="password" className="input" required autoComplete="current-password" /></div>
        <button className="btn btn-primary w-full justify-center" type="submit">Inloggen</button>
      </form>
    </main>
  );
}
