# Changelog

## [0.0.1] - 2026-05-06

### Initial release

- Core graph-memory schema in SpacetimeDB (atomic notes + named entities + many-to-many links + embeddings + content-hash cache)
- MCP server with 7 tools: `remember`, `recall`, `forget`, `list_entities`, `list_recent`, `tag`, `untag`
- Optional Anthropic Haiku 4.5 entity extraction
- Optional Voyage embedding-based vector recall with content-hash cache
- Two-stage retrieval: entity match first, vector re-rank on candidate set
- `npx spacetimedb-memory-mmo init` interactive installer
- Supports local SpacetimeDB and Maincloud hosting (chosen at install time)
- Supports Claude Code and Cursor (more hosts via manual MCP config)
- `doctor` and `reset` commands

---

# Earlier (chat starter, archived)

This project was scaffolded from the SpacetimeDB TypeScript Quickstart Chat example (v0.0.1).
The chat application has been replaced by the compound memory system.
