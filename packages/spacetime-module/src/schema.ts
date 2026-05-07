import { schema, t, table } from 'spacetimedb/server';

export const agent = table(
  { name: 'agent', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string().optional(),
    registeredAt: t.timestamp(),
  }
);

export const memoryNote = table(
  {
    name: 'memory_note',
    public: true,
    indexes: [
      { accessor: 'addedBy', algorithm: 'btree', columns: ['addedBy'] },
      { accessor: 'clientToken', algorithm: 'btree', columns: ['clientToken'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    content: t.string(),
    addedBy: t.identity(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
    embedding: t.array(t.f32()).optional(),
    clientToken: t.string().optional(),
  }
);

export const entity = table(
  { name: 'entity', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string().unique(),
    kind: t.string().optional(),
    createdAt: t.timestamp(),
    embedding: t.array(t.f32()).optional(),
  }
);

export const noteEntity = table(
  {
    name: 'note_entity',
    public: true,
    indexes: [
      { accessor: 'noteId', algorithm: 'btree', columns: ['noteId'] },
      { accessor: 'entityId', algorithm: 'btree', columns: ['entityId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    noteId: t.u64(),
    entityId: t.u64(),
  }
);

export const embeddingCache = table(
  { name: 'embedding_cache', public: true },
  {
    contentHash: t.string().primaryKey(),
    embedding: t.array(t.f32()),
    model: t.string(),
    createdAt: t.timestamp(),
  }
);

// Tracks which agent accessed which memory and how. Subscribed by the dashboard
// to drive the live "agent X is reading memory Y" pulse animations.
// `kind` values: 'remember' | 'recall' | 'list_recent' | 'tag' | 'untag' | 'view'
export const memoryAccess = table(
  {
    name: 'memory_access',
    public: true,
    indexes: [
      { accessor: 'noteId', algorithm: 'btree', columns: ['noteId'] },
      { accessor: 'agentId', algorithm: 'btree', columns: ['agentId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    noteId: t.u64(),
    agentId: t.identity(),
    kind: t.string(),
    accessedAt: t.timestamp(),
  }
);

const spacetimedb = schema({ agent, memoryNote, entity, noteEntity, embeddingCache, memoryAccess });
export default spacetimedb;
