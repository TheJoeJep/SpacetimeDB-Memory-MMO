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

  void conn;
}

main().catch((err) => {
  process.stderr.write(`[mcp-server] FATAL: ${err.stack ?? err}\n`);
  process.exit(1);
});
