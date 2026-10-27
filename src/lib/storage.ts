import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

const root = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

/** Slaat een bestand op en geeft de opslagsleutel terug. */
export async function saveFile(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${ext}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export const readStoredFile = (key: string) => readFile(path.join(root(), key));

export async function deleteStoredFile(key: string) {
  try {
    await unlink(path.join(root(), key));
  } catch {
    /* al weg */
  }
}
