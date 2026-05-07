import type { Conn } from '../connection.js';

export const UNTAG_TOOL = {
  name: 'memory.untag',
  description: 'Remove an entity tag from a memory you own.',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: { type: 'string' },
      entityId: { type: 'string' },
    },
    required: ['noteId', 'entityId'],
  },
} as const;

export async function untag(
  conn: Conn,
  args: { noteId: string; entityId: string }
): Promise<{ ok: true }> {
  const noteId = BigInt(args.noteId);
  await (conn.reducers as any).untagMemory({
    noteId,
    entityId: BigInt(args.entityId),
  });
  try {
    await (conn.reducers as any).recordMemoryAccess({ noteIds: [noteId], kind: 'untag' });
  } catch { /* ignore */ }
  return { ok: true };
}
