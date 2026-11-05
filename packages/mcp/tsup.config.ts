import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@modelcontextprotocol/server", "@modelcontextprotocol/fastify", "@modelcontextprotocol/node"],
});
