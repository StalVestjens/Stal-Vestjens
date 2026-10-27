import type { CustomField } from "@prisma/client";
import { Field } from "./ui";

/** Rendert de zelf gedefinieerde velden (Instellingen > Eigen velden) als formuliervelden. */
export function CustomFieldsForm({ fields, values }: { fields: CustomField[]; values: Record<string, unknown> }) {
  if (fields.length === 0) return null;
  return (
    <>
      {fields.map((f) => {
        const v = values?.[f.key];
        const name = `extra__${f.key}`;
        return (
          <Field key={f.id} label={f.label}>
            {f.type === "KEUZE" ? (
              <select name={name} className="select" defaultValue={String(v ?? "")}>
                <option value="">–</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "JANEE" ? (
              <select name={name} className="select" defaultValue={v === true ? "ja" : v === false ? "nee" : ""}>
                <option value="">–</option>
                <option value="ja">Ja</option>
                <option value="nee">Nee</option>
              </select>
            ) : (
              <input name={name} className="input" type={f.type === "GETAL" ? "number" : f.type === "DATUM" ? "date" : "text"} step="any" defaultValue={String(v ?? "")} />
            )}
          </Field>
        );
      })}
    </>
  );
}

/** Maakt van een Json-kolom een veilig object (voor weergave/formulier). */
export function extraOf(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

/** Leest de waarden van eigen velden uit een FormData (klaar om als Json op te slaan). */
export function readCustomFields(fd: FormData, fields: CustomField[]): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const raw = String(fd.get(`extra__${f.key}`) ?? "").trim();
    if (raw === "") continue;
    out[f.key] = f.type === "GETAL" ? Number(raw.replace(",", ".")) : f.type === "JANEE" ? raw === "ja" : raw;
  }
  return out;
}

export function CustomFieldsView({ fields, values }: { fields: CustomField[]; values: Record<string, unknown> }) {
  const rows = fields.filter((f) => values?.[f.key] !== undefined && values?.[f.key] !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {rows.map((f) => (
        <div key={f.id} className="contents">
          <dt className="muted">{f.label}</dt>
          <dd>{typeof values[f.key] === "boolean" ? (values[f.key] ? "Ja" : "Nee") : String(values[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}
