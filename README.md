# SpacetimeDB Memory MMO

Multi-agent compound memory backed by SpacetimeDB. A graph-memory backend +
MCP server that any AI agent (Claude Code, Cursor, custom) can plug into.

> **Status:** Plan 1 (graph-memory backend) and Plan 2 (MCP server) complete.
> Plan 3 (`npx` installer + npm publish) in progress.

## Packages

| Package | Purpose |
|---|---|
| `spacetimedb-memory-mmo-module` | SpacetimeDB schema + reducers (graph memory storage) |
| `spacetimedb-memory-mmo-mcp-server` | MCP server bridging AI agents to the SpacetimeDB module |
| `spacetimedb-memory-mmo-dashboard` | Optional React UI for browsing memories |

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

# 3. Configure (env vars or .env at repo root)
cat > .env <<EOF
SPACETIMEDB_HOST=ws://localhost:3000
SPACETIMEDB_DB_NAME=compound-memory-dev
ANTHROPIC_API_KEY=sk-ant-...    # optional, enables auto entity extraction
VOYAGE_API_KEY=pa-...           # optional, enables vector recall
EOF

# 4. Build the MCP server
npm run build --workspace spacetimedb-memory-mmo-mcp-server

# 5. Wire into Claude Code by adding to .claude/settings.json:
#   {
#     "mcpServers": {
#       "memory": {
#         "command": "node",
#         "args": ["<absolute>/packages/mcp-server/dist/index.js"],
#         "env": { "DOTENV_CONFIG_PATH": "<absolute>/.env" }
#       }
#     }
#   }
```

Plan 3 (the `npx` installer) automates steps 3-5.

## Optional: dashboard

```bash
npm run dev --workspace spacetimedb-memory-mmo-dashboard
# opens http://localhost:5173 — useful for inspecting what's stored
```

## MCP tools exposed

- `memory.remember(content, entities?)` — save memory; auto-extracts entities if Anthropic key configured; embeds if Voyage key configured
- `memory.recall(query, k?, entity?)` — two-stage retrieval (entity match + vector re-rank)
- `memory.forget(noteIds[])` — delete one or more memories you own
- `memory.list_entities()` — all entities with note counts
- `memory.list_recent(k?)` — most recent K memories
- `memory.tag(noteId, entity)` / `memory.untag(noteId, entityId)` — adjust tags

## Tests

```bash
npm test
```

Runs the dashboard suite (5 unit + 1 integration) and the mcp-server suite (5 integration).
Requires `spacetime start` running and the module published.

## Roadmap

- ✅ **Plan 1** — graph-memory backend
- ✅ **Plan 2** — MCP server with extraction + embeddings
- 🚧 **Plan 3** — `npx` installer + npm publish (in progress)
- 🔜 **Plan 4** — multi-agent ACLs + bi-temporal relations + PageRank retrieval
- 🔜 **Plan 5** — dashboard polish + scheduled community summarization

See `docs/superpowers/plans/` for full plans.

## License

MIT
