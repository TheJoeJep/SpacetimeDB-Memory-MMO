# Compound Memory v1 — SpacetimeDB Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SpacetimeDB chat starter with a graph-memory backend (atomic notes + named entities + many-to-many links) and rebuild the React app as a minimal memory browser. End state: a single agent can add notes, tag them with entity names, list/edit/delete them, and filter notes by entity — all reactive via SpacetimeDB subscriptions, with no external API calls.

**Architecture:**
- `memory_note` is the atomic unit (one fact per row), authored by an `agent` (`Identity`).
- `entity` rows are uniquely-named graph nodes; `note_entity` is the many-to-many join.
- All reducers are deterministic — no LLM/embedding calls (those land in Plan 2's MCP server).
- Two recall axes: by author (current agent's notes) and by entity (notes tagged with a chosen entity). Both implemented via filtered subscriptions in the React client.
- Tests are integration tests against a local SpacetimeDB instance (`spacetime start` running in another terminal). Each test uses unique content (timestamp-suffixed) to avoid cross-test interference, since the DB persists between tests.

**Tech Stack:** SpacetimeDB 2.2 (TypeScript module, language `typescript`), React 18 + Vite client, Vitest + React Testing Library for integration tests, `spacetime` CLI for publish/generate.

**Scope split note:** This is Plan 1 of a multi-plan project. Follow-up plans (NOT in this document):

- **Plan 2 — MCP server:** Wraps this module so any AI agent (Claude Code, Cursor, custom SDK agents) can call `remember` / `recall` / `link` / `forget` / `timeline` MCP tools. The MCP server holds the Anthropic and Voyage API keys, does extraction (Haiku) + embedding (Voyage-3-lite), and writes through to SpacetimeDB reducers via the TS SDK.
- **Plan 3 — Distribution:** Restructure into a monorepo (`packages/spacetime-module`, `packages/mcp-server`, `packages/cli`, `packages/dashboard`), build the `npx <package> init` installer, ready a public GitHub release.
- **Plan 4 — Multi-agent depth:** Bi-temporal `relation` table, multi-agent ACLs (`memory_acl`), Personalized PageRank retrieval reducer.
- **Plan 5 — Polish:** Dashboard refinements, scheduled community summarization, optional Claude Code skill wrapper.

Each plan produces working, testable software on its own.

---

## Prerequisites (do once, before Task 1)

These are not implementation tasks — verify them before starting.

- [ ] **P-1: Verify `spacetime` CLI is installed.**
  Run: `spacetime --version`
  Expected: prints a version like `1.x` or `2.x`. If not installed, install per https://spacetimedb.com/install.

- [ ] **P-2: Start local SpacetimeDB in a separate terminal and leave it running.**
  Run: `spacetime start`
  Expected: server listening on `127.0.0.1:3000`. Don't close this terminal until the plan is complete.

- [ ] **P-3: Confirm a `local` server is registered.**
  Run: `spacetime server list`
  Expected: at least `local | http://localhost:3000` in the list. If missing: `spacetime server add http://localhost:3000 local`.

- [ ] **P-4: Confirm `npm install` is clean in the project root.**
  Run from `my-spacetime-app/`: `npm install`
  Expected: no errors, exit 0.

- [ ] **P-5: Note the dev database name.**
  We'll publish to `compound-memory-dev` on the local server throughout this plan. The production maincloud database `my-spacetime-app-b9ogh` is **not touched** by this plan — it stays as-is until Plan 3.

---

## File Structure

**Create (new files):**

| Path | Responsibility |
|---|---|
| `my-spacetime-app/spacetimedb/src/schema.ts` | All table definitions + `spacetimedb` schema export |
| `my-spacetime-app/src/components/AgentBar.tsx` | Top bar showing current agent identity + name editor |
| `my-spacetime-app/src/components/AddMemory.tsx` | Form: textarea + entity-tag input + submit button |
| `my-spacetime-app/src/components/MemoryList.tsx` | Reactive list of memory notes with entity-tag chips and delete |
| `my-spacetime-app/src/components/EntitySidebar.tsx` | List of all entities with click-to-filter and counts |
| `my-spacetime-app/src/lib/parseTags.ts` | Pure function: parse comma-separated tag string into normalized list |
| `my-spacetime-app/src/lib/parseTags.test.ts` | Unit test for `parseTags` (the only pure-function test in this plan) |

**Rewrite (existing files, full replacement):**

| Path | What changes |
|---|---|
| `my-spacetime-app/spacetimedb/src/index.ts` | Drop chat reducers; import schema from `./schema`; add memory + agent + entity reducers + lifecycle hooks |
| `my-spacetime-app/src/App.tsx` | Drop chat UI; render `<AgentBar/>` + `<AddMemory/>` + 2-column layout of `<EntitySidebar/>` and `<MemoryList/>` |
| `my-spacetime-app/src/main.tsx` | Change `DB_NAME` default from `quickstart-chat` to `compound-memory-dev` |
| `my-spacetime-app/src/App.integration.test.tsx` | Drop chat assertions; assert add-memory + recall flow against local DB |
| `my-spacetime-app/src/App.css` | New 3-area layout (top bar, sidebar, main column) — no chat-specific styles |

**Don't touch:**

- `my-spacetime-app/spacetime.json` (production maincloud config — separate from local dev)
- `my-spacetime-app/spacetime.local.json` (production maincloud DB name)
- `my-spacetime-app/spacetimedb/package.json`, `tsconfig.json` (no new deps needed for v1)
- `my-spacetime-app/package.json` (no new deps for v1)
- `my-spacetime-app/src/module_bindings/*` (regenerated by `spacetime generate`)

**Decomposition rationale:** Schema lives in its own file per CLAUDE.md guidance (avoids circular imports between schema and reducers). React components are split by responsibility (one screen-region each) so each is small enough to hold in context for editing. The single pure helper (`parseTags`) is the only true unit-testable code; everything else is integration-tested through the UI.

---

## Dev cycle reminder (referenced from many tasks)

Whenever the SpacetimeDB schema or a reducer changes, run this loop from `my-spacetime-app/`:

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

`--clear-database -y` is included because schema-additive and schema-changing publishes both behave more predictably from a clean state during dev. For the integration tests, this means each task that re-publishes effectively wipes prior test data — that's intentional during this plan.

---

## Task 1 — Schema scaffold + replace chat with `agent` table

**Files:**
- Create: `my-spacetime-app/spacetimedb/src/schema.ts`
- Modify: `my-spacetime-app/spacetimedb/src/index.ts` (full rewrite)
- Modify: `my-spacetime-app/src/main.tsx` (change DB_NAME default)

**Goal of this task:** Get the dev cycle working end-to-end with a fresh schema (just `agent`), prove publish + generate + connect works against `compound-memory-dev` locally. No memory features yet.

- [ ] **Step 1.1: Create `spacetimedb/src/schema.ts` with the `agent` table.**

Content:

```typescript
import { schema, t, table } from 'spacetimedb/server';

export const agent = table(
  { name: 'agent', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string().optional(),
    registeredAt: t.timestamp(),
  }
);

const spacetimedb = schema({ agent });
export default spacetimedb;
```

- [ ] **Step 1.2: Rewrite `spacetimedb/src/index.ts` to import schema and define lifecycle + `set_agent_name` reducer.**

Replace the entire file contents with:

```typescript
import spacetimedb, { agent } from './schema';
import { t, SenderError } from 'spacetimedb/server';

void agent; // re-export for bindings; keeps tree-shaker honest

export const set_agent_name = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name.trim()) throw new SenderError('Name must not be empty');
    const existing = ctx.db.agent.identity.find(ctx.sender);
    if (!existing) throw new SenderError('Agent not registered');
    ctx.db.agent.identity.update({ ...existing, name });
  }
);

export const init = spacetimedb.init(_ctx => {});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (existing) return;
  ctx.db.agent.insert({
    identity: ctx.sender,
    name: undefined,
    registeredAt: ctx.timestamp,
  });
});

export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {});
```

- [ ] **Step 1.3: Update `src/main.tsx` to default to the dev database.**

Change line 10 from:

```typescript
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'quickstart-chat';
```

To:

```typescript
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'compound-memory-dev';
```

- [ ] **Step 1.4: Publish the new module and regenerate bindings.**

Run from `my-spacetime-app/`:

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

Expected: publish succeeds with `Created new database with identity: ...` (or `Updated database`); generate writes files to `src/module_bindings/`.

- [ ] **Step 1.5: Smoke-check the bindings exist and reference `agent`.**

Run: `ls src/module_bindings`
Expected: includes a file mentioning `agent` (e.g. `agent_table.ts`).

Run (PowerShell): `Select-String -Path src/module_bindings/index.ts -Pattern "agent"`
Or via Grep tool searching for `agent` in `src/module_bindings/`.
Expected: the generated index references the `agent` table.

- [ ] **Step 1.6: Verify the React app builds against the new bindings.**

Run: `npm run build`
Expected: build succeeds. (TypeScript will scream if `App.tsx` or the existing test still reference `tables.user`/`tables.message` — that's fine, we'll fix them in later tasks. If build fails on App.tsx, that's expected; come back here only if it fails on `main.tsx` or `module_bindings/`.)

> **Note:** `App.tsx` still references the old chat tables and will not type-check after Step 1.4. We deliberately delay fixing `App.tsx` until we have memory tables to render. Run `npm run build` to confirm only `App.tsx` and the integration test fail (not `main.tsx` or bindings); proceed.

- [ ] **Step 1.7: Commit.**

```bash
git add spacetimedb/src/schema.ts spacetimedb/src/index.ts src/main.tsx src/module_bindings
git commit -m "feat(memory): replace chat schema with agent table + dev DB name"
```

---

## Task 2 — `memory_note` table + add/delete reducers + minimal UI

**Files:**
- Modify: `my-spacetime-app/spacetimedb/src/schema.ts`
- Modify: `my-spacetime-app/spacetimedb/src/index.ts`
- Create: `my-spacetime-app/src/components/AgentBar.tsx`
- Create: `my-spacetime-app/src/components/AddMemory.tsx`
- Create: `my-spacetime-app/src/components/MemoryList.tsx`
- Modify: `my-spacetime-app/src/App.tsx` (full rewrite — minimal)
- Modify: `my-spacetime-app/src/App.css` (new layout)

**Goal:** End-to-end add + display + delete of memory notes. No entities yet.

- [ ] **Step 2.1: Add `memory_note` table to schema.ts.**

Edit `spacetimedb/src/schema.ts`. Add the table definition before the final `schema({...})` call:

```typescript
export const memoryNote = table(
  {
    name: 'memory_note',
    public: true,
    indexes: [
      { name: 'memory_note_added_by', algorithm: 'btree', columns: ['addedBy'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    content: t.string(),
    addedBy: t.identity(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }
);
```

Then update the final schema export to include it:

```typescript
const spacetimedb = schema({ agent, memoryNote });
export default spacetimedb;
```

- [ ] **Step 2.2: Add `add_memory` and `delete_memory` reducers to index.ts.**

Append to `spacetimedb/src/index.ts` (after the existing imports — also import `memoryNote`):

Update the import line at the top:

```typescript
import spacetimedb, { agent, memoryNote } from './schema';
```

Add `void memoryNote;` next to the existing `void agent;` line.

Then append at the end of the file:

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
    });
  }
);

export const delete_memory = spacetimedb.reducer(
  { noteId: t.u64() },
  (ctx, { noteId }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError('Cannot delete another agent\'s memory');
    }
    ctx.db.memoryNote.id.delete(noteId);
  }
);
```

- [ ] **Step 2.3: Re-publish and regenerate bindings.**

Run from `my-spacetime-app/`:

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

Expected: both succeed. Generated `module_bindings/` should now include a `memory_note` table export and `addMemory` + `deleteMemory` reducer references.

- [ ] **Step 2.4: Create `src/components/AgentBar.tsx`.**

```typescript
import { useState } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function AgentBar() {
  const { identity } = useSpacetimeDB();
  const setAgentName = useReducer(reducers.setAgentName);
  const [agents] = useTable(tables.agent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!identity) return <div className="agent-bar">Not connected</div>;

  const me = agents.find(a => a.identity.isEqual(identity));
  const displayName = me?.name || identity.toHexString().substring(0, 8);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setAgentName({ name: draft.trim() });
    setEditing(false);
  };

  return (
    <div className="agent-bar">
      <span className="agent-label">Agent:</span>
      {editing ? (
        <form onSubmit={onSave} style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <input
            aria-label="agent name input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <span className="agent-name">{displayName}</span>
          <button onClick={() => { setDraft(me?.name || ''); setEditing(true); }}>
            Edit
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2.5: Create `src/components/AddMemory.tsx`.**

```typescript
import { useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';

export function AddMemory() {
  const [content, setContent] = useState('');
  const addMemory = useReducer(reducers.addMemory);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    addMemory({ content: trimmed });
    setContent('');
  };

  return (
    <form className="add-memory" onSubmit={onSubmit}>
      <h3>Add memory</h3>
      <textarea
        aria-label="memory content input"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What should I remember?"
        rows={3}
      />
      <button type="submit" disabled={!content.trim()}>Save</button>
    </form>
  );
}
```

- [ ] **Step 2.6: Create `src/components/MemoryList.tsx`.**

```typescript
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function MemoryList() {
  const { identity } = useSpacetimeDB();
  const [notes, isLoading] = useTable(tables.memoryNote);
  const deleteMemory = useReducer(reducers.deleteMemory);

  if (isLoading) return <div className="memory-list">Loading…</div>;
  if (notes.length === 0) {
    return <div className="memory-list empty">No memories yet. Add one above.</div>;
  }

  const sorted = [...notes].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );

  return (
    <div className="memory-list">
      <h3>Memories ({sorted.length})</h3>
      <ul>
        {sorted.map(note => {
          const isMine = identity && note.addedBy.isEqual(identity);
          const date = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));
          return (
            <li key={note.id.toString()} className="memory-item">
              <p className="memory-content">{note.content}</p>
              <div className="memory-meta">
                <span>{date.toLocaleString()}</span>
                {isMine && (
                  <button
                    onClick={() => deleteMemory({ noteId: note.id })}
                    aria-label={`delete memory ${note.id.toString()}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2.7: Rewrite `src/App.tsx` to compose the components.**

Replace the entire file with:

```typescript
import './App.css';
import { useSpacetimeDB } from 'spacetimedb/react';
import { AgentBar } from './components/AgentBar';
import { AddMemory } from './components/AddMemory';
import { MemoryList } from './components/MemoryList';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();

  if (!connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting to compound-memory-dev…</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <AgentBar />
      <main className="main-area">
        <AddMemory />
        <MemoryList />
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2.8: Replace `src/App.css` with the new layout styles.**

Replace the entire file with:

```css
.App {
  font-family: system-ui, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}

.agent-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid #ddd;
  margin-bottom: 1rem;
}

.agent-label { color: #666; }
.agent-name { font-weight: 600; font-family: monospace; }

.main-area {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.add-memory {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.add-memory textarea {
  width: 100%;
  font-family: inherit;
  font-size: 1rem;
  padding: 0.5rem;
}

.memory-list ul { list-style: none; padding: 0; }

.memory-item {
  padding: 0.75rem;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.memory-content { margin: 0 0 0.5rem 0; white-space: pre-wrap; }

.memory-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #666;
}

.memory-list.empty { color: #999; padding: 1rem; }
```

- [ ] **Step 2.9: Confirm the app type-checks and builds.**

Run: `npm run build`
Expected: build succeeds. If `App.integration.test.tsx` fails type-check, that's expected — we rewrite it in Task 7. The build itself excludes test files.

If `tsc` (run as part of `build`) fails because of the test file, temporarily exclude it from the build by checking `tsconfig.app.json` includes — if the test is included, this is expected and we proceed; the build of the *app* is what matters here for runtime. (We'll fix the test in Task 7.)

If the build fails for any other reason, stop and fix before proceeding.

- [ ] **Step 2.10: Manually verify add + delete in the browser.**

Run: `npm run dev`
Open: the printed URL (typically `http://localhost:5173`).
Expected:
1. "Connecting…" briefly, then the agent bar shows your truncated identity.
2. Type a memory, click Save — the new memory appears in the list immediately.
3. Click Delete — the memory disappears.

Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 2.11: Commit.**

```bash
git add spacetimedb/src src/components src/App.tsx src/App.css src/module_bindings
git commit -m "feat(memory): add memory_note table + add/delete reducers + minimal UI"
```

---

## Task 3 — Pure helper: `parseTags`

**Files:**
- Create: `my-spacetime-app/src/lib/parseTags.ts`
- Create: `my-spacetime-app/src/lib/parseTags.test.ts`

**Goal:** A small pure function that turns `"  Alice, bob, , Alice  "` into `["alice", "bob"]` (lowercased, deduped, empty-removed). This is the only true unit-testable function in the plan — strict TDD applies.

- [ ] **Step 3.1: Write the failing test.**

Create `src/lib/parseTags.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseTags } from './parseTags';

describe('parseTags', () => {
  it('returns an empty array for empty input', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
  });

  it('splits on commas and trims whitespace', () => {
    expect(parseTags('alice, bob , charlie')).toEqual(['alice', 'bob', 'charlie']);
  });

  it('lowercases tags', () => {
    expect(parseTags('Alice, BOB')).toEqual(['alice', 'bob']);
  });

  it('removes empty entries from extra commas', () => {
    expect(parseTags('alice,,bob,')).toEqual(['alice', 'bob']);
  });

  it('deduplicates after normalization, preserving first-seen order', () => {
    expect(parseTags('alice, Alice, bob, ALICE')).toEqual(['alice', 'bob']);
  });
});
```

- [ ] **Step 3.2: Run the test to verify it fails.**

Run: `npx vitest run src/lib/parseTags.test.ts`
Expected: FAIL with `Cannot find module './parseTags'` or similar.

- [ ] **Step 3.3: Create the minimal implementation.**

Create `src/lib/parseTags.ts`:

```typescript
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
```

- [ ] **Step 3.4: Run the test to verify it passes.**

Run: `npx vitest run src/lib/parseTags.test.ts`
Expected: all 5 assertions pass.

- [ ] **Step 3.5: Commit.**

```bash
git add src/lib/parseTags.ts src/lib/parseTags.test.ts
git commit -m "feat(memory): parseTags helper for entity tag normalization"
```

---

## Task 4 — `entity` + `note_entity` tables + `add_memory_with_entities` reducer + entity tags in UI

**Files:**
- Modify: `my-spacetime-app/spacetimedb/src/schema.ts`
- Modify: `my-spacetime-app/spacetimedb/src/index.ts`
- Modify: `my-spacetime-app/src/components/AddMemory.tsx`
- Modify: `my-spacetime-app/src/components/MemoryList.tsx`

**Goal:** When adding a memory, the user can also enter comma-separated entity tags. The reducer atomically creates the note, finds-or-creates each entity (uniqueness on lowercased name), and links them. The memory list shows entity chips next to each note.

- [ ] **Step 4.1: Add `entity` and `note_entity` tables to schema.ts.**

Append to `spacetimedb/src/schema.ts`, before the final `schema(...)` call:

```typescript
export const entity = table(
  { name: 'entity', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string().unique(),
    kind: t.string().optional(),
    createdAt: t.timestamp(),
  }
);

export const noteEntity = table(
  {
    name: 'note_entity',
    public: true,
    indexes: [
      { name: 'note_entity_note_id', algorithm: 'btree', columns: ['noteId'] },
      { name: 'note_entity_entity_id', algorithm: 'btree', columns: ['entityId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    noteId: t.u64(),
    entityId: t.u64(),
  }
);
```

Update the final schema call:

```typescript
const spacetimedb = schema({ agent, memoryNote, entity, noteEntity });
export default spacetimedb;
```

- [ ] **Step 4.2: Add `add_memory_with_entities` reducer + helper in index.ts.**

Update the import in `spacetimedb/src/index.ts`:

```typescript
import spacetimedb, { agent, memoryNote, entity, noteEntity } from './schema';
```

Add `void entity; void noteEntity;` near the other re-export lines.

Append at the end of the file:

// Helper used by add_memory_with_entities and (later) tag_memory.
// `ctx` is typed loosely as `any` because SpacetimeDB does not export a public
// ReducerContext type; the helper only touches `ctx.db.entity` and `ctx.timestamp`.
function findOrCreateEntity(ctx: any, rawName: string): bigint {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new SenderError('Entity name must not be empty');
  const existing = ctx.db.entity.name.find(name);
  if (existing) return existing.id;
  const created = ctx.db.entity.insert({
    id: 0n,
    name,
    kind: undefined,
    createdAt: ctx.timestamp,
  });
  return created.id;
}

export const add_memory_with_entities = spacetimedb.reducer(
  { content: t.string(), entityNames: t.array(t.string()) },
  (ctx, { content, entityNames }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    const note = ctx.db.memoryNote.insert({
      id: 0n,
      content: trimmed,
      addedBy: ctx.sender,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
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

> **Note on the `findOrCreateEntity` signature:** the awkward `Parameters<...>` type annotation is to extract the reducer context type without exporting it. If your editor flags this, an alternative is to inline the helper into the reducer body — but extracting it is preferred for readability.

Also extend `delete_memory` to clean up note_entity rows. Replace the existing `delete_memory` reducer with:

```typescript
export const delete_memory = spacetimedb.reducer(
  { noteId: t.u64() },
  (ctx, { noteId }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError('Cannot delete another agent\'s memory');
    }
    for (const link of [...ctx.db.noteEntity.note_entity_note_id.filter(noteId)]) {
      ctx.db.noteEntity.id.delete(link.id);
    }
    ctx.db.memoryNote.id.delete(noteId);
  }
);
```

- [ ] **Step 4.3: Re-publish and regenerate bindings.**

Run from `my-spacetime-app/`:

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

Expected: both succeed.

- [ ] **Step 4.4: Update `AddMemory.tsx` to take entity tags and call the new reducer.**

Replace the entire file with:

```typescript
import { useState } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import { parseTags } from '../lib/parseTags';

export function AddMemory() {
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const addMemoryWithEntities = useReducer(reducers.addMemoryWithEntities);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    const entityNames = parseTags(tagInput);
    addMemoryWithEntities({ content: trimmed, entityNames });
    setContent('');
    setTagInput('');
  };

  return (
    <form className="add-memory" onSubmit={onSubmit}>
      <h3>Add memory</h3>
      <textarea
        aria-label="memory content input"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What should I remember?"
        rows={3}
      />
      <input
        aria-label="entity tags input"
        type="text"
        value={tagInput}
        onChange={e => setTagInput(e.target.value)}
        placeholder="Entity tags (comma-separated, e.g. alice, project-x)"
      />
      <button type="submit" disabled={!content.trim()}>Save</button>
    </form>
  );
}
```

- [ ] **Step 4.5: Update `MemoryList.tsx` to show entity chips per note.**

Replace the entire file with:

```typescript
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function MemoryList() {
  const { identity } = useSpacetimeDB();
  const [notes, isLoading] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const deleteMemory = useReducer(reducers.deleteMemory);

  if (isLoading) return <div className="memory-list">Loading…</div>;
  if (notes.length === 0) {
    return <div className="memory-list empty">No memories yet. Add one above.</div>;
  }

  const entityById = new Map(entities.map(e => [e.id.toString(), e.name]));
  const linksByNote = new Map<string, string[]>();
  for (const link of links) {
    const noteKey = link.noteId.toString();
    const name = entityById.get(link.entityId.toString());
    if (!name) continue;
    if (!linksByNote.has(noteKey)) linksByNote.set(noteKey, []);
    linksByNote.get(noteKey)!.push(name);
  }

  const sorted = [...notes].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );

  return (
    <div className="memory-list">
      <h3>Memories ({sorted.length})</h3>
      <ul>
        {sorted.map(note => {
          const isMine = identity && note.addedBy.isEqual(identity);
          const date = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));
          const tags = linksByNote.get(note.id.toString()) || [];
          return (
            <li key={note.id.toString()} className="memory-item">
              <p className="memory-content">{note.content}</p>
              {tags.length > 0 && (
                <div className="memory-tags">
                  {tags.map(tag => (
                    <span key={tag} className="tag-chip">{tag}</span>
                  ))}
                </div>
              )}
              <div className="memory-meta">
                <span>{date.toLocaleString()}</span>
                {isMine && (
                  <button
                    onClick={() => deleteMemory({ noteId: note.id })}
                    aria-label={`delete memory ${note.id.toString()}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4.6: Add tag-chip styles to `App.css`.**

Append to `src/App.css`:

```css
.memory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.tag-chip {
  background: #eef;
  color: #225;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-family: monospace;
}

.tag-chip.active {
  background: #225;
  color: #fff;
}
```

- [ ] **Step 4.7: Manually verify the entity-tagging flow.**

Run: `npm run dev`
Expected:
1. Add a memory with content "Alice prefers oat milk" and tags "Alice, drinks".
2. The new memory appears with two chip-shaped tags: `alice`, `drinks`.
3. Add another memory "Alice mentioned the project deadline is May 15" with tags "alice, project".
4. Both memories show, with `alice` appearing on both.

Stop the dev server.

- [ ] **Step 4.8: Commit.**

```bash
git add spacetimedb/src src/components src/App.css src/module_bindings
git commit -m "feat(memory): entity + note_entity tables; add_memory_with_entities; tag chips"
```

---

## Task 5 — `update_memory` reducer + post-hoc tag/untag reducers

**Files:**
- Modify: `my-spacetime-app/spacetimedb/src/index.ts`
- Modify: `my-spacetime-app/src/components/MemoryList.tsx` (add edit button + tag remove buttons)

**Goal:** Edit existing memory content; add or remove entity tags on existing memories.

- [ ] **Step 5.1: Add three reducers to `index.ts`.**

Append to `spacetimedb/src/index.ts`:

```typescript
export const update_memory = spacetimedb.reducer(
  { noteId: t.u64(), content: t.string() },
  (ctx, { noteId, content }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError('Cannot edit another agent\'s memory');
    }
    ctx.db.memoryNote.id.update({
      ...existing,
      content: trimmed,
      updatedAt: ctx.timestamp,
    });
  }
);

export const tag_memory = spacetimedb.reducer(
  { noteId: t.u64(), entityName: t.string() },
  (ctx, { noteId, entityName }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError('Cannot tag another agent\'s memory');
    }
    const entityId = findOrCreateEntity(ctx, entityName);
    const alreadyLinked = [...ctx.db.noteEntity.note_entity_note_id.filter(noteId)]
      .some(link => link.entityId === entityId);
    if (alreadyLinked) return;
    ctx.db.noteEntity.insert({ id: 0n, noteId, entityId });
  }
);

export const untag_memory = spacetimedb.reducer(
  { noteId: t.u64(), entityId: t.u64() },
  (ctx, { noteId, entityId }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError('Cannot untag another agent\'s memory');
    }
    for (const link of [...ctx.db.noteEntity.note_entity_note_id.filter(noteId)]) {
      if (link.entityId === entityId) ctx.db.noteEntity.id.delete(link.id);
    }
  }
);
```

- [ ] **Step 5.2: Re-publish and regenerate.**

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

Expected: both succeed.

- [ ] **Step 5.3: Update `MemoryList.tsx` to support edit + tag/untag.**

Replace the entire file with:

```typescript
import { useState } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function MemoryList() {
  const { identity } = useSpacetimeDB();
  const [notes, isLoading] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const deleteMemory = useReducer(reducers.deleteMemory);
  const updateMemory = useReducer(reducers.updateMemory);
  const tagMemory = useReducer(reducers.tagMemory);
  const untagMemory = useReducer(reducers.untagMemory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  if (isLoading) return <div className="memory-list">Loading…</div>;
  if (notes.length === 0) {
    return <div className="memory-list empty">No memories yet. Add one above.</div>;
  }

  const entityById = new Map(entities.map(e => [e.id.toString(), e]));
  const linksByNote = new Map<string, { linkId: bigint; entityId: bigint; name: string }[]>();
  for (const link of links) {
    const noteKey = link.noteId.toString();
    const ent = entityById.get(link.entityId.toString());
    if (!ent) continue;
    if (!linksByNote.has(noteKey)) linksByNote.set(noteKey, []);
    linksByNote.get(noteKey)!.push({ linkId: link.id, entityId: link.entityId, name: ent.name });
  }

  const sorted = [...notes].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );

  return (
    <div className="memory-list">
      <h3>Memories ({sorted.length})</h3>
      <ul>
        {sorted.map(note => {
          const isMine = identity && note.addedBy.isEqual(identity);
          const date = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));
          const tags = linksByNote.get(note.id.toString()) || [];
          const noteKey = note.id.toString();
          const isEditing = editingId === noteKey;

          return (
            <li key={noteKey} className="memory-item">
              {isEditing ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!editDraft.trim()) return;
                    updateMemory({ noteId: note.id, content: editDraft.trim() });
                    setEditingId(null);
                  }}
                >
                  <textarea
                    aria-label={`edit memory ${noteKey}`}
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </form>
              ) : (
                <p className="memory-content">{note.content}</p>
              )}

              <div className="memory-tags">
                {tags.map(tag => (
                  <span key={tag.linkId.toString()} className="tag-chip">
                    {tag.name}
                    {isMine && (
                      <button
                        type="button"
                        aria-label={`remove tag ${tag.name} from memory ${noteKey}`}
                        onClick={() => untagMemory({ noteId: note.id, entityId: tag.entityId })}
                        style={{ marginLeft: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {isMine && (
                  <form
                    style={{ display: 'inline-flex', gap: '0.25rem' }}
                    onSubmit={e => {
                      e.preventDefault();
                      const v = (tagDraft[noteKey] || '').trim();
                      if (!v) return;
                      tagMemory({ noteId: note.id, entityName: v });
                      setTagDraft(d => ({ ...d, [noteKey]: '' }));
                    }}
                  >
                    <input
                      aria-label={`add tag to memory ${noteKey}`}
                      value={tagDraft[noteKey] || ''}
                      onChange={e => setTagDraft(d => ({ ...d, [noteKey]: e.target.value }))}
                      placeholder="+ tag"
                      size={8}
                    />
                  </form>
                )}
              </div>

              <div className="memory-meta">
                <span>{date.toLocaleString()}</span>
                {isMine && !isEditing && (
                  <span style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setEditDraft(note.content); setEditingId(noteKey); }}
                      aria-label={`edit memory ${noteKey}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMemory({ noteId: note.id })}
                      aria-label={`delete memory ${noteKey}`}
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5.4: Manually verify edit + tag/untag.**

Run: `npm run dev`
Expected:
1. Add a memory.
2. Click Edit, change content, click Save — content updates.
3. Type a tag in the "+ tag" input, press Enter — tag chip appears.
4. Click the `×` on a tag chip — tag is removed.

Stop the dev server.

- [ ] **Step 5.5: Commit.**

```bash
git add spacetimedb/src src/components src/module_bindings
git commit -m "feat(memory): update_memory + tag/untag reducers + edit/tag UI"
```

---

## Task 6 — `EntitySidebar` + filter notes by entity

**Files:**
- Create: `my-spacetime-app/src/components/EntitySidebar.tsx`
- Modify: `my-spacetime-app/src/components/MemoryList.tsx` (accept optional `filterEntityId` prop)
- Modify: `my-spacetime-app/src/App.tsx` (compose sidebar + filter state)
- Modify: `my-spacetime-app/src/App.css` (2-column layout)

**Goal:** A left sidebar lists all entities with note counts. Clicking one filters the memory list to only notes linked to that entity. Clicking again (or "All") clears the filter.

- [ ] **Step 6.1: Create `src/components/EntitySidebar.tsx`.**

```typescript
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';

interface Props {
  selectedEntityId: bigint | null;
  onSelect: (entityId: bigint | null) => void;
}

export function EntitySidebar({ selectedEntityId, onSelect }: Props) {
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);

  const countByEntity = new Map<string, number>();
  for (const link of links) {
    const k = link.entityId.toString();
    countByEntity.set(k, (countByEntity.get(k) || 0) + 1);
  }

  const sorted = [...entities].sort((a, b) => a.name.localeCompare(b.name));
  const selectedKey = selectedEntityId?.toString() ?? null;

  return (
    <aside className="entity-sidebar">
      <h3>Entities</h3>
      <ul>
        <li>
          <button
            type="button"
            className={selectedKey === null ? 'entity-row active' : 'entity-row'}
            onClick={() => onSelect(null)}
          >
            All ({links.length === 0 ? '0' : 'all'})
          </button>
        </li>
        {sorted.map(ent => {
          const k = ent.id.toString();
          const count = countByEntity.get(k) || 0;
          return (
            <li key={k}>
              <button
                type="button"
                className={selectedKey === k ? 'entity-row active' : 'entity-row'}
                onClick={() => onSelect(ent.id)}
              >
                {ent.name} <span className="entity-count">({count})</span>
              </button>
            </li>
          );
        })}
        {entities.length === 0 && <li className="entity-empty">No entities yet.</li>}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 6.2: Modify `MemoryList.tsx` to accept a `filterEntityId` prop.**

In `src/components/MemoryList.tsx`, change the function signature and add the filter logic. Replace just the function signature line and add filtering before the `sorted` calculation.

Change:

```typescript
export function MemoryList() {
```

To:

```typescript
interface Props {
  filterEntityId?: bigint | null;
}

export function MemoryList({ filterEntityId = null }: Props = {}) {
```

Then, just before the `const sorted = [...notes]...` line, add:

```typescript
  const filteredNotes = filterEntityId === null
    ? notes
    : notes.filter(n => {
        const noteLinks = linksByNote.get(n.id.toString()) || [];
        return noteLinks.some(l => l.entityId === filterEntityId);
      });
```

And change the line:

```typescript
  const sorted = [...notes].sort((a, b) =>
```

To:

```typescript
  const sorted = [...filteredNotes].sort((a, b) =>
```

And change the heading:

```typescript
      <h3>Memories ({sorted.length})</h3>
```

To:

```typescript
      <h3>Memories ({sorted.length}{filterEntityId !== null && ` of ${notes.length}`})</h3>
```

- [ ] **Step 6.3: Update `App.tsx` to wire the sidebar and filter state.**

Replace the entire file with:

```typescript
import { useState } from 'react';
import './App.css';
import { useSpacetimeDB } from 'spacetimedb/react';
import { AgentBar } from './components/AgentBar';
import { AddMemory } from './components/AddMemory';
import { MemoryList } from './components/MemoryList';
import { EntitySidebar } from './components/EntitySidebar';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();
  const [filterEntityId, setFilterEntityId] = useState<bigint | null>(null);

  if (!connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting to compound-memory-dev…</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <AgentBar />
      <div className="layout">
        <EntitySidebar selectedEntityId={filterEntityId} onSelect={setFilterEntityId} />
        <main className="main-area">
          <AddMemory />
          <MemoryList filterEntityId={filterEntityId} />
        </main>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 6.4: Update `App.css` for the 2-column layout.**

Append to `src/App.css`:

```css
.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.entity-sidebar {
  border-right: 1px solid #eee;
  padding-right: 1rem;
}

.entity-sidebar ul { list-style: none; padding: 0; }

.entity-row {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.4rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.95rem;
}

.entity-row:hover { background: #f5f5f5; }
.entity-row.active { background: #225; color: #fff; }

.entity-count { color: #888; font-size: 0.8rem; }
.entity-row.active .entity-count { color: #ccd; }

.entity-empty { color: #999; padding: 0.5rem; }

@media (max-width: 700px) {
  .layout { grid-template-columns: 1fr; }
  .entity-sidebar { border-right: none; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
}
```

- [ ] **Step 6.5: Manually verify entity filtering.**

Run: `npm run dev`
Expected:
1. With multiple memories and entities present, the sidebar lists all entities with counts.
2. Click "alice" — only memories linked to alice are visible; others are hidden.
3. Click "All" — all memories visible again.

Stop the dev server.

- [ ] **Step 6.6: Commit.**

```bash
git add src/components src/App.tsx src/App.css
git commit -m "feat(memory): EntitySidebar with click-to-filter notes by entity"
```

---

## Task 7 — Rewrite the integration test for the memory flow

**Files:**
- Modify: `my-spacetime-app/src/App.integration.test.tsx` (full rewrite)

**Goal:** A single end-to-end Vitest integration test that connects to local SpacetimeDB, adds a memory with an entity tag, asserts both appear in the UI, then deletes the memory and asserts it's gone. This is the regression net for everything in Tasks 1-6.

- [ ] **Step 7.1: Replace the entire test file with the memory flow test.**

Replace `src/App.integration.test.tsx` with:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import App from './App';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';

describe('Compound memory App', () => {
  it('adds a memory with an entity tag, shows it, and deletes it', async () => {
    const uniqueContent = `Test memory ${Date.now()}`;
    const uniqueTag = `testtag${Date.now()}`;

    const connectionBuilder = DbConnection.builder()
      .withUri('ws://localhost:3000')
      .withDatabaseName('compound-memory-dev');

    render(
      <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
        <App />
      </SpacetimeDBProvider>
    );

    // Connect
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument(),
      { timeout: 10000 }
    );

    // Add memory + tag
    const contentInput = screen.getByRole('textbox', { name: /memory content input/i });
    await userEvent.type(contentInput, uniqueContent);
    const tagInput = screen.getByRole('textbox', { name: /entity tags input/i });
    await userEvent.type(tagInput, uniqueTag);
    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await userEvent.click(saveButton);

    // Memory + tag chip appear
    await waitFor(
      () => expect(screen.getByText(uniqueContent)).toBeInTheDocument(),
      { timeout: 10000 }
    );
    await waitFor(
      () => expect(screen.getByText(uniqueTag)).toBeInTheDocument(),
      { timeout: 10000 }
    );

    // Sidebar shows the entity (button text contains the tag name)
    expect(screen.getAllByRole('button', { name: new RegExp(uniqueTag, 'i') }).length)
      .toBeGreaterThan(0);

    // Delete the memory (find the delete button by its aria-label pattern)
    const deleteButtons = screen.getAllByRole('button', { name: /delete memory/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    await userEvent.click(deleteButtons[0]);

    // Memory disappears
    await waitFor(
      () => expect(screen.queryByText(uniqueContent)).not.toBeInTheDocument(),
      { timeout: 10000 }
    );
  });
});
```

- [ ] **Step 7.2: Make sure local SpacetimeDB is running and the dev module is published.**

In your spacetime terminal, confirm `spacetime start` is still running. Then re-publish to ensure latest schema:

```bash
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb
```

- [ ] **Step 7.3: Run the integration test.**

Run: `npm test`
Expected: 1 passed test (`Compound memory App > adds a memory with an entity tag, shows it, and deletes it`).

If it fails: confirm `spacetime start` is running, the module is published to `compound-memory-dev` on the `local` server, and `src/module_bindings/` matches the latest schema.

- [ ] **Step 7.4: Run the unit test too, confirm full suite green.**

Run: `npm test`
Expected: integration test (1) + parseTags test (5) all pass.

- [ ] **Step 7.5: Commit.**

```bash
git add src/App.integration.test.tsx
git commit -m "test(memory): rewrite integration test for add/tag/delete memory flow"
```

---

## Task 8 — README + plan completion

**Files:**
- Modify: `my-spacetime-app/README.md` (add a v1 section)

**Goal:** Document how to run the v1 module locally so anyone (including future-you starting Plan 2) can pick it up.

- [ ] **Step 8.1: Read the current README to know where to insert.**

Run: read `my-spacetime-app/README.md`
Expected: existing README content (likely the Vite starter README).

- [ ] **Step 8.2: Add a "Compound Memory v1" section at the top of the README.**

Prepend (or insert near the top, above the existing content) the following markdown:

```markdown
# Compound Memory (v1 — SpacetimeDB foundation)

Multi-agent graph memory backed by SpacetimeDB. v1 is a local, single-agent
graph memory: atomic notes, named entities, many-to-many links, reactive UI.
v2 layers an MCP server (Plan 2) so any AI agent can `remember` / `recall`.
v3 wraps it as `npx <package> init` for one-command install (Plan 3).

## Local quickstart

Prereqs: Node 20+, `spacetime` CLI installed.

```bash
# 1. Start SpacetimeDB locally (leave running in its own terminal)
spacetime start

# 2. From this directory, install deps
npm install

# 3. Publish the module to local + generate bindings
spacetime publish compound-memory-dev --module-path spacetimedb --server local --clear-database -y
spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb

# 4. Run the dev UI
npm run dev
```

The UI lets you add memories, tag them with comma-separated entity names,
edit/delete memories, and filter by entity in the sidebar.

## Tests

```bash
npm test
```

Runs the unit test for `parseTags` and an end-to-end integration test against
the local SpacetimeDB. Requires `spacetime start` and the module published.

## What's in v1

- Tables: `agent`, `memory_note`, `entity`, `note_entity`
- Reducers: `set_agent_name`, `add_memory`, `add_memory_with_entities`,
  `update_memory`, `delete_memory`, `tag_memory`, `untag_memory`
- All deterministic — no LLM/embedding calls (those arrive in Plan 2)

See `docs/superpowers/plans/` for the multi-plan roadmap.

---
```

(Leave the existing README content below the new section.)

- [ ] **Step 8.3: Commit.**

```bash
git add README.md
git commit -m "docs: README quickstart for compound memory v1"
```

---

## Done — exit criteria

This plan is complete when **all of these are true**:

1. `spacetime publish compound-memory-dev --module-path spacetimedb --server local` succeeds with no errors.
2. `spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb` writes bindings without errors.
3. `npm run build` succeeds (whole app + tests type-check).
4. `npm test` passes — both `parseTags` unit tests and the App integration test.
5. Manual smoke check: `npm run dev`, add 3 memories with overlapping entity tags, verify add/edit/delete/tag/untag/filter all work in the browser.
6. Repo has 8 commits (one per task) on the current branch.

If all criteria pass, hand off to **Plan 2 (MCP server)** — to be written separately.
