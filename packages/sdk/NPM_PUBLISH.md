# Publishing the SDK — npm setup

The `@ezpayz/sdk` package can be published two ways. **Option B** (public npm) is the intended approach going forward; **Option A** (private registry) is documented as an alternative for internal/private use.

> **Note:** The SDK is not yet published to npm. Run `pnpm build` after cloning to generate `dist/` locally. When ready to publish, follow Option B below.

---

## Option B — Public npm package (recommended)

When ready to make the SDK publicly installable (no auth required), use the public npm registry:

### Setup (publisher)

1. **Create an npm account** at https://www.npmjs.com (if not already).

2. **Login:**
   ```bash
   npm login
   ```

3. **Build + publish:**
   ```bash
   cd packages/sdk
   pnpm build
   npm publish --access public
   ```
   The `--access public` flag is required for scoped packages (`@ezpayz/sdk`) — scoped packages default to restricted (private) on the public registry.

### Setup (consumer — any developer)

No auth needed:
```bash
npm install @ezpayz/sdk
```

---

## Option A — Private npm package via GitHub Packages (alternative)

For private/internal use only — GitHub Packages hosts scoped npm packages privately. Only people with access to the GitHub repo can install the package.

### Setup (publisher)

1. **Create a GitHub PAT** with `write:packages` scope.

2. **Configure npm auth** — create or edit `~/.npmrc`:
   ```ini
   @ezpayz:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
   ```

3. **Publish:**
   ```bash
   cd packages/sdk
   pnpm build
   npm publish
   ```

### Setup (consumer)

The merchant must authenticate to install the private package:
1. Create a GitHub PAT with `read:packages` scope.
2. Add `.npmrc`:
   ```ini
   @ezpayz:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
   ```
3. `npm install @ezpayz/sdk`

---

## Other packages — publishing status

| Package | npm private flag | Publishable? | Notes |
|---|---|---|---|
| `@ezpayz/sdk` | `false` | ✅ Yes — public | ESM + IIFE browser bundle |
| `@ezpayz/mcp` | `false` | ✅ Yes — public | MCP server for AI agents |
| `@ezpayz/contracts` | `false` | ✅ Public (source visible) | Foundry project — Solidity source, not an npm package |
| `dist/` directories | gitignored | Run `pnpm build` after cloning | Build artifacts (standard practice — not committed) |
| `.env` | gitignored | ❌ Never commit | Contains secrets (DATABASE_URL, RELAYER_PRIVATE_KEY, JWT_SECRET) |

---

## Building before publish

Always build before publishing:
```bash
cd packages/sdk
pnpm build
```

The `prepublishOnly` script in `package.json` runs `tsup` automatically, so `npm publish` will build first.

## Versioning

Bump the version in `package.json` before each publish:
```bash
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0
```
