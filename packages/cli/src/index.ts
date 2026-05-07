#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pkgVersion = '0.0.1';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
  pkgVersion = pkg.version;
} catch {
  // running from source — fall back to default
}

const program = new Command();
program
  .name('spacetimedb-memory-mmo')
  .description('Compound memory system for AI agents — install into any project folder')
  .version(pkgVersion);

program
  .command('init')
  .description('Initialize compound memory in the current folder')
  .action(async () => {
    const { runInit } = await import('./commands/init.js');
    await runInit();
  });

program
  .command('doctor')
  .description('Diagnose installation issues')
  .action(async () => {
    const { runDoctor } = await import('./commands/doctor.js');
    await runDoctor();
  });

program
  .command('reset')
  .description('Remove .spacetimedb-memory-mmo/ and start over')
  .action(async () => {
    const { runReset } = await import('./commands/reset.js');
    await runReset();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
