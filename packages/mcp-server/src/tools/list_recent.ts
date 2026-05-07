import type { Conn } from '../connection.js';

export const LIST_RECENT_TOOL = {
  name: 'memory.list_recent',
  description: 'List the K most recent memories.',
  inputSchema: {
    type: 'object',
    properties: { k: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
  },
} as const;

export async function listRecent(
  conn: Conn,
  args: { k?: number }
): Promise<{ notes: { id: string; content: string; createdAt: string }[] }> {
  const k = args.k ?? 10;
  const db = conn.db as any;
  const notes = [...db.memoryNote.iter()] as Array<{
    id: bigint;
    content: string;
    createdAt: { microsSinceUnixEpoch: bigint };
  }>;
  notes.sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );
  return {
    notes: notes.slice(0, k).map(n => ({
      id: n.id.toString(),
      content: n.content,
      createdAt: new Date(Number(n.createdAt.microsSinceUnixEpoch / 1000n)).toISOString(),
    })),
  };
}
