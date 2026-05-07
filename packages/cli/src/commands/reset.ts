import chalk from 'chalk';
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { confirm } from '@inquirer/prompts';

export async function runReset(): Promise<void> {
  const projectRoot = process.cwd();
  const marker = join(projectRoot, '.spacetimedb-memory-mmo');
  if (!existsSync(marker)) {
    console.log(chalk.gray('Nothing to reset (no .spacetimedb-memory-mmo/ here).'));
    return;
  }
  const ok = await confirm({
    message: `Remove ${marker}? Your remote SpacetimeDB module will NOT be deleted.`,
    default: false,
  });
  if (!ok) {
    console.log(chalk.gray('Aborted.'));
    return;
  }
  rmSync(marker, { recursive: true, force: true });
  console.log(chalk.green(`✓ Removed ${marker}`));

  for (const [dir, file] of [['.claude', 'settings.json'], ['.cursor', 'mcp.json']] as const) {
    const path = join(projectRoot, dir, file);
    if (!existsSync(path)) continue;
    try {
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as { mcpServers?: Record<string, unknown> };
      if (cfg.mcpServers && 'memory' in cfg.mcpServers) {
        delete cfg.mcpServers.memory;
        writeFileSync(path, JSON.stringify(cfg, null, 2));
        console.log(chalk.green(`✓ Removed memory entry from ${path}`));
      }
    } catch {
      // skip if not JSON
    }
  }
  console.log('');
  console.log(chalk.gray('Done. Run `npx spacetimedb-memory-mmo init` to set up again.'));
}
