import type { Conn } from '../connection.js';

export const FORGET_TOOL = {
  name: 'memory.forget',
  description: 'Delete one or more memory notes by id (only your own).',
  inputSchema: {
    type: 'object',
    properties: {
      noteIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['noteIds'],
  },
} as const;

export async function forget(
  conn: Conn,
  args: { noteIds: string[] }
): Promise<{ deleted: number }> {
  let deleted = 0;
  for (const id of args.noteIds) {
    try {
      await (conn.reducers as any).deleteMemory({ noteId: BigInt(id) });
      deleted++;
    } catch {
      // skip: not found, not owned
    }
  }
  return { deleted };
}
