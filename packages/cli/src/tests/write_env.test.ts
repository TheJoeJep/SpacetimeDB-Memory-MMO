import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeEnv } from '../steps/write_env.js';
import type { InitAnswers } from '../steps/prompts.js';

let dir: string;
const origCwd = process.cwd();

const baseAnswers: InitAnswers = {
  mode: 'new',
  backend: 'local',
  databaseName: 'test-db',
  hosts: [],
  voyageEmbeddingModel: 'voyage-3-lite',
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'memmmo-test-'));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(origCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('writeEnv', () => {
  it('creates marker dir, .env, config.json, README, and .gitignore', () => {
    const result = writeEnv(
      { ...baseAnswers, anthropicApiKey: 'sk-ant-test', voyageApiKey: 'pa-test' },
      { host: 'ws://localhost:3000', databaseName: 'test-db', modulePath: '' }
    );

    expect(existsSync(result.envPath)).toBe(true);
    const env = readFileSync(result.envPath, 'utf8');
    expect(env).toContain('SPACETIMEDB_HOST=ws://localhost:3000');
    expect(env).toContain('SPACETIMEDB_DB_NAME=test-db');
    expect(env).toContain('ANTHROPIC_API_KEY=sk-ant-test');
    expect(env).toContain('VOYAGE_API_KEY=pa-test');

    expect(existsSync(join(dir, '.gitignore'))).toBe(true);
    expect(readFileSync(join(dir, '.gitignore'), 'utf8'))
      .toContain('.spacetimedb-memory-mmo/');
  });

  it('appends to existing .gitignore without duplicating', () => {
    writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    writeEnv(baseAnswers, { host: 'ws://localhost:3000', databaseName: 'test-db', modulePath: '' });
    let ignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('.spacetimedb-memory-mmo/');
    // run again — should not double-add
    writeEnv(baseAnswers, { host: 'h', databaseName: 'x', modulePath: '' });
    ignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(ignore.match(/\.spacetimedb-memory-mmo\//g)?.length).toBe(1);
  });
});
