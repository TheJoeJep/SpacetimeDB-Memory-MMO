import chalk from 'chalk';
import type { InitAnswers } from './prompts.js';
import type { ProvisionResult } from './provision_db.js';

export function printSummary(answers: InitAnswers, prov: ProvisionResult): void {
  console.log('\n' + chalk.bold.green('✓ Compound memory ready.'));
  console.log('');
  console.log(`  Backend:    ${chalk.cyan(answers.backend)}${answers.customHost ? ' (custom)' : ''}`);
  console.log(`  Module:     ${chalk.cyan(prov.databaseName)}`);
  console.log(`  Host:       ${chalk.cyan(prov.host)}`);
  console.log(`  AI hosts:   ${chalk.cyan(answers.hosts.length ? answers.hosts.join(', ') : '(none — manual config)')}`);
  console.log(`  Extraction: ${answers.anthropicApiKey ? chalk.green('Anthropic enabled') : chalk.gray('off')}`);
  console.log(`  Embeddings: ${answers.voyageApiKey ? chalk.green('Voyage enabled') : chalk.gray('off')}`);
  console.log('');

  if (answers.hosts.includes('claude-code')) {
    console.log(chalk.bold('Next:'));
    console.log(`  Open this folder in Claude Code. The ${chalk.cyan('memory.*')} tools will be available.`);
    console.log(`  Try: ${chalk.italic('"Remember that Alice prefers oat milk"')}`);
  } else if (answers.hosts.length === 0) {
    console.log(chalk.bold('Manual MCP config:'));
    console.log('  Add to your AI host MCP config:');
    console.log(chalk.gray('    {'));
    console.log(chalk.gray('      "command": "npx",'));
    console.log(chalk.gray('      "args": ["-y", "--package=spacetimedb-memory-mmo-mcp-server", "spacetimedb-memory-mmo-mcp"],'));
    console.log(chalk.gray(`      "env": { "DOTENV_CONFIG_PATH": "${process.cwd()}/.spacetimedb-memory-mmo/.env" }`));
    console.log(chalk.gray('    }'));
  }
  console.log('');
  console.log(chalk.gray(`Re-run anytime: npx spacetimedb-memory-mmo init`));
  console.log(chalk.gray(`Diagnose:        npx spacetimedb-memory-mmo doctor`));
  console.log('');
}
