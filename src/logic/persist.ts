import { promises as fs } from "node:fs";
import path from "node:path";

export function dataDir(): string | null {
  const d = process.env.HOMECP_DATA_DIR?.trim();
  return d || null;
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  const dir = dataDir();
  if (!dir) return fallback;
  try {
    const raw = await fs.readFile(path.join(dir, name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(name: string, value: unknown): Promise<void> {
  const dir = dataDir();
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, name),
    JSON.stringify(value, null, 2),
    "utf8",
  );
}
