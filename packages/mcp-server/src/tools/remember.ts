import { randomUUID } from 'crypto';
import type { Conn } from '../connection.js';
import type { Env } from '../env.js';
import { extractEntities } from '../extraction.js';
import { getEmbedding } from '../embeddings.js';

export const REMEMBER_TOOL = {
  name: 'memory.remember',
  description:
    'Save a new memory note. If `entities` is omitted and an Anthropic key is configured, ' +
    'entities are auto-extracted via Haiku 4.5. If a Voyage key is configured, the content is embedded for vector recall. ' +
    'Returns the new note id.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', minLength: 1 },
      entities: { type: 'array', items: { type: 'string' } },
    },
    required: ['content'],
  },
} as const;

export async function remember(
  conn: Conn,
  args: { content: string; entities?: string[] },
  env: Env
): Promise<{
  noteId: string;
  clientToken: string;
  extractedEntities?: string[];
  embedded: boolean;
}> {
  const clientToken = randomUUID();
  let entities = args.entities;
  let extractedEntities: string[] | undefined;

  if (!entities && env.anthropicApiKey) {
    extractedEntities = await extractEntities(env.anthropicApiKey, args.content);
    entities = extractedEntities;
  }

  const embedding = await getEmbedding(conn, env.voyageApiKey, env.embeddingModel, args.content);

  await (conn.reducers as any).addMemoryWithEntities({
    content: args.content,
    entityNames: entities ?? [],
    embedding: embedding ?? undefined,
    clientToken,
  });

  // Brief settle time for subscription update
  await new Promise(r => setTimeout(r, 100));

  for (const row of (conn.db as any).memoryNote.iter() as Iterable<{ id: bigint; clientToken?: string }>) {
    if (row.clientToken === clientToken) {
      return {
        noteId: row.id.toString(),
        clientToken,
        extractedEntities,
        embedded: embedding !== null,
      };
    }
  }
  throw new Error('Note not found after insert (subscription not synced?)');
}
