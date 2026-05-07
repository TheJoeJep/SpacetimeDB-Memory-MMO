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
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    content: t.string(),
    addedBy: t.identity(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  }
);

export const entity = table(
  { name: 'entity', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string().unique(),
    kind: t.string().optional(),
    createdAt: t.timestamp(),
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

const spacetimedb = schema({ agent, memoryNote, entity, noteEntity });
export default spacetimedb;
