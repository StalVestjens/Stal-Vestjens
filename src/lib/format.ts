/**
 * Datum- en getalhulpjes.
 *
 * Afspraak: "datum zonder tijd" (taakdatum, vaccinatiedatum, factuurdatum, meting) wordt opgeslagen
 * als UTC-middernacht (new Date("2026-10-22")). Zo blijft de dag gelijk, los van de tijdzone van de server.
 * Tijdstippen (transport, aangemaakt-op) zijn echte momenten en worden in de Nederlandse tijdzone getoond.
 */
export const TZ = process.env.APP_TIMEZONE ?? "Europe/Amsterdam";

/** Datum van vandaag (of van een moment) in NL-tijd als "YYYY-MM-DD". */
export const localDateStr = (d: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Vandaag als UTC-middernacht, geschikt voor vergelijken/opslaan van datumvelden. */
export const todayDate = () => new Date(localDateStr());

/** "YYYY-MM-DD" van een datumveld (UTC-middernacht); zonder argument: vandaag in NL-tijd. */
export const isoDate = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : localDateStr());

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

export const fmtDate = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "–";

export const fmtDateTime = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "–";

export const fmtTime = (d?: Date | string | null) =>
  d ? new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";

/** Lange datumnotatie, bv. "donderdag 22 oktober 2026" (opties naar keuze). */
export const fmtDay = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, ...opts }).format(d);

function tzOffsetMs(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - d.getTime();
}

/** Waarde van een <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", NL-tijd) → echt tijdstip. */
export function fromLocalInput(s: string): Date {
  const [d, t] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = (t ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, h, min);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}

/** Tijdstip → waarde voor <input type="datetime-local"> in NL-tijd. */
export function toLocalInput(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export const fmtMoney = (n?: number | string | { toString(): string } | null) =>
  n == null ? "–" : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n));

export const fmtNum = (n?: number | string | { toString(): string } | null, digits = 0) =>
  n == null ? "–" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: digits }).format(Number(n));

export const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(",", ".").trim();
  return s === "" ? null : Number(s);
};
export const str = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
/** Waarde van een <input type="date"> → UTC-middernacht (null als leeg). */
export const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : new Date(s.slice(0, 10));
};

export const HEALTH_LABELS: Record<string, string> = {
  VACCINATIE: "Vaccinatie",
  ONTWORMING: "Ontworming",
  SMID: "Smid",
  DIERENARTS: "Dierenarts",
  FYSIO: "Fysio",
  TANDARTS: "Tandarts",
  ROENTGEN: "Röntgen",
  BEHANDELING: "Behandeling",
  OVERIG: "Overig",
};

export const TASK_CATEGORIES = ["Training", "Longeren", "Paddock", "Stappenmolen", "Voeren", "Stal", "Smid", "Dierenarts", "Transport", "Les", "Wedstrijd", "Onderhoud", "Overig"];

export const INVOICE_LABELS: Record<string, string> = {
  CONCEPT: "Concept",
  VERZONDEN: "Verzonden",
  BETAALD: "Betaald",
  HERINNERD: "Herinnerd",
  CREDIT: "Creditnota",
  GECREDITEERD: "Gecrediteerd",
  VERVALLEN: "Vervallen",
};
