import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@localspotlight/core": path.resolve(__dirname, "../..", "packages/core/src"),
      "@localspotlight/ui": path.resolve(__dirname, "../..", "packages/ui/src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
