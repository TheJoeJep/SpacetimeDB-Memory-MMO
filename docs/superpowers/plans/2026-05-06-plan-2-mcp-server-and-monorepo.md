# Plan 2 — MCP Server + Monorepo Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the project to an npm-workspaces monorepo, push to the public GitHub remote, then build an MCP server that any AI host (Claude Code, Cursor, custom agents) can connect to. The MCP server exposes memory tools that wrap the SpacetimeDB reducers from Plan 1 and adds LLM-driven entity extraction (Anthropic Haiku) plus vector embeddings (Voyage) for semantic recall. The server picks **either local SpacetimeDB or maincloud** based on env vars supplied by the installer (Plan 3).

**Architecture:**
- npm workspaces: `packages/spacetime-module`, `packages/dashboard`, `packages/mcp-server`. CLI added in Plan 3.
- Monorepo root keeps git, docs, README, plans.
- MCP server is a long-lived Node.js process speaking JSON-RPC over **stdio** (the standard for local AI hosts).
- It holds one persistent SpacetimeDB connection (auto-subscribes to all tables) and translates MCP tool calls → reducer calls + queries.
- Schema gains `memory_note.embedding`, `entity.embedding`, and a new `embedding_cache` table (deduplicates expensive embedding calls by content hash).
- Two-stage retrieval: (1) entity match (cheap, indexed); (2) vector re-rank on the candidate set (cheap because the candidate set is small).
- LLM extraction is **opt-in**. With no Anthropic key, agents pass entities manually. With no Voyage key, recall falls back to entity-only.
- Reducer calls don't return data — we use a `clientToken` field on inserts so the server can find its just-inserted row after the reducer completes.

**Tech Stack:** Node.js 20+, TypeScript, `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`, native `fetch` for Voyage, `vitest` for tests, `npm workspaces` (no pnpm/yarn dependency).

**Scope split note:** This plan does NOT cover:
- The `npx spacetimedb-memory-mmo init` installer (Plan 3 — depends on this plan being complete)
- npm package publishing (Plan 3)
- Multi-agent ACLs / temporal relations / PageRank (Plan 4)

---

## Prerequisites (do once, before Task 1)

- [ ] **P-1:** SpacetimeDB CLI installed (verified in Plan 1).
- [ ] **P-2:** Local `spacetime start` running (verified in Plan 1).
- [ ] **P-3:** **GitHub remote URL provided by user:** `https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git` — repo must be empty (no README/LICENSE/etc.).
- [ ] **P-4:** `gh` CLI available OR user is logged into GitHub via SSH/HTTPS (we'll detect at Task 1).
- [ ] **P-5:** API keys for testing (NOT committed):
  - `ANTHROPIC_API_KEY` (required for Tasks 6, 8, 10) — get from https://console.anthropic.com/
  - `VOYAGE_API_KEY` (required for Tasks 7, 8, 10) — get from https://dashboard.voyageai.com/
  - These go in the **monorepo root `.env`** (gitignored) for now; the installer will eventually write them per-project.

---

## File structure (post-restructure)

```
my-spacetime-app/                   # repo root, will rename to spacetimedb-memory-mmo in Plan 3
├── package.json                    # workspaces: ["packages/*"], scripts that delegate to packages
├── README.md
├── LICENSE                         # already present, kept
├── .env                            # gitignored — keys for local dev only
├── .gitignore
├── docs/superpowers/plans/         # plan history
├── packages/
│   ├── spacetime-module/           # was: my-spacetime-app/spacetimedb/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── schema.ts           # extended with embeddings + embedding_cache
│   │       └── index.ts            # extended reducers
│   ├── dashboard/                  # was: most of my-spacetime-app/src/ + vite/vitest configs
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.node.json
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   ├── index.html
│   │   ├── public/
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── App.css
│   │       ├── main.tsx
│   │       ├── App.integration.test.tsx
│   │       ├── components/
│   │       ├── lib/
│   │       └── module_bindings/
│   └── mcp-server/                 # NEW
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       └── src/
│           ├── index.ts            # entry: starts MCP server over stdio
│           ├── connection.ts       # SpacetimeDB connection management
│           ├── embeddings.ts       # Voyage client + cache
│           ├── extraction.ts       # Anthropic client for entity extraction
│           ├── tools/
│           │   ├── remember.ts
│           │   ├── recall.ts
│           │   ├── forget.ts
│           │   ├── list_entities.ts
│           │   ├── list_recent.ts
│           │   ├── tag.ts
│           │   └── untag.ts
│           └── tests/
│               ├── remember.test.ts
│               ├── recall.test.ts
│               └── ...
└── spacetime.json                  # update --module-path target after restructure
```

**Decomposition rationale:**
- One file per MCP tool keeps each small (50-150 lines) so individual edits are tractable.
- `connection.ts` / `embeddings.ts` / `extraction.ts` are the cross-cutting concerns; isolating them lets us test tools in isolation.
- Dashboard moves wholesale rather than being deleted, because it remains useful as a debugging UI for inspecting what the MCP server has stored.

**Don't touch:**
- `LICENSE`, `CHANGELOG.md` — kept as-is.
- The maincloud database `my-spacetime-app-b9ogh` — left with the v1 schema until the user explicitly chooses to publish there from the new module path.

---

## Dev cycle reminder

After any schema change, from the monorepo root:

```bash
spacetime publish compound-memory-dev --module-path packages/spacetime-module --server local --clear-database -y
spacetime generate --lang typescript --out-dir packages/dashboard/src/module_bindings --module-path packages/spacetime-module
spacetime generate --lang typescript --out-dir packages/mcp-server/src/module_bindings --module-path packages/spacetime-module
```

After any MCP server code change: `npm run build --workspace mcp-server` and re-run tests.

---

## Task 1 — GitHub remote + push existing v1 work

**Files:**
- Modify: `my-spacetime-app/README.md` (add repo URL hint at top)

**Goal:** Connect local repo to GitHub and push the 11 existing commits so any subsequent work is backed up. No code changes.

- [ ] **Step 1.1: Add the GitHub remote.**

Run from `my-spacetime-app/`:

```bash
git remote add origin https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git
git remote -v
```

Expected: `origin` listed for fetch + push.

- [ ] **Step 1.2: Verify the remote is reachable and empty.**

```bash
git ls-remote origin 2>&1
```

Expected: empty output (no refs) for a fresh empty repo, OR a single `HEAD` ref pointing at no commits. If non-empty (you have an existing repo with commits), STOP — we need to align histories before continuing; ask the user.

- [ ] **Step 1.3: Push `main`.**

```bash
git push -u origin main
```

Expected: `Branch 'main' set up to track 'origin/main'`. If this prompts for credentials, the user needs to authenticate (HTTPS token, SSH key, or `gh auth login`).

- [ ] **Step 1.4: Confirm on GitHub.**

```bash
git ls-remote origin main
```

Expected: prints a SHA matching `git rev-parse HEAD`.

- [ ] **Step 1.5: No commit needed (no source changes). Move on.**

---

## Task 2 — Restructure to npm workspaces monorepo

**Files (full reorganization — git mv preserves history):**

| Source path | Destination path |
|---|---|
| `spacetimedb/` (whole dir) | `packages/spacetime-module/` |
| `src/App.tsx` | `packages/dashboard/src/App.tsx` |
| `src/App.css` | `packages/dashboard/src/App.css` |
| `src/main.tsx` | `packages/dashboard/src/main.tsx` |
| `src/index.css` | `packages/dashboard/src/index.css` |
| `src/App.integration.test.tsx` | `packages/dashboard/src/App.integration.test.tsx` |
| `src/setupTests.ts` | `packages/dashboard/src/setupTests.ts` |
| `src/components/` | `packages/dashboard/src/components/` |
| `src/lib/` | `packages/dashboard/src/lib/` |
| `src/module_bindings/` | `packages/dashboard/src/module_bindings/` |
| `src/assets/` | `packages/dashboard/src/assets/` |
| `src/.gitattributes` | `packages/dashboard/src/.gitattributes` |
| `index.html` | `packages/dashboard/index.html` |
| `public/` | `packages/dashboard/public/` |
| `vite.config.ts` | `packages/dashboard/vite.config.ts` |
| `vitest.config.ts` | `packages/dashboard/vitest.config.ts` |
| `tsconfig.app.json` | `packages/dashboard/tsconfig.app.json` |
| `tsconfig.node.json` | `packages/dashboard/tsconfig.node.json` |
| `tsconfig.json` | `packages/dashboard/tsconfig.json` |
| `eslint.config.js` (if exists) | `packages/dashboard/eslint.config.js` |

**Modify (in place at root):**
- `my-spacetime-app/package.json` — convert to workspace root
- `my-spacetime-app/spacetime.json` — update module-path

**Goal:** All previous functionality still works after the move. Tests still pass against local SpacetimeDB.

- [ ] **Step 2.1: Move `spacetimedb/` to `packages/spacetime-module/`.**

```bash
mkdir -p packages
git mv spacetimedb packages/spacetime-module
```

- [ ] **Step 2.2: Move dashboard files.**

```bash
mkdir -p packages/dashboard
git mv src packages/dashboard/src
git mv index.html packages/dashboard/index.html
git mv public packages/dashboard/public
git mv vite.config.ts packages/dashboard/vite.config.ts
git mv vitest.config.ts packages/dashboard/vitest.config.ts
git mv tsconfig.app.json packages/dashboard/tsconfig.app.json
git mv tsconfig.node.json packages/dashboard/tsconfig.node.json
git mv tsconfig.json packages/dashboard/tsconfig.json
# eslint.config.js is optional — only run if it exists
[ -f eslint.config.js ] && git mv eslint.config.js packages/dashboard/eslint.config.js || echo "no eslint config to move"
```

- [ ] **Step 2.3: Create `packages/dashboard/package.json` (the dashboard workspace).**

Move all the dashboard dependencies from the existing root `package.json` into a new package-level file. Replace `packages/dashboard/package.json` with:

```json
{
  "name": "@spacetimedb-memory-mmo/dashboard",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "spacetime:generate": "spacetime generate --lang typescript --out-dir src/module_bindings --module-path ../spacetime-module"
  },
  "dependencies": {
    "spacetimedb": "^2.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^5.0.2",
    "jsdom": "^26.0.0",
    "typescript": "~5.6.2",
    "vite": "^7.1.5",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 2.4: Replace root `package.json` with the workspace root.**

Replace the entire root `package.json` with:

```json
{
  "name": "spacetimedb-memory-mmo-monorepo",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace @spacetimedb-memory-mmo/dashboard",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "spacetime:publish:local": "spacetime publish compound-memory-dev --module-path packages/spacetime-module --server local --clear-database -y",
    "spacetime:generate:dashboard": "spacetime generate --lang typescript --out-dir packages/dashboard/src/module_bindings --module-path packages/spacetime-module",
    "spacetime:generate:mcp": "spacetime generate --lang typescript --out-dir packages/mcp-server/src/module_bindings --module-path packages/spacetime-module",
    "spacetime:generate": "npm run spacetime:generate:dashboard && npm run spacetime:generate:mcp"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "globals": "^15.14.0",
    "prettier": "^3.3.3",
    "typescript-eslint": "^8.18.2"
  }
}
```

> **Note:** Eslint and prettier stay at the root since they're cross-package concerns. TypeScript itself moves to package-level (different versions per package are fine).

- [ ] **Step 2.5: Update `spacetime.json` to point at the new module path.**

Read existing `spacetime.json`, then update the `module-path` field from `./spacetimedb` to `./packages/spacetime-module`. Other fields untouched.

- [ ] **Step 2.6: Update `packages/spacetime-module/package.json` name and scripts.**

Replace the entire file with:

```json
{
  "name": "@spacetimedb-memory-mmo/spacetime-module",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "publish:local": "spacetime publish compound-memory-dev --module-path . --server local --clear-database -y",
    "generate:dashboard": "spacetime generate --lang typescript --out-dir ../dashboard/src/module_bindings --module-path .",
    "generate:mcp": "spacetime generate --lang typescript --out-dir ../mcp-server/src/module_bindings --module-path ."
  },
  "dependencies": {
    "spacetimedb": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2.7: Reinstall to register workspaces.**

From repo root:

```bash
rm -rf node_modules package-lock.json packages/*/node_modules
npm install
```

Expected: npm prints "added X packages" and creates `node_modules/` at the root with hoisted deps + per-workspace `node_modules/` symlinks.

- [ ] **Step 2.8: Re-publish module from new path + regenerate dashboard bindings.**

```bash
npm run spacetime:publish:local
npm run spacetime:generate:dashboard
```

Expected: both succeed.

- [ ] **Step 2.9: Verify dashboard still builds + tests still pass.**

```bash
npm run build --workspace @spacetimedb-memory-mmo/dashboard
npm run test --workspace @spacetimedb-memory-mmo/dashboard
```

Expected: build clean, 6/6 tests pass (5 unit + 1 integration). If the integration test fails because of a path issue with `module_bindings`, the most likely culprit is a stale `vite.config.ts` or `vitest.config.ts` reference — investigate and fix before proceeding.

- [ ] **Step 2.10: Commit + push.**

```bash
git add -A
git commit -m "refactor: convert to npm workspaces monorepo"
git push
```

---

## Task 3 — Add embedding columns + `embedding_cache` table

**Files:**
- Modify: `packages/spacetime-module/src/schema.ts`
- Modify: `packages/spacetime-module/src/index.ts` (add internal helper for embedding upserts)

**Goal:** Schema is ready to store vectors. No retrieval logic yet — that arrives with the MCP server tools.

> **Vector storage decision:** SpacetimeDB 2.2 supports `t.array(t.f32())` for column types. We'll use that for embeddings. If publish fails with a type error, the **fallback** is `t.string()` storing JSON — make that change inline in this task and continue. Embeddings up to ~1536 floats = ~6KB serialized; SpacetimeDB handles it fine either way.

- [ ] **Step 3.1: Add `embedding` (optional) to `memory_note` and `entity`.**

Edit `packages/spacetime-module/src/schema.ts`. Update the `memoryNote` definition's columns object to add:

```typescript
    embedding: t.array(t.f32()).optional(),
```

(Place after `updatedAt`.)

Update the `entity` definition similarly to add the same column after `createdAt`:

```typescript
    embedding: t.array(t.f32()).optional(),
```

- [ ] **Step 3.2: Add `embedding_cache` table to schema.ts.**

Append to `packages/spacetime-module/src/schema.ts`, before the final `schema(...)` call:

```typescript
export const embeddingCache = table(
  { name: 'embedding_cache', public: true },
  {
    contentHash: t.string().primaryKey(),
    embedding: t.array(t.f32()),
    model: t.string(),
    createdAt: t.timestamp(),
  }
);
```

Update the schema export to include it:

```typescript
const spacetimedb = schema({ agent, memoryNote, entity, noteEntity, embeddingCache });
```

- [ ] **Step 3.3: Add `clientToken` to `memory_note` (optional) for caller-side correlation.**

The MCP server needs to find the row it just inserted. Add to the `memoryNote` columns object:

```typescript
    clientToken: t.string().optional(),
```

Place after `embedding`. Add an index for fast lookup. Update the `memoryNote` indexes array to:

```typescript
    indexes: [
      { accessor: 'addedBy', algorithm: 'btree', columns: ['addedBy'] },
      { accessor: 'clientToken', algorithm: 'btree', columns: ['clientToken'] },
    ],
```

- [ ] **Step 3.4: Update reducers to accept + use the new fields.**

In `packages/spacetime-module/src/index.ts`, update `add_memory_with_entities` to take an optional `clientToken` and `embedding`. Replace the existing reducer with:

```typescript
export const add_memory_with_entities = spacetimedb.reducer(
  {
    content: t.string(),
    entityNames: t.array(t.string()),
    embedding: t.array(t.f32()).optional(),
    clientToken: t.string().optional(),
  },
  (ctx, { content, entityNames, embedding, clientToken }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    const note = ctx.db.memoryNote.insert({
      id: 0n,
      content: trimmed,
      addedBy: ctx.sender,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
      embedding,
      clientToken,
    });
    const seen = new Set<string>();
    for (const raw of entityNames) {
      const norm = raw.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      const entityId = findOrCreateEntity(ctx, norm);
      ctx.db.noteEntity.insert({ id: 0n, noteId: note.id, entityId });
    }
  }
);
```

Also update the simpler `add_memory` reducer to set `embedding: undefined, clientToken: undefined`:

```typescript
export const add_memory = spacetimedb.reducer(
  { content: t.string() },
  (ctx, { content }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    ctx.db.memoryNote.insert({
      id: 0n,
      content: trimmed,
      addedBy: ctx.sender,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
      embedding: undefined,
      clientToken: undefined,
    });
  }
);
```

- [ ] **Step 3.5: Add reducers for the embedding lifecycle.**

Append to `packages/spacetime-module/src/index.ts`:

```typescript
export const set_memory_embedding = spacetimedb.reducer(
  { noteId: t.u64(), embedding: t.array(t.f32()) },
  (ctx, { noteId, embedding }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot embed another agent's memory");
    }
    ctx.db.memoryNote.id.update({ ...existing, embedding, updatedAt: ctx.timestamp });
  }
);

export const set_entity_embedding = spacetimedb.reducer(
  { entityId: t.u64(), embedding: t.array(t.f32()) },
  (ctx, { entityId, embedding }) => {
    const existing = ctx.db.entity.id.find(entityId);
    if (!existing) throw new SenderError('Entity not found');
    ctx.db.entity.id.update({ ...existing, embedding });
  }
);

export const cache_embedding = spacetimedb.reducer(
  { contentHash: t.string(), embedding: t.array(t.f32()), model: t.string() },
  (ctx, { contentHash, embedding, model }) => {
    const existing = ctx.db.embeddingCache.contentHash.find(contentHash);
    if (existing) return; // idempotent
    ctx.db.embeddingCache.insert({
      contentHash,
      embedding,
      model,
      createdAt: ctx.timestamp,
    });
  }
);
```

- [ ] **Step 3.6: Re-publish + regenerate.**

```bash
npm run spacetime:publish:local
npm run spacetime:generate:dashboard
```

Expected: both succeed. If `spacetime publish` errors with `t.array(t.f32())` not being a valid column type, swap to JSON-strings:
- Change `embedding: t.array(t.f32()).optional()` to `embedding: t.string().optional()` in `memoryNote` and `entity`.
- Change `embedding: t.array(t.f32())` to `embedding: t.string()` in `embeddingCache`.
- Update reducers similarly (they take/store JSON strings).
- Re-publish, re-generate. Note the change in the commit message.

- [ ] **Step 3.7: Verify dashboard still builds + tests still pass.**

```bash
npm run build --workspace @spacetimedb-memory-mmo/dashboard
npm run test --workspace @spacetimedb-memory-mmo/dashboard
```

Expected: 6/6 pass. Dashboard ignores embedding fields entirely; the new optional columns shouldn't break anything.

- [ ] **Step 3.8: Commit + push.**

```bash
git add -A
git commit -m "feat(schema): add embedding columns + embedding_cache table + clientToken"
git push
```

---

## Task 4 — `mcp-server` skeleton + connection bootstrap

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/src/connection.ts`
- Create: `packages/mcp-server/src/env.ts`
- Create: `packages/mcp-server/README.md`

**Goal:** A runnable MCP server that connects to SpacetimeDB and registers zero tools. Verifies the plumbing works.

- [ ] **Step 4.1: Create `packages/mcp-server/package.json`.**

```json
{
  "name": "@spacetimedb-memory-mmo/mcp-server",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "spacetimedb-memory-mmo-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "spacetimedb": "^2.2.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.10",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 4.2: Create `packages/mcp-server/tsconfig.json`.**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 4.3: Create `packages/mcp-server/src/env.ts`.**

```typescript
export interface Env {
  spacetimedbHost: string;
  spacetimedbDbName: string;
  spacetimedbToken: string | undefined;
  anthropicApiKey: string | undefined;
  voyageApiKey: string | undefined;
  embeddingModel: string;
}

export function loadEnv(): Env {
  const host = process.env.SPACETIMEDB_HOST;
  const db = process.env.SPACETIMEDB_DB_NAME;
  if (!host) throw new Error('SPACETIMEDB_HOST not set (e.g. ws://localhost:3000 or wss://maincloud.spacetimedb.com)');
  if (!db) throw new Error('SPACETIMEDB_DB_NAME not set');
  return {
    spacetimedbHost: host,
    spacetimedbDbName: db,
    spacetimedbToken: process.env.SPACETIMEDB_TOKEN,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    voyageApiKey: process.env.VOYAGE_API_KEY,
    embeddingModel: process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-lite',
  };
}
```

- [ ] **Step 4.4: Generate MCP-server bindings against the spacetime module.**

```bash
npm run spacetime:generate:mcp
```

Expected: `packages/mcp-server/src/module_bindings/` populated.

- [ ] **Step 4.5: Create `packages/mcp-server/src/connection.ts`.**

```typescript
import { DbConnection } from './module_bindings/index.js';
import type { Env } from './env.js';

export type Conn = InstanceType<typeof DbConnection>;

export async function connectToSpacetime(env: Env): Promise<Conn> {
  return await new Promise<Conn>((resolve, reject) => {
    const builder = DbConnection.builder()
      .withUri(env.spacetimedbHost)
      .withDatabaseName(env.spacetimedbDbName)
      .withToken(env.spacetimedbToken)
      .onConnect((conn, _identity, _token) => {
        conn.subscriptionBuilder().subscribeToAllTables();
        resolve(conn);
      })
      .onConnectError((_ctx, err) => reject(err));
    builder.build();
  });
}
```

> **Note:** The `.build()` method might be named `.connect()` or similar in the non-React SDK. If TypeScript complains, check the generated `DbConnection.builder()` chain in `module_bindings/index.ts` and adjust. The auto-generated `DbConnectionBuilder extends __DbConnectionBuilder<DbConnection>` — the parent class's terminating method is the one to call.

- [ ] **Step 4.6: Create `packages/mcp-server/src/index.ts` (entry point).**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadEnv } from './env.js';
import { connectToSpacetime } from './connection.js';

async function main() {
  const env = loadEnv();
  const conn = await connectToSpacetime(env);
  process.stderr.write(`[mcp-server] Connected to SpacetimeDB at ${env.spacetimedbHost}/${env.spacetimedbDbName}\n`);

  const server = new Server(
    { name: 'spacetimedb-memory-mmo', version: '0.0.1' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[mcp-server] Listening on stdio\n`);

  // Keep alive — MCP transport handles the lifecycle
  void conn;
}

main().catch((err) => {
  process.stderr.write(`[mcp-server] FATAL: ${err.stack ?? err}\n`);
  process.exit(1);
});
```

- [ ] **Step 4.7: Create `packages/mcp-server/README.md`.**

```markdown
# @spacetimedb-memory-mmo/mcp-server

MCP server that bridges AI agents (Claude Code, Cursor, custom) to a
compound-memory SpacetimeDB module.

## Env vars

| Var | Required | Default | Notes |
|---|---|---|---|
| `SPACETIMEDB_HOST` | yes | — | `ws://localhost:3000` or `wss://maincloud.spacetimedb.com` |
| `SPACETIMEDB_DB_NAME` | yes | — | Module identifier |
| `SPACETIMEDB_TOKEN` | no | — | Stored token from prior connection (recommended for stable identity) |
| `ANTHROPIC_API_KEY` | no | — | Enables LLM entity extraction in `remember` |
| `VOYAGE_API_KEY` | no | — | Enables embeddings + vector recall |
| `VOYAGE_EMBEDDING_MODEL` | no | `voyage-3-lite` | Voyage embedding model |

If `ANTHROPIC_API_KEY` is unset, `remember` requires explicit `entities`.
If `VOYAGE_API_KEY` is unset, `recall` falls back to entity-only.

## Run

```bash
SPACETIMEDB_HOST=ws://localhost:3000 \
SPACETIMEDB_DB_NAME=compound-memory-dev \
npm run dev
```

## Tools (added in subsequent tasks)

- `memory.remember`
- `memory.recall`
- `memory.forget`
- `memory.list_entities`
- `memory.list_recent`
- `memory.tag`
- `memory.untag`
```

- [ ] **Step 4.8: Install workspace deps + build.**

From repo root:

```bash
npm install
npm run build --workspace @spacetimedb-memory-mmo/mcp-server
```

Expected: build succeeds, `packages/mcp-server/dist/` populated.

- [ ] **Step 4.9: Smoke-test the MCP server starts.**

Set up a `.env` at the repo root (gitignored). Add:

```
SPACETIMEDB_HOST=ws://localhost:3000
SPACETIMEDB_DB_NAME=compound-memory-dev
```

Run:

```bash
( cd packages/mcp-server && npx --node-options="--env-file=../../.env" tsx src/index.ts ) </dev/null
```

Expected: `[mcp-server] Connected to SpacetimeDB at ws://localhost:3000/compound-memory-dev` + `[mcp-server] Listening on stdio` to stderr, then process waits for stdin (closes immediately because we redirected `</dev/null`). Exit code 0 (or 143/SIGPIPE — both fine).

If this hangs or errors, the connection bootstrap is wrong — fix before proceeding.

- [ ] **Step 4.10: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): MCP server skeleton with SpacetimeDB connection"
git push
```

---

## Task 5 — `memory.remember` tool (no LLM/embeddings yet)

**Files:**
- Create: `packages/mcp-server/src/tools/remember.ts`
- Modify: `packages/mcp-server/src/index.ts` (register the tool)

**Goal:** AI agent can call `memory.remember({ content, entities? })` and the row appears in SpacetimeDB. No extraction, no embeddings — those layer in Tasks 6–7.

- [ ] **Step 5.1: Create `packages/mcp-server/src/tools/remember.ts`.**

```typescript
import type { Conn } from '../connection.js';
import { randomUUID } from 'crypto';

export const REMEMBER_TOOL = {
  name: 'memory.remember',
  description:
    'Save a new memory note. Optional `entities` are tagged on the note. ' +
    'Returns the new note id once persisted.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', minLength: 1 },
      entities: {
        type: 'array',
        items: { type: 'string' },
        default: [],
      },
    },
    required: ['content'],
  },
} as const;

export async function remember(
  conn: Conn,
  args: { content: string; entities?: string[] }
): Promise<{ noteId: string; clientToken: string }> {
  const clientToken = randomUUID();
  const entities = args.entities ?? [];

  await conn.reducers.addMemoryWithEntities({
    content: args.content,
    entityNames: entities,
    embedding: undefined,
    clientToken,
  });

  // Find the just-inserted row by clientToken
  const tables = (conn as unknown as { db: { memoryNote: { iter: () => Iterable<{ id: bigint; clientToken?: string }> } } }).db;
  for (const row of tables.memoryNote.iter()) {
    if (row.clientToken === clientToken) {
      return { noteId: row.id.toString(), clientToken };
    }
  }
  throw new Error('Note not found after insert (subscription not synced?)');
}
```

> **Note on `conn.db` typing:** The non-React SpacetimeDB SDK exposes table iteration through the connection — the exact shape is determined by the generated bindings. The cast above sidesteps fragile typing; if the actual binding exposes `conn.db.memoryNote` directly with full types, drop the cast and use it. Verify by reading `packages/mcp-server/src/module_bindings/index.ts` for the connection's `db` field shape.

- [ ] **Step 5.2: Wire the tool into `packages/mcp-server/src/index.ts`.**

Replace the `setRequestHandler` calls in `index.ts` with:

```typescript
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [REMEMBER_TOOL] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      switch (name) {
        case 'memory.remember': {
          const result = await remember(conn, args as { content: string; entities?: string[] });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });
```

Add the import at the top of `index.ts`:

```typescript
import { REMEMBER_TOOL, remember } from './tools/remember.js';
```

- [ ] **Step 5.3: Build + ad-hoc test.**

```bash
npm run build --workspace @spacetimedb-memory-mmo/mcp-server
```

Then craft a one-shot MCP request via stdin to verify the tool works:

```bash
( cd packages/mcp-server && \
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: a JSON line containing `"name":"memory.remember"` is written to stdout.

Then a remember call:

```bash
( cd packages/mcp-server && \
  printf '%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory.remember","arguments":{"content":"Plan 2 task 5 smoke","entities":["plan2","smoke"]}}}' \
  | npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: response JSON contains `noteId` like `"noteId":"7"` (or whatever the next id is).

- [ ] **Step 5.4: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): memory.remember tool"
git push
```

---

## Task 6 — Anthropic-driven entity extraction in `remember`

**Files:**
- Create: `packages/mcp-server/src/extraction.ts`
- Modify: `packages/mcp-server/src/tools/remember.ts`

**Goal:** When a user calls `memory.remember({ content })` with no `entities`, the server calls Anthropic Haiku 4.5 to extract entity names automatically. Cost: ~$0.0001 per memory.

- [ ] **Step 6.1: Create `packages/mcp-server/src/extraction.ts`.**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You extract canonical entity names from short user-supplied facts.

Rules:
- Extract people, projects, organizations, products, places, key concepts
- Lowercase, no spaces around (use kebab-case for multi-word: "project-x")
- Skip pronouns, dates, generic words
- Return at most 6 entities
- If the fact has no clear entities, return an empty array`;

export async function extractEntities(
  apiKey: string,
  content: string
): Promise<string[]> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    tools: [
      {
        name: 'record_entities',
        description: 'Record the canonical entities extracted from the fact.',
        input_schema: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 6,
            },
          },
          required: ['entities'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_entities' },
  });

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'record_entities') {
      const input = block.input as { entities?: unknown };
      if (Array.isArray(input.entities)) {
        return input.entities
          .filter((x): x is string => typeof x === 'string')
          .map(x => x.trim().toLowerCase())
          .filter(Boolean);
      }
    }
  }
  return [];
}
```

- [ ] **Step 6.2: Update `remember.ts` to call extraction when entities not provided.**

Replace the body of `remember()`:

```typescript
export async function remember(
  conn: Conn,
  args: { content: string; entities?: string[] },
  env: Env
): Promise<{ noteId: string; clientToken: string; extractedEntities?: string[] }> {
  const clientToken = randomUUID();
  let entities = args.entities;
  let extractedEntities: string[] | undefined;

  if (!entities && env.anthropicApiKey) {
    extractedEntities = await extractEntities(env.anthropicApiKey, args.content);
    entities = extractedEntities;
  }

  await conn.reducers.addMemoryWithEntities({
    content: args.content,
    entityNames: entities ?? [],
    embedding: undefined,
    clientToken,
  });

  const tables = (conn as unknown as { db: { memoryNote: { iter: () => Iterable<{ id: bigint; clientToken?: string }> } } }).db;
  for (const row of tables.memoryNote.iter()) {
    if (row.clientToken === clientToken) {
      return { noteId: row.id.toString(), clientToken, extractedEntities };
    }
  }
  throw new Error('Note not found after insert (subscription not synced?)');
}
```

Update imports at the top:

```typescript
import { extractEntities } from '../extraction.js';
import type { Env } from '../env.js';
```

- [ ] **Step 6.3: Wire `env` through to `remember` in `index.ts`.**

Update the call site in `index.ts`:

```typescript
        case 'memory.remember': {
          const result = await remember(conn, args as { content: string; entities?: string[] }, env);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
```

- [ ] **Step 6.4: Test extraction works.**

With `ANTHROPIC_API_KEY` set in `.env`:

```bash
( cd packages/mcp-server && \
  printf '%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory.remember","arguments":{"content":"Alice mentioned the project deadline is May 15."}}}' \
  | npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: response includes `"extractedEntities"` with at least `["alice"]` and possibly `["alice","project","deadline"]`. Verify in the SpacetimeDB dashboard or via the React app: a new memory exists with those tags.

- [ ] **Step 6.5: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): Anthropic Haiku entity extraction in remember"
git push
```

---

## Task 7 — Voyage embeddings with cache lookup

**Files:**
- Create: `packages/mcp-server/src/embeddings.ts`
- Modify: `packages/mcp-server/src/tools/remember.ts` (compute + store embedding on insert)

**Goal:** Each new memory gets an embedding from Voyage. Embeddings are cached by SHA-256 of content so identical content is never re-embedded.

- [ ] **Step 7.1: Create `packages/mcp-server/src/embeddings.ts`.**

```typescript
import { createHash } from 'crypto';
import type { Conn } from './connection.js';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function fetchVoyageEmbedding(
  apiKey: string,
  model: string,
  content: string
): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: content, model }),
  });
  if (!response.ok) {
    throw new Error(`Voyage API error ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
  if (!json.data?.[0]?.embedding) throw new Error('Voyage response missing embedding');
  return json.data[0].embedding;
}

/** Get-or-fetch-or-cache. Returns null if no API key. */
export async function getEmbedding(
  conn: Conn,
  apiKey: string | undefined,
  model: string,
  content: string
): Promise<number[] | null> {
  if (!apiKey) return null;

  const hash = hashContent(content);
  const cache = (conn as unknown as {
    db: { embeddingCache: { contentHash: { find: (h: string) => { embedding: number[] } | undefined } } }
  }).db;
  const cached = cache.embeddingCache.contentHash.find(hash);
  if (cached) return cached.embedding;

  const embedding = await fetchVoyageEmbedding(apiKey, model, content);
  await conn.reducers.cacheEmbedding({ contentHash: hash, embedding, model });
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
```

- [ ] **Step 7.2: Update `remember.ts` to embed on insert.**

Replace the body of `remember()`:

```typescript
export async function remember(
  conn: Conn,
  args: { content: string; entities?: string[] },
  env: Env
): Promise<{ noteId: string; clientToken: string; extractedEntities?: string[]; embedded: boolean }> {
  const clientToken = randomUUID();
  let entities = args.entities;
  let extractedEntities: string[] | undefined;

  if (!entities && env.anthropicApiKey) {
    extractedEntities = await extractEntities(env.anthropicApiKey, args.content);
    entities = extractedEntities;
  }

  const embedding = await getEmbedding(conn, env.voyageApiKey, env.embeddingModel, args.content);

  await conn.reducers.addMemoryWithEntities({
    content: args.content,
    entityNames: entities ?? [],
    embedding: embedding ?? undefined,
    clientToken,
  });

  const tables = (conn as unknown as { db: { memoryNote: { iter: () => Iterable<{ id: bigint; clientToken?: string }> } } }).db;
  for (const row of tables.memoryNote.iter()) {
    if (row.clientToken === clientToken) {
      return {
        noteId: row.id.toString(),
        clientToken,
        extractedEntities,
        embedded: embedding !== null,
      };
    }
  }
  throw new Error('Note not found after insert');
}
```

Update imports:

```typescript
import { getEmbedding } from '../embeddings.js';
```

- [ ] **Step 7.3: Test embedding flow.**

```bash
( cd packages/mcp-server && \
  printf '%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory.remember","arguments":{"content":"Voyage embedding test memory"}}}' \
  | npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: `"embedded":true`. Calling the same content again should hit the cache (verify by checking `embedding_cache` has only one row for the hash, e.g. via the dashboard).

- [ ] **Step 7.4: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): Voyage embeddings with content-hash cache"
git push
```

---

## Task 8 — `memory.recall` tool

**Files:**
- Create: `packages/mcp-server/src/tools/recall.ts`
- Modify: `packages/mcp-server/src/index.ts`

**Goal:** Two-stage retrieval. (1) If query has explicit entity, find notes linked to that entity. (2) Otherwise (or to expand), embed the query and rank all candidates by cosine similarity. Returns top K.

- [ ] **Step 8.1: Create `packages/mcp-server/src/tools/recall.ts`.**

```typescript
import type { Conn } from '../connection.js';
import type { Env } from '../env.js';
import { getEmbedding, cosineSimilarity } from '../embeddings.js';

export const RECALL_TOOL = {
  name: 'memory.recall',
  description:
    'Recall memories matching a query. Two-stage retrieval: entity match first ' +
    '(if `entity` provided), then vector similarity rank on the candidate set. ' +
    'Returns top `k` notes with their tags.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 1 },
      k: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
      entity: { type: 'string', description: 'Optional: restrict to notes tagged with this entity' },
    },
    required: ['query'],
  },
} as const;

interface NoteOut {
  id: string;
  content: string;
  entities: string[];
  similarity: number | null;
  createdAt: string;
}

export async function recall(
  conn: Conn,
  args: { query: string; k?: number; entity?: string },
  env: Env
): Promise<{ notes: NoteOut[] }> {
  const k = args.k ?? 5;
  const tables = (conn as unknown as {
    db: {
      memoryNote: { iter: () => Iterable<{ id: bigint; content: string; createdAt: { microsSinceUnixEpoch: bigint }; embedding?: number[] }> };
      entity: { iter: () => Iterable<{ id: bigint; name: string }>; name: { find: (name: string) => { id: bigint } | undefined } };
      noteEntity: { iter: () => Iterable<{ noteId: bigint; entityId: bigint }> };
    };
  }).db;

  const allNotes = [...tables.memoryNote.iter()];
  const allEntities = [...tables.entity.iter()];
  const allLinks = [...tables.noteEntity.iter()];

  let candidates = allNotes;
  if (args.entity) {
    const ent = tables.entity.name.find(args.entity.trim().toLowerCase());
    if (!ent) return { notes: [] };
    const noteIds = new Set(
      allLinks.filter(l => l.entityId === ent.id).map(l => l.noteId.toString())
    );
    candidates = allNotes.filter(n => noteIds.has(n.id.toString()));
  }

  // Vector ranking if we have embeddings + Voyage key
  const queryEmbedding = await getEmbedding(conn, env.voyageApiKey, env.embeddingModel, args.query);

  const ranked = candidates.map(n => {
    let sim: number | null = null;
    if (queryEmbedding && n.embedding) sim = cosineSimilarity(queryEmbedding, n.embedding);
    return { note: n, sim };
  });

  // Sort: similarity desc (with nulls last), then createdAt desc
  ranked.sort((a, b) => {
    if (a.sim !== null && b.sim !== null) return b.sim - a.sim;
    if (a.sim !== null) return -1;
    if (b.sim !== null) return 1;
    return Number(b.note.createdAt.microsSinceUnixEpoch - a.note.createdAt.microsSinceUnixEpoch);
  });

  const top = ranked.slice(0, k);

  // Collect entities per note for the output
  const entityById = new Map(allEntities.map(e => [e.id.toString(), e.name]));
  const linksByNote = new Map<string, string[]>();
  for (const link of allLinks) {
    const k2 = link.noteId.toString();
    const name = entityById.get(link.entityId.toString());
    if (!name) continue;
    if (!linksByNote.has(k2)) linksByNote.set(k2, []);
    linksByNote.get(k2)!.push(name);
  }

  return {
    notes: top.map(({ note, sim }) => ({
      id: note.id.toString(),
      content: note.content,
      entities: linksByNote.get(note.id.toString()) ?? [],
      similarity: sim,
      createdAt: new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n)).toISOString(),
    })),
  };
}
```

- [ ] **Step 8.2: Wire into `index.ts`.**

Add import:

```typescript
import { RECALL_TOOL, recall } from './tools/recall.js';
```

Add to the tools list:

```typescript
    return { tools: [REMEMBER_TOOL, RECALL_TOOL] };
```

Add case in switch:

```typescript
        case 'memory.recall': {
          const result = await recall(conn, args as { query: string; k?: number; entity?: string }, env);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
```

- [ ] **Step 8.3: Test recall.**

Insert a few diverse memories first (use `memory.remember` calls from Task 7), then:

```bash
( cd packages/mcp-server && \
  printf '%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory.recall","arguments":{"query":"deadline","k":3}}}' \
  | npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: top 3 notes by similarity to "deadline". The memory about the project deadline should rank #1 if Voyage was used; otherwise it should at least appear in results (sorted by recency).

- [ ] **Step 8.4: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): memory.recall with two-stage retrieval"
git push
```

---

## Task 9 — Remaining tools: `forget`, `list_entities`, `list_recent`, `tag`, `untag`

**Files:**
- Create: `packages/mcp-server/src/tools/forget.ts`
- Create: `packages/mcp-server/src/tools/list_entities.ts`
- Create: `packages/mcp-server/src/tools/list_recent.ts`
- Create: `packages/mcp-server/src/tools/tag.ts`
- Create: `packages/mcp-server/src/tools/untag.ts`
- Modify: `packages/mcp-server/src/index.ts` (register all five)

**Goal:** Complete the MCP tool surface. All five are thin wrappers over reducers + queries.

- [ ] **Step 9.1: Create `packages/mcp-server/src/tools/forget.ts`.**

```typescript
import type { Conn } from '../connection.js';

export const FORGET_TOOL = {
  name: 'memory.forget',
  description: 'Delete one or more memory notes by id (only your own).',
  inputSchema: {
    type: 'object',
    properties: {
      noteIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['noteIds'],
  },
} as const;

export async function forget(
  conn: Conn,
  args: { noteIds: string[] }
): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const id of args.noteIds) {
    try {
      await conn.reducers.deleteMemory({ noteId: BigInt(id) });
      deleted++;
    } catch {
      // skip: not found, not owned, etc.
    }
  }
  return { deleted };
}
```

- [ ] **Step 9.2: Create `packages/mcp-server/src/tools/list_entities.ts`.**

```typescript
import type { Conn } from '../connection.js';

export const LIST_ENTITIES_TOOL = {
  name: 'memory.list_entities',
  description: 'List all entities with note counts.',
  inputSchema: { type: 'object', properties: {} },
} as const;

export async function listEntities(
  conn: Conn
): Promise<{ entities: { id: string; name: string; count: number }[] }> {
  const tables = (conn as unknown as {
    db: {
      entity: { iter: () => Iterable<{ id: bigint; name: string }> };
      noteEntity: { iter: () => Iterable<{ entityId: bigint }> };
    };
  }).db;

  const counts = new Map<string, number>();
  for (const link of tables.noteEntity.iter()) {
    const k = link.entityId.toString();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const entities = [...tables.entity.iter()].map(e => ({
    id: e.id.toString(),
    name: e.name,
    count: counts.get(e.id.toString()) ?? 0,
  }));
  entities.sort((a, b) => b.count - a.count);
  return { entities };
}
```

- [ ] **Step 9.3: Create `packages/mcp-server/src/tools/list_recent.ts`.**

```typescript
import type { Conn } from '../connection.js';

export const LIST_RECENT_TOOL = {
  name: 'memory.list_recent',
  description: 'List the K most recent memories.',
  inputSchema: {
    type: 'object',
    properties: { k: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  },
} as const;

export async function listRecent(
  conn: Conn,
  args: { k?: number }
): Promise<{ notes: { id: string; content: string; createdAt: string }[] }> {
  const k = args.k ?? 10;
  const tables = (conn as unknown as {
    db: { memoryNote: { iter: () => Iterable<{ id: bigint; content: string; createdAt: { microsSinceUnixEpoch: bigint } }> } };
  }).db;
  const notes = [...tables.memoryNote.iter()];
  notes.sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );
  return {
    notes: notes.slice(0, k).map(n => ({
      id: n.id.toString(),
      content: n.content,
      createdAt: new Date(Number(n.createdAt.microsSinceUnixEpoch / 1000n)).toISOString(),
    })),
  };
}
```

- [ ] **Step 9.4: Create `packages/mcp-server/src/tools/tag.ts`.**

```typescript
import type { Conn } from '../connection.js';

export const TAG_TOOL = {
  name: 'memory.tag',
  description: 'Add an entity tag to a memory you own.',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: { type: 'string' },
      entity: { type: 'string', minLength: 1 },
    },
    required: ['noteId', 'entity'],
  },
} as const;

export async function tag(
  conn: Conn,
  args: { noteId: string; entity: string }
): Promise<{ ok: true }> {
  await conn.reducers.tagMemory({ noteId: BigInt(args.noteId), entityName: args.entity });
  return { ok: true };
}
```

- [ ] **Step 9.5: Create `packages/mcp-server/src/tools/untag.ts`.**

```typescript
import type { Conn } from '../connection.js';

export const UNTAG_TOOL = {
  name: 'memory.untag',
  description: 'Remove an entity tag from a memory you own.',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: { type: 'string' },
      entityId: { type: 'string' },
    },
    required: ['noteId', 'entityId'],
  },
} as const;

export async function untag(
  conn: Conn,
  args: { noteId: string; entityId: string }
): Promise<{ ok: true }> {
  await conn.reducers.untagMemory({
    noteId: BigInt(args.noteId),
    entityId: BigInt(args.entityId),
  });
  return { ok: true };
}
```

- [ ] **Step 9.6: Wire all five into `index.ts`.**

Add imports:

```typescript
import { FORGET_TOOL, forget } from './tools/forget.js';
import { LIST_ENTITIES_TOOL, listEntities } from './tools/list_entities.js';
import { LIST_RECENT_TOOL, listRecent } from './tools/list_recent.js';
import { TAG_TOOL, tag } from './tools/tag.js';
import { UNTAG_TOOL, untag } from './tools/untag.js';
```

Update tools list:

```typescript
    return {
      tools: [
        REMEMBER_TOOL,
        RECALL_TOOL,
        FORGET_TOOL,
        LIST_ENTITIES_TOOL,
        LIST_RECENT_TOOL,
        TAG_TOOL,
        UNTAG_TOOL,
      ],
    };
```

Add cases to the switch:

```typescript
        case 'memory.forget': {
          const result = await forget(conn, args as { noteIds: string[] });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'memory.list_entities': {
          const result = await listEntities(conn);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'memory.list_recent': {
          const result = await listRecent(conn, args as { k?: number });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'memory.tag': {
          const result = await tag(conn, args as { noteId: string; entity: string });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'memory.untag': {
          const result = await untag(conn, args as { noteId: string; entityId: string });
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
```

- [ ] **Step 9.7: Build + smoke-test each tool.**

```bash
npm run build --workspace @spacetimedb-memory-mmo/mcp-server
```

For each new tool, run a one-shot test like Task 5/8 to verify a sane response. At minimum:

```bash
( cd packages/mcp-server && \
  echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"memory.list_recent","arguments":{"k":3}}}' \
  | npx --node-options="--env-file=../../.env" tsx src/index.ts )
```

Expected: returns the 3 most recent notes including ones you've added during this plan.

- [ ] **Step 9.8: Commit + push.**

```bash
git add -A
git commit -m "feat(mcp): forget, list_entities, list_recent, tag, untag tools"
git push
```

---

## Task 10 — Vitest tests for tool layer

**Files:**
- Create: `packages/mcp-server/src/tests/remember.test.ts`
- Create: `packages/mcp-server/src/tests/recall.test.ts`
- Create: `packages/mcp-server/src/tests/list_recent.test.ts`

**Goal:** Programmatic regression net for the tool layer. Tests connect to local SpacetimeDB and exercise the tools end-to-end. We don't unit-test extraction or embeddings (those depend on third-party APIs); we mock those by passing `entities` explicitly and accepting `embedded:false`.

- [ ] **Step 10.1: Configure vitest in `packages/mcp-server/package.json`.**

Add to the package.json:

```json
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
```

(Replace the existing `scripts` block.)

- [ ] **Step 10.2: Create `packages/mcp-server/src/tests/remember.test.ts`.**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectToSpacetime } from '../connection.js';
import { remember } from '../tools/remember.js';
import type { Conn } from '../connection.js';

const env = {
  spacetimedbHost: 'ws://localhost:3000',
  spacetimedbDbName: 'compound-memory-dev',
  spacetimedbToken: undefined,
  anthropicApiKey: undefined, // skip extraction
  voyageApiKey: undefined,    // skip embedding
  embeddingModel: 'voyage-3-lite',
};

let conn: Conn;

beforeAll(async () => {
  conn = await connectToSpacetime(env);
});

afterAll(async () => {
  // SpacetimeDB connection cleanup if needed
  void conn;
});

describe('memory.remember', () => {
  it('inserts a note with explicit entities and returns its id', async () => {
    const content = `Test memory ${Date.now()}`;
    const result = await remember(conn, { content, entities: ['testtag'] }, env);
    expect(result.noteId).toMatch(/^\d+$/);
    expect(result.embedded).toBe(false);
  });

  it('inserts a note with no entities when neither provided nor extractable', async () => {
    const content = `Plain memory ${Date.now()}`;
    const result = await remember(conn, { content }, env);
    expect(result.noteId).toMatch(/^\d+$/);
    expect(result.extractedEntities).toBeUndefined();
  });
});
```

- [ ] **Step 10.3: Create `packages/mcp-server/src/tests/list_recent.test.ts`.**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { connectToSpacetime } from '../connection.js';
import { remember } from '../tools/remember.js';
import { listRecent } from '../tools/list_recent.js';
import type { Conn } from '../connection.js';

const env = {
  spacetimedbHost: 'ws://localhost:3000',
  spacetimedbDbName: 'compound-memory-dev',
  spacetimedbToken: undefined,
  anthropicApiKey: undefined,
  voyageApiKey: undefined,
  embeddingModel: 'voyage-3-lite',
};

let conn: Conn;

beforeAll(async () => {
  conn = await connectToSpacetime(env);
});

describe('memory.list_recent', () => {
  it('returns the most recent note as the top entry', async () => {
    const marker = `Marker ${Date.now()}`;
    await remember(conn, { content: marker, entities: [] }, env);
    // Brief delay for subscription to settle
    await new Promise(r => setTimeout(r, 200));
    const result = await listRecent(conn, { k: 5 });
    expect(result.notes[0]?.content).toBe(marker);
  });
});
```

- [ ] **Step 10.4: Create `packages/mcp-server/src/tests/recall.test.ts`.**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { connectToSpacetime } from '../connection.js';
import { remember } from '../tools/remember.js';
import { recall } from '../tools/recall.js';
import type { Conn } from '../connection.js';

const env = {
  spacetimedbHost: 'ws://localhost:3000',
  spacetimedbDbName: 'compound-memory-dev',
  spacetimedbToken: undefined,
  anthropicApiKey: undefined,
  voyageApiKey: undefined,
  embeddingModel: 'voyage-3-lite',
};

let conn: Conn;

beforeAll(async () => {
  conn = await connectToSpacetime(env);
});

describe('memory.recall (entity match without embeddings)', () => {
  it('filters notes by entity tag', async () => {
    const ts = Date.now();
    const tag = `recalltest${ts}`;
    await remember(conn, { content: `Tagged memory ${ts}`, entities: [tag] }, env);
    await new Promise(r => setTimeout(r, 200));
    const result = await recall(conn, { query: 'anything', k: 5, entity: tag }, env);
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0].entities).toContain(tag);
  });
});
```

- [ ] **Step 10.5: Run the test suite.**

```bash
npm run test --workspace @spacetimedb-memory-mmo/mcp-server
```

Expected: all 4 tests pass (2 remember + 1 list_recent + 1 recall). Requires `spacetime start` running and `compound-memory-dev` published.

- [ ] **Step 10.6: Commit + push.**

```bash
git add -A
git commit -m "test(mcp): integration tests for remember/recall/list_recent"
git push
```

---

## Task 11 — Final docs + cross-package smoke

**Files:**
- Modify: `README.md` (root)
- Modify: `packages/mcp-server/README.md`

**Goal:** Repo-level README explains the monorepo and how to use the MCP server today (manual config — Plan 3 will automate it).

- [ ] **Step 11.1: Replace root `README.md` with a monorepo-aware version.**

Read the current README, then rewrite the top section. Keep the existing v1 quickstart but add a section above it about the MCP server. Replace the entire file with:

```markdown
# SpacetimeDB Memory MMO

Multi-agent compound memory backed by SpacetimeDB. A graph-memory backend +
MCP server that any AI agent (Claude Code, Cursor, custom) can plug into.

> **Status:** Plan 1 (graph-memory backend) and Plan 2 (MCP server) complete.
> Plan 3 (`npx` installer + npm publish) in progress.

## Packages

| Package | Purpose |
|---|---|
| `@spacetimedb-memory-mmo/spacetime-module` | SpacetimeDB schema + reducers (graph memory storage) |
| `@spacetimedb-memory-mmo/mcp-server` | MCP server bridging AI agents to the SpacetimeDB module |
| `@spacetimedb-memory-mmo/dashboard` | Optional React UI for browsing memories |

## Quick try (local, manual config)

Prereqs: Node 20+, [`spacetime` CLI](https://spacetimedb.com/install).

```bash
git clone https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git
cd SpacetimeDB-Memory-MMO
npm install

# 1. Start SpacetimeDB locally (in its own terminal)
spacetime start

# 2. Publish the module + generate bindings
npm run spacetime:publish:local
npm run spacetime:generate

# 3. Configure (env vars or .env at root)
cat > .env <<EOF
SPACETIMEDB_HOST=ws://localhost:3000
SPACETIMEDB_DB_NAME=compound-memory-dev
ANTHROPIC_API_KEY=sk-ant-...    # optional, enables auto entity extraction
VOYAGE_API_KEY=pa-...           # optional, enables vector recall
EOF

# 4. Build the MCP server
npm run build --workspace @spacetimedb-memory-mmo/mcp-server

# 5. Wire into your AI host (manual for now — Plan 3 automates)
# Claude Code: add to .claude/settings.json under "mcpServers":
#   "memory": {
#     "command": "node",
#     "args": ["<absolute-path>/packages/mcp-server/dist/index.js"],
#     "env": { "SPACETIMEDB_HOST": "...", "SPACETIMEDB_DB_NAME": "...", ... }
#   }
```

## Optional: dashboard

```bash
npm run dev --workspace @spacetimedb-memory-mmo/dashboard
# opens http://localhost:5173 — useful for inspecting what's stored
```

## MCP tools exposed

- `memory.remember(content, entities?)` — save memory; auto-extracts entities if Anthropic key configured
- `memory.recall(query, k?, entity?)` — two-stage retrieval (entity match + vector re-rank)
- `memory.forget(noteIds[])` — delete one or more memories you own
- `memory.list_entities()` — all entities with note counts
- `memory.list_recent(k?)` — most recent K memories
- `memory.tag(noteId, entity)` / `memory.untag(noteId, entityId)` — adjust tags

## Roadmap

- **Plan 3:** `npx spacetimedb-memory-mmo init` installer + npm publish
- **Plan 4:** Multi-agent ACLs + bi-temporal relations + PageRank retrieval
- **Plan 5:** Dashboard polish + scheduled community summarization

See `docs/superpowers/plans/` for full plans.
```

- [ ] **Step 11.2: Commit + push.**

```bash
git add -A
git commit -m "docs: monorepo README with MCP server quickstart"
git push
```

---

## Done — exit criteria

This plan is complete when **all of these are true**:

1. `git remote -v` shows `origin` pointing at `https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git` and `git push` succeeds.
2. Repo is a working npm-workspaces monorepo (`packages/spacetime-module`, `packages/dashboard`, `packages/mcp-server`).
3. `npm run build` from root succeeds across all workspaces.
4. `npm run test` from root passes the dashboard suite (5 unit + 1 integration) AND the mcp-server suite (4 integration).
5. SpacetimeDB module deployed at `compound-memory-dev` locally has the new schema (embedding columns, embedding_cache, clientToken).
6. MCP server can be started with `tsx packages/mcp-server/src/index.ts` and successfully responds to `tools/list` and `tools/call` JSON-RPC over stdio.
7. `memory.remember` with content + entities adds a tagged memory; `memory.recall` returns it.
8. README documents how to manually wire the MCP server into a Claude Code project.

If all criteria pass, hand off to **Plan 3 (`npx` installer + GitHub release)**.
