import { $ } from "bun";

const distDir = "dist";

await $`rm -rf ${distDir}`;
