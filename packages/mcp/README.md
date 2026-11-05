# @ezpayz/mcp

MCP server for the EzPayz. Exposes tools + documentation resources to AI agents (Claude Desktop, Cursor, VS Code) so they can understand the gateway and perform operations on behalf of a developer/merchant.

## What it exposes

**Tools (11):** `create_payment_intent`, `list_payments`, `get_payment`, `create_payment_link`, `create_refund`, `list_refunds`, `list_customers`, `list_subscriptions`, `create_plan`, `get_analytics`, `verify_webhook_signature`

**Resources (8):** `whitechain://docs/how-to-use`, `whitechain://docs/prd`, `whitechain://docs/flow`, `whitechain://docs/eip-3009`, `whitechain://docs/api-reference`, `whitechain://docs/sdk-guide`, `whitechain://status`

## Setup

### 1. Local stdio (Claude Desktop, Cursor)

Build the package:
```bash
cd packages/mcp && pnpm build
```

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "whitechain": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "GATEWAY_SECRET_KEY": "wcp_sec_...",
        "GATEWAY_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 2. Remote HTTP (via the gateway API)

The MCP server is mounted at `/mcp` on the gateway's Fastify API. Connect via `mcp-remote`:

```json
{
  "mcpServers": {
    "whitechain": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp", "--header", "Authorization: Bearer ${AUTH_HEADER}"],
      "env": {
        "AUTH_HEADER": "wcp_sec_..."
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GATEWAY_SECRET_KEY` | Yes | — | Merchant secret API key (`wcp_sec_...`) |
| `GATEWAY_API_URL` | No | `http://localhost:3000` | Gateway API URL |

## Usage

Once connected, the AI agent can:
- Read the full developer docs (how-to-use, PRD, flow, API reference)
- Create payment intents, payment links, refunds, plans
- List payments, refunds, customers, subscriptions
- Get analytics overview
- Verify webhook signatures
- Check gateway status

Example prompt: *"Create a 10.00 USDT payment intent for 'Pro plan' and give me the checkout URL."*
