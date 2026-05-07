import type { Conn } from '../connection.js';

export const TAG_TOOL = {
  name: 'memory.tag',
  description: 'Add an entity tag to a memory you own.',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: { type: 'string' },
      entity: { type: 'string', minLength: 1 },
    },
    required: ['noteId', 'entity'],
  },
} as const;

export async function tag(
  conn: Conn,
  args: { noteId: string; entity: string }
): Promise<{ ok: true }> {
  await (conn.reducers as any).tagMemory({ noteId: BigInt(args.noteId), entityName: args.entity });
  return { ok: true };
}
