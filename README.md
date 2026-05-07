# SpacetimeDB Memory MMO

> Multi-agent compound memory for AI agents, backed by SpacetimeDB.

Install into any project folder in one command:

```bash
npx spacetimedb-memory-mmo init
```

Adds a graph-memory MCP server to Claude Code, Cursor, or any other MCP-compatible
AI host. Memories are atomic notes with named entity tags + optional vector
embeddings, stored in a SpacetimeDB module that multiple agents can share live.

## What you get

- 🧠 **Persistent memory** across AI sessions, with entity-graph navigation
- 🤝 **Multi-agent** — multiple agents on multiple machines share the same memory in real time
- 🔌 **MCP standard** — works with Claude Code, Cursor, Windsurf, custom agents
- 💸 **Cost-aware** — Haiku 4.5 for extraction, Voyage for embeddings, content-hash caching
- 🏠 **Local-first** — runs on your machine by default; optional cloud sync via SpacetimeDB Maincloud

## Install

```bash
npx spacetimedb-memory-mmo init
```

The installer asks:

1. **New memory system or connect to existing?**
2. **Local (private, fast) or Maincloud (free hosted, syncs across devices)?**
3. **Configure Claude Code, Cursor, both, or skip?**
4. Anthropic API key (optional, enables auto entity extraction)
5. Voyage API key (optional, enables vector recall)

After install, talk to your AI agent normally — it now has `memory.remember` and `memory.recall` tools.

## Prerequisites

- Node.js 20+
- [SpacetimeDB CLI](https://spacetimedb.com/install)
- For Maincloud: a free SpacetimeDB account (`spacetime login`)
- For auto-extraction: an [Anthropic API key](https://console.anthropic.com/) (optional)
- For vector recall: a [Voyage API key](https://dashboard.voyageai.com/) (optional)

## MCP tools exposed

| Tool | What it does |
|---|---|
| `memory.remember(content, entities?)` | Save a memory. Auto-extracts entities if Anthropic key configured. |
| `memory.recall(query, k?, entity?)` | Two-stage retrieval: entity match → vector re-rank. |
| `memory.forget(noteIds[])` | Delete memories you own. |
| `memory.list_entities()` | All entities with note counts. |
| `memory.list_recent(k?)` | Most recent K memories. |
| `memory.tag(noteId, entity)` / `memory.untag(noteId, entityId)` | Adjust tags. |

## Other commands

```bash
npx spacetimedb-memory-mmo doctor   # diagnose installation issues
npx spacetimedb-memory-mmo reset    # remove local config and start over
```

## How it works

Inspired by [HippoRAG](https://arxiv.org/abs/2405.14831) (entity graph + PageRank-style retrieval),
[Graphiti / Zep](https://github.com/getzep/graphiti) (bi-temporal edges — Plan 4),
and [Mem0](https://mem0.ai/) (extract/update/delete memory operations).

Storage layer is [SpacetimeDB](https://spacetimedb.com) — a reactive relational DB
with built-in subscriptions. Multiple agents connect to the same module and see
each other's writes in real time, without needing a separate message bus.

See [docs/superpowers/plans/](./docs/superpowers/plans/) for the implementation roadmap.

## Status

- ✅ **Plan 1** — graph-memory backend
- ✅ **Plan 2** — MCP server with extraction + embeddings
- ✅ **Plan 3** — `npx` installer + npm publish
- 🔜 **Plan 4** — multi-agent ACLs + bi-temporal relations + PageRank retrieval
- 🔜 **Plan 5** — dashboard polish + scheduled community summarization

## Local development

```bash
git clone https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git
cd SpacetimeDB-Memory-MMO
npm install
spacetime start                            # in another terminal
npm run spacetime:publish:local            # publish module locally
npm run spacetime:generate                 # generate bindings
npm run dev --workspace spacetimedb-memory-mmo-dashboard   # browser UI
npm test                                   # full test suite (dashboard + mcp-server + cli)
```

## Packages (monorepo)

| Package | npm | Purpose |
|---|---|---|
| `spacetimedb-memory-mmo` | yes | CLI installer (`npx ...`) |
| `spacetimedb-memory-mmo-mcp-server` | yes | MCP server agents connect to |
| `spacetimedb-memory-mmo-module` | no | SpacetimeDB schema source (bundled in CLI) |
| `spacetimedb-memory-mmo-dashboard` | no | Optional React dashboard |

## License

Apache-2.0
