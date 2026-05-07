# spacetimedb-memory-mmo-mcp-server

MCP server that bridges AI agents (Claude Code, Cursor, custom) to a
compound-memory SpacetimeDB module.

## Env vars

| Var | Required | Default | Notes |
|---|---|---|---|
| `SPACETIMEDB_HOST` | yes | — | `ws://localhost:3000` or `wss://maincloud.spacetimedb.com` |
| `SPACETIMEDB_DB_NAME` | yes | — | Module identifier |
| `SPACETIMEDB_TOKEN` | no | — | Stored token for stable identity |
| `ANTHROPIC_API_KEY` | no | — | Enables LLM entity extraction in `remember` |
| `VOYAGE_API_KEY` | no | — | Enables embeddings + vector recall |
| `VOYAGE_EMBEDDING_MODEL` | no | `voyage-3-lite` | Voyage embedding model |
| `DOTENV_CONFIG_PATH` | no | — | Absolute path to a `.env` file to load |

## Run

```bash
SPACETIMEDB_HOST=ws://localhost:3000 \
SPACETIMEDB_DB_NAME=compound-memory-dev \
npm run dev
```

## Tools

- `memory.remember(content, entities?)`
- `memory.recall(query, k?, entity?)`
- `memory.forget(noteIds[])`
- `memory.list_entities()`
- `memory.list_recent(k?)`
- `memory.tag(noteId, entity)`
- `memory.untag(noteId, entityId)`
