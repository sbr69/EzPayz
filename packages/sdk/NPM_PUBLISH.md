# Publishing the SDK — npm setup

The `@ezpayz/sdk` package can be published two ways. **Option A** (private registry) is the current approach; **Option B** (public npm) is documented for later use.

---

## Option A — Private npm package via GitHub Packages (current)

GitHub Packages hosts scoped npm packages privately — only people with access to the GitHub repo can install the package. This is free and uses a GitHub Personal Access Token (PAT) for auth.

### Setup (publisher — you, once)

1. **Create a GitHub PAT** with `write:packages` scope:
   - Go to https://github.com/settings/tokens (classic) or use a fine-grained token
   - Select `write:packages` (this also grants `read:packages`)

2. **Configure npm auth** — create or edit `~/.npmrc` (your home directory):
   ```ini
   @ezpayz:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
   ```
   Replace `YOUR_GITHUB_PAT` with the token from step 1.

3. **Publish:**
   ```bash
   cd packages/sdk
   pnpm build
   npm publish
   ```
   The package publishes to `https://npm.pkg.github.com` as `@ezpayz/sdk`.

### Setup (consumer — the demo merchant app)

The merchant must authenticate to install the private package:

1. **Create a GitHub PAT** with `read:packages` scope (or reuse the same token).

2. **Add `.npmrc`** in the merchant project root:
   ```ini
   @ezpayz:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
   ```

3. **Install:**
   ```bash
   npm install @ezpayz/sdk
   # or
   pnpm add @ezpayz/sdk
   ```

> **Note:** The merchant needs access to the GitHub repo that owns the package. For a hackathon demo, make the repo public (or add the demo merchant's GitHub account as a collaborator) so the PAT can read the package.

---

## Option B — Public npm package (for later)

When ready to make the SDK publicly installable (no auth required), switch to the public npm registry:

### Setup (publisher)

1. **Create an npm account** at https://www.npmjs.com (if not already).

2. **Login:**
   ```bash
   npm login
   ```

3. **Remove the private registry config** from `~/.npmrc` (or scope it differently):
   ```ini
   # Remove or comment out the @ezpayz registry line
   # @ezpayz:registry=https://npm.pkg.github.com
   ```

4. **Publish:**
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

## Building before publish

Always build before publishing:
```bash
cd packages/sdk
pnpm build
```

The `prepublishOnly` script in `package.json` runs `tsup` automatically, so `npm publish` will build first.

## Versioning

Bump the version in `packages/sdk/package.json` before each publish:
```bash
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0
```
