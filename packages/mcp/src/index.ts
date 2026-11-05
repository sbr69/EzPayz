#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";

/**
 * MCP server entry point — stdio transport for local use with Claude Desktop, Cursor, VS Code.
 *
 * The client (e.g. Claude Desktop) spawns this as a subprocess and communicates via stdin/stdout.
 * Logs go to stderr (never stdout — stdout is reserved for MCP JSON-RPC messages).
 *
 * Configuration (Claude Desktop claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "whitechain": {
 *       "command": "node",
 *       "args": ["packages/mcp/dist/index.js"],
 *       "env": {
 *         "GATEWAY_SECRET_KEY": "wcp_sec_...",
 *         "GATEWAY_API_URL": "http://localhost:3000"
 *       }
 *     }
 *   }
 * }
 */

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[whitechain-mcp] Server started (stdio transport). Waiting for client connection...\n");
}

main().catch((err) => {
  process.stderr.write(`[whitechain-mcp] Fatal: ${err.message}\n`);
  process.exit(1);
});
