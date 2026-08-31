import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // De volledige jsdom-suite bevat meerdere interactieve Radix/user-event tests.
    // Op GitHub-hosted runners kan 5s net te krap zijn terwijl dezelfde tests
    // functioneel slagen. Houd de marge beperkt: dit is geen algemene 'lange test'-escape.
    testTimeout: 10_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
