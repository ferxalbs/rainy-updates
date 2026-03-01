export async function writeFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  await Bun.write(filePath, content);
}
