import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import type { AiHost } from './prompts.js';

const MCP_NAME = 'memory';

interface McpEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfigShape {
  mcpServers?: Record<string, McpEntry>;
  [k: string]: unknown;
}

function buildEntry(envPath: string): McpEntry {
  return {
    command: 'npx',
    args: ['-y', '--package=spacetimedb-memory-mmo-mcp-server', 'spacetimedb-memory-mmo-mcp'],
    env: { DOTENV_CONFIG_PATH: envPath },
  };
}

export function writeMcpConfig(hosts: AiHost[], envPath: string): void {
  if (hosts.length === 0) {
    console.log(chalk.gray('Skipping MCP host configuration (user opted out)'));
    return;
  }

  const projectRoot = process.cwd();
  const entry = buildEntry(envPath);

  if (hosts.includes('claude-code')) {
    const claudeDir = join(projectRoot, '.claude');
    const path = join(claudeDir, 'settings.json');
    mkdirSync(claudeDir, { recursive: true });
    let cfg: McpConfigShape = {};
    if (existsSync(path)) {
      try {
        cfg = JSON.parse(readFileSync(path, 'utf8')) as McpConfigShape;
      } catch {
        console.log(chalk.yellow(`! ${path} is not valid JSON — backing up to ${path}.bak`));
        writeFileSync(`${path}.bak`, readFileSync(path));
        cfg = {};
      }
    }
    cfg.mcpServers = cfg.mcpServers ?? {};
    cfg.mcpServers[MCP_NAME] = entry;
    writeFileSync(path, JSON.stringify(cfg, null, 2));
    console.log(chalk.green(`✓ Configured Claude Code: ${path}`));
  }

  if (hosts.includes('cursor')) {
    const cursorDir = join(projectRoot, '.cursor');
    const path = join(cursorDir, 'mcp.json');
    mkdirSync(cursorDir, { recursive: true });
    let cfg: McpConfigShape = {};
    if (existsSync(path)) {
      try {
        cfg = JSON.parse(readFileSync(path, 'utf8')) as McpConfigShape;
      } catch {
        writeFileSync(`${path}.bak`, readFileSync(path));
        cfg = {};
      }
    }
    cfg.mcpServers = cfg.mcpServers ?? {};
    cfg.mcpServers[MCP_NAME] = entry;
    writeFileSync(path, JSON.stringify(cfg, null, 2));
    console.log(chalk.green(`✓ Configured Cursor: ${path}`));
  }
}
