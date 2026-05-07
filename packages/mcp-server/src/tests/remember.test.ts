import { describe, it, expect, beforeAll } from 'vitest';
import { connectToSpacetime } from '../connection.js';
import { remember } from '../tools/remember.js';
import { listRecent } from '../tools/list_recent.js';
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

describe('memory.remember', () => {
  it('inserts a note with explicit entities and returns its id', async () => {
    const content = `Test memory ${Date.now()}`;
    const result = await remember(conn, { content, entities: ['testtag'] }, env);
    expect(result.noteId).toMatch(/^\d+$/);
    expect(result.embedded).toBe(false);
  });

  it('inserts a note with no entities when neither provided nor extractable', async () => {
    const content = `Plain memory ${Date.now()}`;
    const result = await remember(conn, { content }, env);
    expect(result.noteId).toMatch(/^\d+$/);
    expect(result.extractedEntities).toBeUndefined();
  });

  it('stored memories are retrievable via list_recent', async () => {
    const marker = `Marker ${Date.now()}`;
    await remember(conn, { content: marker, entities: [] }, env);
    await new Promise(r => setTimeout(r, 200));
    const result = await listRecent(conn, { k: 5 });
    const found = result.notes.some(n => n.content === marker);
    expect(found).toBe(true);
  });
});
