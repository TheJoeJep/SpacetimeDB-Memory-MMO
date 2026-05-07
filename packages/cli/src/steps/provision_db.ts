import chalk from 'chalk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { run, commandExists } from '../lib/exec.js';
import type { InitAnswers } from './prompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ProvisionResult {
  host: string;
  databaseName: string;
  modulePath: string;
}

export async function provisionDb(answers: InitAnswers): Promise<ProvisionResult> {
  if (!(await commandExists('spacetime'))) {
    throw new Error('spacetime CLI not found. Install from https://spacetimedb.com/install');
  }

  const host =
    answers.customHost ??
    (answers.backend === 'local'
      ? 'ws://localhost:3000'
      : 'wss://maincloud.spacetimedb.com');

  const modulePath = resolve(__dirname, '..', 'templates', 'spacetime-module');

  if (answers.mode === 'new') {
    console.log(chalk.cyan(`\nProvisioning new module ${answers.databaseName} on ${answers.backend}...`));
    const server = answers.backend === 'maincloud' ? 'maincloud' : 'local';
    if (answers.backend === 'maincloud') {
      try {
        await run('spacetime', ['login', 'show'], { quiet: true });
      } catch {
        throw new Error('Not logged in to maincloud. Run `spacetime login` then re-run this command.');
      }
    }
    await run('spacetime', [
      'publish',
      answers.databaseName,
      '--module-path', modulePath,
      '--server', server,
      '--clear-database', '-y',
    ]);
    console.log(chalk.green(`✓ Module ${answers.databaseName} published`));
  } else {
    console.log(chalk.cyan(`\nUsing existing module ${answers.databaseName} at ${host}`));
  }

  return { host, databaseName: answers.databaseName, modulePath };
}
