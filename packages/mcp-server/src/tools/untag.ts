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
  await (conn.reducers as any).untagMemory({
    noteId: BigInt(args.noteId),
    entityId: BigInt(args.entityId),
  });
  return { ok: true };
}
