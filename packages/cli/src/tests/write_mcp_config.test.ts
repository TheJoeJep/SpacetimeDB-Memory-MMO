import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeMcpConfig } from '../steps/write_mcp_config.js';

let dir: string;
const origCwd = process.cwd();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mcp-cfg-test-'));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(origCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('writeMcpConfig', () => {
  it('creates .claude/settings.json for claude-code host', () => {
    writeMcpConfig(['claude-code'], '/abs/path/.env');
    const path = join(dir, '.claude', 'settings.json');
    expect(existsSync(path)).toBe(true);
    const cfg = JSON.parse(readFileSync(path, 'utf8'));
    expect(cfg.mcpServers.memory.command).toBe('npx');
    expect(cfg.mcpServers.memory.env.DOTENV_CONFIG_PATH).toBe('/abs/path/.env');
  });

  it('merges into an existing .claude/settings.json', () => {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(
      join(dir, '.claude', 'settings.json'),
      JSON.stringify({ existingKey: 'keep', mcpServers: { other: { command: 'x', args: [] } } })
    );
    writeMcpConfig(['claude-code'], '/p/.env');
    const cfg = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
    expect(cfg.existingKey).toBe('keep');
    expect(cfg.mcpServers.other).toBeDefined();
    expect(cfg.mcpServers.memory).toBeDefined();
  });

  it('writes both hosts when both selected', () => {
    writeMcpConfig(['claude-code', 'cursor'], '/p/.env');
    expect(existsSync(join(dir, '.claude', 'settings.json'))).toBe(true);
    expect(existsSync(join(dir, '.cursor', 'mcp.json'))).toBe(true);
  });

  it('does nothing when hosts empty', () => {
    writeMcpConfig([], '/p/.env');
    expect(existsSync(join(dir, '.claude'))).toBe(false);
    expect(existsSync(join(dir, '.cursor'))).toBe(false);
  });
});
