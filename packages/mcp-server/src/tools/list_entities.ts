import type { Conn } from '../connection.js';

export const LIST_ENTITIES_TOOL = {
  name: 'memory.list_entities',
  description: 'List all entities with note counts.',
  inputSchema: { type: 'object', properties: {} },
} as const;

export async function listEntities(
  conn: Conn
): Promise<{ entities: { id: string; name: string; count: number }[] }> {
  const db = conn.db as any;

  const counts = new Map<string, number>();
  for (const link of db.noteEntity.iter() as Iterable<{ entityId: bigint }>) {
    const k = link.entityId.toString();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const entities = ([...db.entity.iter()] as Array<{ id: bigint; name: string }>).map(e => ({
    id: e.id.toString(),
    name: e.name,
    count: counts.get(e.id.toString()) ?? 0,
  }));
  entities.sort((a, b) => b.count - a.count);
  return { entities };
}
