"use client";
import type { ReactNode } from "react";

/** Client-side formulier met bevestiging, voor server actions zoals verwijderen. */
export function ConfirmForm({ action, confirm, children, className }: { action: (fd: FormData) => Promise<void>; confirm: string; children: ReactNode; className?: string }) {
  return (
    <form action={action} className={className} onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      {children}
    </form>
  );
}
