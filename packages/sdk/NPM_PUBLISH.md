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
| `@ezpayz/sdk` | `false` | ✅ Yes — Option B (public) recommended | ESM + IIFE browser bundle |
| `@ezpayz/mcp` | `true` | ⚠️ Not yet — set to `false` when ready to publish | MCP server for AI agents |
| `packages/contracts` | `true` | ❌ No — Foundry project, not an npm package | Contract source is in the repo |
| `dist/` directories | gitignored | ⚠️ Not committed — run `pnpm build` after cloning | Build artifacts |

### When ready to make everything public:
1. Set `packages/mcp/package.json` → `"private": false"`
2. Un-gitignore `dist/` (remove `dist/` from `.gitignore`) OR keep gitignored and document `pnpm build`
3. Publish both SDK + MCP to public npm via Option B
4. Keep `packages/contracts/package.json` as `"private": true"` (not an npm package)
5. Keep `.env` gitignored (contains secrets — DATABASE_URL, RELAYER_PRIVATE_KEY, JWT_SECRET)

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
