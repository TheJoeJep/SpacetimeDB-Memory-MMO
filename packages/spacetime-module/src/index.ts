import spacetimedb, { agent, memoryNote, entity, noteEntity, embeddingCache, memoryAccess } from './schema';
import { t, SenderError } from 'spacetimedb/server';

void agent;
void memoryNote;
void entity;
void noteEntity;
void embeddingCache;
void memoryAccess;

function findOrCreateEntity(ctx: any, rawName: string): bigint {
  const name = rawName.trim().toLowerCase();
  if (!name) throw new SenderError('Entity name must not be empty');
  const existing = ctx.db.entity.name.find(name);
  if (existing) return existing.id;
  const created = ctx.db.entity.insert({
    id: 0n,
    name,
    kind: undefined,
    createdAt: ctx.timestamp,
    embedding: undefined,
  });
  return created.id;
}

export const set_agent_name = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name.trim()) throw new SenderError('Name must not be empty');
    const existing = ctx.db.agent.identity.find(ctx.sender);
    if (!existing) throw new SenderError('Agent not registered');
    ctx.db.agent.identity.update({ ...existing, name });
  }
);

export const add_memory = spacetimedb.reducer(
  { content: t.string() },
  (ctx, { content }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    ctx.db.memoryNote.insert({
      id: 0n,
      content: trimmed,
      addedBy: ctx.sender,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
      embedding: undefined,
      clientToken: undefined,
    });
  }
);

export const add_memory_with_entities = spacetimedb.reducer(
  {
    content: t.string(),
    entityNames: t.array(t.string()),
    embedding: t.array(t.f32()).optional(),
    clientToken: t.string().optional(),
  },
  (ctx, { content, entityNames, embedding, clientToken }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    const note = ctx.db.memoryNote.insert({
      id: 0n,
      content: trimmed,
      addedBy: ctx.sender,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
      embedding,
      clientToken,
    });
    const seen = new Set<string>();
    for (const raw of entityNames) {
      const norm = raw.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      const entityId = findOrCreateEntity(ctx, norm);
      ctx.db.noteEntity.insert({ id: 0n, noteId: note.id, entityId });
    }
  }
);

export const update_memory = spacetimedb.reducer(
  { noteId: t.u64(), content: t.string() },
  (ctx, { noteId, content }) => {
    const trimmed = content.trim();
    if (!trimmed) throw new SenderError('Memory content must not be empty');
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot edit another agent's memory");
    }
    ctx.db.memoryNote.id.update({
      ...existing,
      content: trimmed,
      updatedAt: ctx.timestamp,
    });
  }
);

export const delete_memory = spacetimedb.reducer(
  { noteId: t.u64() },
  (ctx, { noteId }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot delete another agent's memory");
    }
    for (const link of [...ctx.db.noteEntity.noteId.filter(noteId)]) {
      ctx.db.noteEntity.id.delete(link.id);
    }
    ctx.db.memoryNote.id.delete(noteId);
  }
);

export const tag_memory = spacetimedb.reducer(
  { noteId: t.u64(), entityName: t.string() },
  (ctx, { noteId, entityName }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot tag another agent's memory");
    }
    const entityId = findOrCreateEntity(ctx, entityName);
    const alreadyLinked = [...ctx.db.noteEntity.noteId.filter(noteId)]
      .some((link: { entityId: bigint }) => link.entityId === entityId);
    if (alreadyLinked) return;
    ctx.db.noteEntity.insert({ id: 0n, noteId, entityId });
  }
);

export const untag_memory = spacetimedb.reducer(
  { noteId: t.u64(), entityId: t.u64() },
  (ctx, { noteId, entityId }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot untag another agent's memory");
    }
    for (const link of [...ctx.db.noteEntity.noteId.filter(noteId)]) {
      if (link.entityId === entityId) ctx.db.noteEntity.id.delete(link.id);
    }
  }
);

export const set_memory_embedding = spacetimedb.reducer(
  { noteId: t.u64(), embedding: t.array(t.f32()) },
  (ctx, { noteId, embedding }) => {
    const existing = ctx.db.memoryNote.id.find(noteId);
    if (!existing) throw new SenderError('Memory not found');
    if (!existing.addedBy.isEqual(ctx.sender)) {
      throw new SenderError("Cannot embed another agent's memory");
    }
    ctx.db.memoryNote.id.update({ ...existing, embedding, updatedAt: ctx.timestamp });
  }
);

export const set_entity_embedding = spacetimedb.reducer(
  { entityId: t.u64(), embedding: t.array(t.f32()) },
  (ctx, { entityId, embedding }) => {
    const existing = ctx.db.entity.id.find(entityId);
    if (!existing) throw new SenderError('Entity not found');
    ctx.db.entity.id.update({ ...existing, embedding });
  }
);

export const record_memory_access = spacetimedb.reducer(
  { noteIds: t.array(t.u64()), kind: t.string() },
  (ctx, { noteIds, kind }) => {
    if (!kind.trim()) throw new SenderError('access kind required');
    for (const noteId of noteIds) {
      // skip silently if the note vanished
      const exists = ctx.db.memoryNote.id.find(noteId);
      if (!exists) continue;
      ctx.db.memoryAccess.insert({
        id: 0n,
        noteId,
        agentId: ctx.sender,
        kind: kind.toLowerCase(),
        accessedAt: ctx.timestamp,
      });
    }
  }
);

export const cache_embedding = spacetimedb.reducer(
  { contentHash: t.string(), embedding: t.array(t.f32()), model: t.string() },
  (ctx, { contentHash, embedding, model }) => {
    const existing = ctx.db.embeddingCache.contentHash.find(contentHash);
    if (existing) return;
    ctx.db.embeddingCache.insert({
      contentHash,
      embedding,
      model,
      createdAt: ctx.timestamp,
    });
  }
);

export const init = spacetimedb.init(_ctx => {});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const existing = ctx.db.agent.identity.find(ctx.sender);
  if (existing) return;
  ctx.db.agent.insert({
    identity: ctx.sender,
    name: undefined,
    registeredAt: ctx.timestamp,
  });
});

export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {});

export default spacetimedb;
