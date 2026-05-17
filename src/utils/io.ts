import { $ } from "bun";
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

  await $`mkdir -p ${dir}`;
  await Bun.write(tempFile, content);
  await $`mv ${tempFile} ${filePath}`;
}
