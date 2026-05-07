# Compound Memory (v1 — SpacetimeDB foundation)

Multi-agent graph memory backed by SpacetimeDB. v1 is a local, single-agent
graph memory: atomic notes, named entities, many-to-many links, reactive UI.

- **v2** (Plan 2) adds an MCP server so any AI agent (Claude Code, Cursor, custom)
  can `remember` / `recall` via MCP tools, with LLM-driven entity extraction.
- **v3** (Plan 3) wraps everything as `npx <package> init` for one-command install
  into any project folder.
- **v4+** adds bi-temporal relations, multi-agent ACLs, PageRank retrieval.

See `docs/superpowers/plans/` for the multi-plan roadmap.

## Local quickstart

Prereqs: Node 20+, [`spacetime` CLI](https://spacetimedb.com/install) installed.

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

The UI lets you:

- Add memories with optional comma-separated entity tags
- Edit / delete your own memories
- Add or remove tags on existing memories
- Filter memories by entity (sidebar)

## Tests

```bash
npm test
```

Runs:

- Unit tests for `parseTags`
- An end-to-end integration test against the local SpacetimeDB (requires
  `spacetime start` running and the module published as above)

## What's in v1

**Tables:** `agent`, `memory_note`, `entity`, `note_entity`

**Reducers:** `set_agent_name`, `add_memory`, `add_memory_with_entities`,
`update_memory`, `delete_memory`, `tag_memory`, `untag_memory`

All reducers are deterministic — no LLM/embedding calls. Those arrive in Plan 2.

## Multi-agent today

Multiple browser tabs / clients can connect to the same SpacetimeDB module
simultaneously and share memories in real time (each agent sees the other's
inserts via subscriptions). Per-agent ACLs and bi-temporal relations come in
Plan 4.

## Production deploy

The `spacetime.json` points at a maincloud database (`my-spacetime-app-b9ogh`).
To deploy this v1 module there:

```bash
spacetime publish my-spacetime-app-b9ogh --module-path spacetimedb --server maincloud --clear-database -y
```

(Be aware: this destroys whatever's currently in the maincloud DB.)

---

# Original quickstart README (chat starter, archived)

This project was scaffolded from the [SpacetimeDB TypeScript Quickstart Chat](https://spacetimedb.com/docs/sdks/typescript/quickstart) example. The chat UI has been replaced with the memory UI; the SpacetimeDB tooling and project layout remain.
