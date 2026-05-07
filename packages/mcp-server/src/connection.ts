import { DbConnection } from './module_bindings/index.js';
import type { Env } from './env.js';

export type Conn = InstanceType<typeof DbConnection>;

export async function connectToSpacetime(env: Env): Promise<Conn> {
  return await new Promise<Conn>((resolve, reject) => {
    let resolved = false;
    const builder = DbConnection.builder()
      .withUri(env.spacetimedbHost)
      .withDatabaseName(env.spacetimedbDbName)
      .onConnect((conn, _identity, _token) => {
        if (resolved) return;
        resolved = true;
        // Subscribe to all tables, then resolve once subscription is applied so
        // the local cache is populated before any query runs.
        conn
          .subscriptionBuilder()
          .onApplied(() => resolve(conn))
          .onError((ctx) => reject(new Error(`Subscription error: ${JSON.stringify(ctx.event)}`)))
          .subscribeToAllTables();
      })
      .onConnectError((_ctx, err) => {
        if (resolved) return;
        resolved = true;
        reject(err);
      });

    if (env.spacetimedbToken) {
      builder.withToken(env.spacetimedbToken);
    }
    builder.build();
  });
}
