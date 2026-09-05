import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    reporters: ["default", "json"],
    outputFile: "artifacts/unit-results.json",
  },
});
