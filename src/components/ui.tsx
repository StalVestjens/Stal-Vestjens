import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card p-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted text-sm py-6 text-center">{children}</p>;
}

export function Stat({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: "warn" | "danger" | "ok" }) {
  const color = tone === "danger" ? "text-[var(--danger)]" : tone === "warn" ? "text-[var(--warn)]" : "";
  const inner = (
    <div className="card p-4">
      <div className="muted text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "danger" }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ""}`}>{children}</span>;
}
