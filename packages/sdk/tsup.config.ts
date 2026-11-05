import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "viem", "wagmi"],
    outDir: "dist",
  },
  {
    entry: ["src/browser-entry.ts"],
    format: ["iife"],
    globalName: "WhitechainCheckout",
    splitting: false,
    sourcemap: true,
    noExternal: ["react", "viem", "wagmi"],
    outDir: "dist",
    onSuccess: "echo '✓ Standalone browser bundle: dist/browser-entry.global.js'",
  },
]);
