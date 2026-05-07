import spacetimedb, { agent, memoryNote } from './schema';
import { t, SenderError } from 'spacetimedb/server';

void agent;
void memoryNote;

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
    ctx.db.memoryNote.id.delete(noteId);
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
