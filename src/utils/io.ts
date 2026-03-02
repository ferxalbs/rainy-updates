import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  const tempFile = path.join(
    dir,
    `.tmp-${path.basename(filePath)}-${crypto.randomUUID()}`,
  );

  await mkdir(dir, { recursive: true });
  await Bun.write(tempFile, content);
  await rename(tempFile, filePath);
}
