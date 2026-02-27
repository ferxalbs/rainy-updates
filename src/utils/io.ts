import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `.tmp-${path.basename(filePath)}-${crypto.randomUUID()}`);
  await fs.writeFile(tempPath, content, "utf8");
  await fs.rename(tempPath, filePath);
}
