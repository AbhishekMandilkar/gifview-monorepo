import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./api/index.ts"],
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@gifview-monorepo\/.*/],
});
