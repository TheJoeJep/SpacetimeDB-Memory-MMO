import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { commandExists, run } from '../lib/exec.js';

export async function runDoctor(): Promise<void> {
  const ok = (msg: string) => console.log(chalk.green('✓'), msg);
  const fail = (msg: string) => console.log(chalk.red('✗'), msg);
  const warn = (msg: string) => console.log(chalk.yellow('!'), msg);

  console.log(chalk.bold.cyan('\nspacetimedb-memory-mmo doctor\n'));

  if (await commandExists('spacetime')) {
    const v = await run('spacetime', ['--version'], { quiet: true });
    ok(`spacetime CLI: ${v.stdout.split('\n')[0]}`);
  } else {
    fail('spacetime CLI not found. Install: https://spacetimedb.com/install');
  }

  const marker = join(process.cwd(), '.spacetimedb-memory-mmo');
  if (!existsSync(marker)) {
    warn(`No .spacetimedb-memory-mmo/ here. Run \`npx spacetimedb-memory-mmo init\` first.`);
    return;
  }
  ok(`Found ${marker}`);

  const envPath = join(marker, '.env');
  if (!existsSync(envPath)) {
    fail(`Missing ${envPath}`);
    return;
  }
  ok(`.env present`);

  const env = Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#') && l.includes('='))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
  if (env.SPACETIMEDB_HOST) ok(`SPACETIMEDB_HOST=${env.SPACETIMEDB_HOST}`); else fail('SPACETIMEDB_HOST missing');
  if (env.SPACETIMEDB_DB_NAME) ok(`SPACETIMEDB_DB_NAME=${env.SPACETIMEDB_DB_NAME}`); else fail('SPACETIMEDB_DB_NAME missing');
  if (env.ANTHROPIC_API_KEY) ok('ANTHROPIC_API_KEY set'); else warn('No ANTHROPIC_API_KEY (entities must be passed manually)');
  if (env.VOYAGE_API_KEY) ok('VOYAGE_API_KEY set'); else warn('No VOYAGE_API_KEY (entity-only recall)');

  if (env.SPACETIMEDB_HOST?.includes('localhost') || env.SPACETIMEDB_HOST?.includes('127.0.0.1')) {
    try {
      await run('spacetime', ['list', '--server', 'local'], { quiet: true });
      ok('Local SpacetimeDB reachable');
    } catch {
      fail('Local SpacetimeDB not running. Start it with: spacetime start');
    }
  }

  console.log('');
}
