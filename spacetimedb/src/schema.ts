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

const spacetimedb = schema({ agent, memoryNote });
export default spacetimedb;
