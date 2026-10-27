"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="btn btn-primary mb-6 print:hidden">Afdrukken / opslaan als PDF</button>;
}
