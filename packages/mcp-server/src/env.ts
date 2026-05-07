import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';

if (process.env.DOTENV_CONFIG_PATH && existsSync(process.env.DOTENV_CONFIG_PATH)) {
  dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH });
}

export interface Env {
  spacetimedbHost: string;
  spacetimedbDbName: string;
  spacetimedbToken: string | undefined;
  anthropicApiKey: string | undefined;
  voyageApiKey: string | undefined;
  embeddingModel: string;
}

export function loadEnv(): Env {
  const host = process.env.SPACETIMEDB_HOST;
  const db = process.env.SPACETIMEDB_DB_NAME;
  if (!host) throw new Error('SPACETIMEDB_HOST not set (e.g. ws://localhost:3000 or wss://maincloud.spacetimedb.com)');
  if (!db) throw new Error('SPACETIMEDB_DB_NAME not set');
  return {
    spacetimedbHost: host,
    spacetimedbDbName: db,
    spacetimedbToken: process.env.SPACETIMEDB_TOKEN,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    voyageApiKey: process.env.VOYAGE_API_KEY,
    embeddingModel: process.env.VOYAGE_EMBEDDING_MODEL || 'voyage-3-lite',
  };
}
