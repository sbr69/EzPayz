import type { FastifyInstance } from "fastify";
import { createMcpFastifyApp } from "@modelcontextprotocol/fastify";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

/**
 * Mounts the MCP server on a Fastify instance at /mcp (Streamable HTTP transport).
 *
 * This allows remote MCP clients (Claude Desktop via mcp-remote, Cursor, VS Code)
 * to connect to the gateway's MCP server over HTTP. Each request gets a fresh
 * McpServer instance (per-request factory pattern).
 *
 * Auth: MCP clients authenticate by passing the merchant's secret API key as a
 * Bearer token in the Authorization header. The tool handlers use it for gateway
 * API calls (read from GATEWAY_SECRET_KEY env var or forwarded auth).
 *
 * For local stdio use (Claude Desktop subprocess), use `packages/mcp` directly:
 *   node packages/mcp/dist/index.js
 */
export async function mountMcp(parentApp: FastifyInstance): Promise<void> {
  // Dynamic import — the MCP package uses Zod v4 while apps/api uses Zod v3.
  // Dynamic import avoids the cross-package type conflict at compile time.
  const { createServer } = await import("@ezpayz/mcp/server");

  const handler = createMcpHandler(() => {
    return createServer();
  });

  const mcpApp = createMcpFastifyApp();
  const nodeHandler = toNodeHandler(handler);

  parentApp.all("/mcp", async (request, reply) => {
    const auth = request.headers.authorization;
    const rawRequest = auth
      ? Object.assign(request.raw, { auth: { token: auth.replace("Bearer ", ""), scheme: "Bearer" } })
      : request.raw;
    return nodeHandler(rawRequest, reply.raw, request.body);
  });
}
