import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// `server-only` throws when imported outside a real server bundle; stub it to a no-op so
// server-side lib modules (lib/ai, lib/wikipedia, …) can be unit-tested under Vitest.
const serverOnlyStub = fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "server-only": serverOnlyStub,
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  }
  test: {
    globals: true,
    setupFiles: ["./test/setup.ts"],
    // Two environments: node for server/lib/route logic, jsdom for hooks + components.
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/lib/**/*.test.ts", "src/app/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/hooks/**/*.test.ts", "src/components/**/*.test.tsx"],
        },
      },
    ],
  },
});
