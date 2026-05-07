import type { Conn } from '../connection.js';
import type { Env } from '../env.js';
import { getEmbedding, cosineSimilarity } from '../embeddings.js';

export const RECALL_TOOL = {
  name: 'memory.recall',
  description:
    'Recall memories matching a query. Two-stage retrieval: entity match first ' +
    '(if `entity` provided), then vector similarity rank on the candidate set. ' +
    'Returns top `k` notes with their tags.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', minLength: 1 },
      k: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
      entity: { type: 'string', description: 'Optional: restrict to notes tagged with this entity' },
    },
    required: ['query'],
  },
} as const;

interface NoteOut {
  id: string;
  content: string;
  entities: string[];
  similarity: number | null;
  createdAt: string;
}

export async function recall(
  conn: Conn,
  args: { query: string; k?: number; entity?: string },
  env: Env
): Promise<{ notes: NoteOut[] }> {
  const k = args.k ?? 5;
  const db = conn.db as any;

  const allNotes = [...db.memoryNote.iter()] as Array<{
    id: bigint;
    content: string;
    createdAt: { microsSinceUnixEpoch: bigint };
    embedding?: number[];
  }>;
  const allEntities = [...db.entity.iter()] as Array<{ id: bigint; name: string }>;
  const allLinks = [...db.noteEntity.iter()] as Array<{ noteId: bigint; entityId: bigint }>;

  let candidates = allNotes;
  if (args.entity) {
    const ent = db.entity.name.find(args.entity.trim().toLowerCase()) as { id: bigint } | undefined;
    if (!ent) return { notes: [] };
    const noteIds = new Set(
      allLinks.filter(l => l.entityId === ent.id).map(l => l.noteId.toString())
    );
    candidates = allNotes.filter(n => noteIds.has(n.id.toString()));
  }

  const queryEmbedding = await getEmbedding(conn, env.voyageApiKey, env.embeddingModel, args.query);

  const ranked = candidates.map(n => {
    let sim: number | null = null;
    if (queryEmbedding && n.embedding) sim = cosineSimilarity(queryEmbedding, n.embedding);
    return { note: n, sim };
  });

  ranked.sort((a, b) => {
    if (a.sim !== null && b.sim !== null) return b.sim - a.sim;
    if (a.sim !== null) return -1;
    if (b.sim !== null) return 1;
    return Number(b.note.createdAt.microsSinceUnixEpoch - a.note.createdAt.microsSinceUnixEpoch);
  });

  const top = ranked.slice(0, k);

  const entityById = new Map(allEntities.map(e => [e.id.toString(), e.name]));
  const linksByNote = new Map<string, string[]>();
  for (const link of allLinks) {
    const k2 = link.noteId.toString();
    const name = entityById.get(link.entityId.toString());
    if (!name) continue;
    if (!linksByNote.has(k2)) linksByNote.set(k2, []);
    linksByNote.get(k2)!.push(name);
  }

  // Record access events for the returned notes so the dashboard can light them up
  const accessedIds = top.map(({ note }) => note.id);
  if (accessedIds.length > 0) {
    try {
      await (conn.reducers as any).recordMemoryAccess({ noteIds: accessedIds, kind: 'recall' });
    } catch {
      // Don't fail recall if access logging hits a transient error
    }
  }

  return {
    notes: top.map(({ note, sim }) => ({
      id: note.id.toString(),
      content: note.content,
      entities: linksByNote.get(note.id.toString()) ?? [],
      similarity: sim,
      createdAt: new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n)).toISOString(),
    })),
  };
}
