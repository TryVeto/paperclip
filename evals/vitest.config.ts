import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const evalsRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: evalsRoot,
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
      },
    },
  },
  test: {
    include: ["**/*.test.ts"],
  },
});
