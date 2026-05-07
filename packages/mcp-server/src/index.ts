#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadEnv } from './env.js';
import { connectToSpacetime } from './connection.js';
import { REMEMBER_TOOL, remember } from './tools/remember.js';
import { RECALL_TOOL, recall } from './tools/recall.js';
import { FORGET_TOOL, forget } from './tools/forget.js';
import { LIST_ENTITIES_TOOL, listEntities } from './tools/list_entities.js';
import { LIST_RECENT_TOOL, listRecent } from './tools/list_recent.js';
import { TAG_TOOL, tag } from './tools/tag.js';
import { UNTAG_TOOL, untag } from './tools/untag.js';

async function main() {
  const env = loadEnv();
  const conn = await connectToSpacetime(env);
  process.stderr.write(`[mcp-server] Connected to SpacetimeDB at ${env.spacetimedbHost}/${env.spacetimedbDbName}\n`);

  const server = new Server(
    { name: 'spacetimedb-memory-mmo', version: '0.0.1' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      switch (name) {
        case 'memory.remember': {
          const result = await remember(conn, args as { content: string; entities?: string[] }, env);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
        case 'memory.recall': {
          const result = await recall(conn, args as { query: string; k?: number; entity?: string }, env);
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        }
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[mcp-server] Listening on stdio (7 tools)\n`);

  void conn;
}

main().catch((err) => {
  process.stderr.write(`[mcp-server] FATAL: ${err.stack ?? err}\n`);
  process.exit(1);
});
