import chalk from 'chalk';
import { runPrompts } from '../steps/prompts.js';
import { provisionDb } from '../steps/provision_db.js';
import { writeEnv } from '../steps/write_env.js';
import { writeMcpConfig } from '../steps/write_mcp_config.js';
import { printSummary } from '../steps/final_summary.js';

export async function runInit(): Promise<void> {
  console.log(chalk.bold.cyan('\nSpacetimeDB Memory MMO — interactive setup\n'));
  const answers = await runPrompts();
  const provision = await provisionDb(answers);
  const written = writeEnv(answers, provision);
  writeMcpConfig(answers.hosts, written.envPath);
  printSummary(answers, provision);
}
