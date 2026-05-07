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
}, 15000);

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

  it('returns empty array when entity does not exist', async () => {
    const result = await recall(conn, { query: 'anything', entity: 'nonexistent-entity-xyz' }, env);
    expect(result.notes).toEqual([]);
  });
});
