import { McpServer } from "@modelcontextprotocol/server";
import { registerTools } from "./tools/index.js";
import { registerDocsResources } from "./resources/docs.js";

/**
 * Creates a fully configured McpServer instance with all tools + resources registered.
 * Shared by the stdio entry point and the Fastify HTTP mount.
 *
 * Each call creates a fresh server (for per-request use in HTTP mode).
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "ezpayz",
    version: "0.1.0",
    title: "EzPayz",
    description:
      "EzPayz MCP server. " +
      "Accept gasless USDT payments on Whitechain Sepolia via EIP-3009. " +
      "Tools: create/list/get payments, refunds, customers, subscriptions, plans, analytics, payment links, webhook verification. " +
      "Resources: full developer docs (how-to-use, PRD, flow, EIP-3009, API reference, SDK guide), live gateway status.",
  });

  registerTools(server);
  registerDocsResources(server);

  return server;
}
