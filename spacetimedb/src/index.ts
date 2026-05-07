import spacetimedb, { agent } from './schema';
import { t, SenderError } from 'spacetimedb/server';

void agent;

export const set_agent_name = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name.trim()) throw new SenderError('Name must not be empty');
    const existing = ctx.db.agent.identity.find(ctx.sender);
    if (!existing) throw new SenderError('Agent not registered');
    ctx.db.agent.identity.update({ ...existing, name });
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
