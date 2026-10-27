import { db } from "./db";

/** Instelling ophalen: eerst database (Instellingen-scherm), dan .env als fallback. */
export async function getSetting(key: string, envName?: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  if (row?.value) return row.value;
  return (envName && process.env[envName]) || "";
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = rows.find((r) => r.key === k)?.value ?? "";
  return out;
}

export async function logSync(integration: string, ok: boolean, message: string, count = 0) {
  await db.syncLog.create({ data: { integration, ok, message, count } });
}
