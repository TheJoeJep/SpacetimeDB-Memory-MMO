# Plan 3 — `npx` CLI Installer + npm Publish + GitHub Release

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the system installable into any folder on any machine with one command:

```bash
npx spacetimedb-memory-mmo init
```

The installer asks 4-6 questions, provisions a SpacetimeDB module (local OR maincloud, new OR existing), captures API keys, generates the MCP config for the user's AI host (Claude Code, Cursor, both, or skip), and prints next steps. After publish to npm, anyone can run the command without cloning the repo.

**Architecture:**
- New workspace: `packages/cli` — a TypeScript Node CLI built with `commander` for arg parsing, `@inquirer/prompts` for interactive prompts, `chalk` for colored output.
- The CLI is published to npm with `bin: { "spacetimedb-memory-mmo": "dist/index.js" }`. `npx` resolves it.
- The CLI does NOT bundle the MCP server source — instead it depends on `@spacetimedb-memory-mmo/mcp-server` (also published to npm). Users get both packages via the dependency.
- Or — simpler initial v3 — the CLI is the **only** published package and it bundles everything (mcp-server source + spacetime-module source) inside its `files/` and writes them on init. We'll start with the simpler bundled approach.
- After init, the user's project has a `.spacetimedb-memory-mmo/` directory containing the MCP server config, generated bindings, and a `.env` template. The MCP server runs from a global install path (`npx`) but reads the local project's `.env`.

**Tech Stack:** Node 20+, TypeScript, `commander` (CLI args), `@inquirer/prompts` (interactive Q&A), `chalk` (colors), `execa` (subprocess for `spacetime` CLI calls), `dotenv` (read/write env files).

**Scope split note:** This plan does NOT cover:
- Multi-agent ACLs / temporal / PageRank (Plan 4)
- Auto-update detection on subsequent `npx` runs (Plan 5)
- Telemetry / usage analytics (deliberately out of scope — privacy-respecting OSS)

---

## Prerequisites (verify before Task 1)

- [ ] **P-1:** Plan 2 fully complete and pushed to GitHub. The MCP server is functional locally.
- [ ] **P-2:** User has an npm account and is logged in: `npm whoami` returns the username. If not: `npm login`.
- [ ] **P-3:** The `spacetimedb-memory-mmo` name is available on npm: `npm view spacetimedb-memory-mmo` should error with "404". If it returns metadata, the name is taken — pick another.

---

## File structure (additions in this plan)

```
packages/
└── cli/                                # NEW
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── src/
        ├── index.ts                    # CLI entry point + commander setup
        ├── commands/
        │   ├── init.ts                 # `init` subcommand — main install flow
        │   ├── reset.ts                # `reset` — clear local state, re-init
        │   └── doctor.ts               # `doctor` — diagnose connection issues
        ├── steps/
        │   ├── prompts.ts              # all interactive prompts
        │   ├── detect_host.ts          # detect .claude/.cursor/etc.
        │   ├── provision_db.ts         # publish + generate against local or maincloud
        │   ├── write_env.ts            # write .env in project root
        │   ├── write_mcp_config.ts     # write MCP server config for chosen host(s)
        │   └── final_summary.ts        # print next-steps
        ├── lib/
        │   ├── exec.ts                 # safe subprocess wrapper around `spacetime` CLI
        │   ├── paths.ts                # resolve user project root, our install dir
        │   └── version.ts              # read package version
        └── tests/
            ├── prompts.test.ts
            ├── detect_host.test.ts
            └── write_mcp_config.test.ts

# In each user's project (after they run `npx spacetimedb-memory-mmo init`):
.spacetimedb-memory-mmo/                # marker dir for "we've initialized here"
├── .env                                # secrets — gitignored by us via auto-edit
├── config.json                         # canonical record of choices made
└── README.md                           # what this directory is, how to re-run init
```

---

## Task 1 — Scaffold `packages/cli` workspace

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/README.md`
- Create: `packages/cli/src/index.ts`
- Modify: root `package.json` (add cli to `npm run build` rotation — workspaces auto-include `packages/*` so usually nothing needed)

**Goal:** Empty CLI shell that prints `--version` and `--help`. Sanity check that the workspace is wired up.

- [ ] **Step 1.1: Create `packages/cli/package.json`.**

```json
{
  "name": "spacetimedb-memory-mmo",
  "version": "0.0.1",
  "description": "Multi-agent compound memory for AI agents, backed by SpacetimeDB",
  "license": "MIT",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "spacetimedb-memory-mmo": "dist/index.js"
  },
  "files": [
    "dist",
    "templates",
    "README.md",
    "LICENSE"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git"
  },
  "homepage": "https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO#readme",
  "bugs": {
    "url": "https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO/issues"
  },
  "keywords": [
    "spacetimedb",
    "memory",
    "mcp",
    "ai-agents",
    "claude",
    "cursor",
    "compound-memory"
  ],
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "execa": "^9.0.0",
    "dotenv": "^16.4.0",
    "@spacetimedb-memory-mmo/mcp-server": "0.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.0"
  }
}
```

> **Note on the mcp-server dep:** During development we use `0.0.1` and rely on workspace-symlink resolution. Before npm publish (Task 9), the version is bumped and the dep becomes a real published version.

- [ ] **Step 1.2: Create `packages/cli/tsconfig.json`.**

Same as `mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 1.3: Create `packages/cli/src/index.ts` (entry skeleton).**

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
) as { version: string };

const program = new Command();
program
  .name('spacetimedb-memory-mmo')
  .description('Compound memory system for AI agents — install into any project folder')
  .version(pkg.version);

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
```

- [ ] **Step 1.4: Create stub command files so the build passes.**

Create `packages/cli/src/commands/init.ts`:

```typescript
import chalk from 'chalk';

export async function runInit(): Promise<void> {
  console.log(chalk.yellow('init: not yet implemented'));
}
```

Create `packages/cli/src/commands/doctor.ts`:

```typescript
import chalk from 'chalk';

export async function runDoctor(): Promise<void> {
  console.log(chalk.yellow('doctor: not yet implemented'));
}
```

Create `packages/cli/src/commands/reset.ts`:

```typescript
import chalk from 'chalk';

export async function runReset(): Promise<void> {
  console.log(chalk.yellow('reset: not yet implemented'));
}
```

- [ ] **Step 1.5: Create `packages/cli/README.md`.**

```markdown
# spacetimedb-memory-mmo

CLI installer for the SpacetimeDB Memory MMO compound memory system.

```bash
npx spacetimedb-memory-mmo init    # interactive setup in current folder
npx spacetimedb-memory-mmo doctor  # diagnose issues
npx spacetimedb-memory-mmo reset   # remove all local state and start over
```

See the [main README](https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO) for project context.
```

- [ ] **Step 1.6: Install + build.**

From repo root:

```bash
npm install
npm run build --workspace spacetimedb-memory-mmo
```

Expected: `packages/cli/dist/` populated.

- [ ] **Step 1.7: Smoke-test the CLI.**

```bash
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js init
```

Expected:
- `--version` prints `0.0.1`
- `--help` lists `init`, `doctor`, `reset`
- `init` prints "init: not yet implemented" in yellow

- [ ] **Step 1.8: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): scaffold spacetimedb-memory-mmo CLI workspace"
git push
```

---

## Task 2 — `init` flow: interactive prompts

**Files:**
- Create: `packages/cli/src/steps/prompts.ts`
- Modify: `packages/cli/src/commands/init.ts` (call prompts, log answers)

**Goal:** Prompts run end-to-end. No DB provisioning yet — we just collect answers. Verify the UX feels right by running `init` and stepping through.

- [ ] **Step 2.1: Create `packages/cli/src/steps/prompts.ts`.**

```typescript
import { input, password, select, confirm } from '@inquirer/prompts';

export interface InitAnswers {
  mode: 'new' | 'existing';
  backend: 'local' | 'maincloud';
  databaseName: string;
  customHost?: string;          // only set if user chose "Custom URI" for existing
  hosts: AiHost[];              // can be empty if user picks "skip"
  anthropicApiKey?: string;
  voyageApiKey?: string;
  voyageEmbeddingModel: string;
}

export type AiHost = 'claude-code' | 'cursor';

export async function runPrompts(): Promise<InitAnswers> {
  const mode = (await select({
    message: 'What do you want to do?',
    choices: [
      { name: 'Set up a new memory system (recommended)', value: 'new' },
      { name: 'Connect to an existing memory system', value: 'existing' },
    ],
    default: 'new',
  })) as 'new' | 'existing';

  let backend: 'local' | 'maincloud';
  let customHost: string | undefined;

  if (mode === 'new') {
    backend = (await select({
      message: 'Where should it live?',
      choices: [
        { name: 'Local — runs on this machine, fully private (recommended)', value: 'local' },
        { name: 'Maincloud — hosted by SpacetimeDB, syncs across machines', value: 'maincloud' },
      ],
      default: 'local',
    })) as 'local' | 'maincloud';
  } else {
    backend = (await select({
      message: 'Existing system address?',
      choices: [
        { name: 'Local at ws://localhost:3000', value: 'local' },
        { name: 'Maincloud at wss://maincloud.spacetimedb.com', value: 'maincloud' },
        { name: 'Custom URI', value: 'custom' },
      ],
    })) as 'local' | 'maincloud';
    if ((backend as string) === 'custom') {
      customHost = await input({
        message: 'Custom WebSocket URI (e.g. ws://192.168.1.10:3000):',
        validate: (v) => /^wss?:\/\//.test(v) || 'Must start with ws:// or wss://',
      });
      backend = 'local'; // host overridden by customHost
    }
  }

  const databaseName = await input({
    message: mode === 'new' ? 'Name for the new memory module:' : 'Existing module name:',
    default: mode === 'new' ? `compound-memory-${slugifyCwd()}` : undefined,
    validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, dashes only',
  });

  const hostChoices = (await select<'claude-code' | 'cursor' | 'both' | 'skip'>({
    message: 'Which AI host should I configure?',
    choices: [
      { name: 'Claude Code (.claude/settings.json)', value: 'claude-code' },
      { name: 'Cursor (.cursor/mcp.json)', value: 'cursor' },
      { name: 'Both', value: 'both' },
      { name: "Skip — I'll wire it up myself", value: 'skip' },
    ],
    default: 'claude-code',
  }));

  const hosts: AiHost[] =
    hostChoices === 'both' ? ['claude-code', 'cursor']
    : hostChoices === 'skip' ? []
    : [hostChoices];

  // API keys
  const wantAnthropic = await confirm({
    message: 'Add Anthropic API key for automatic entity extraction? (recommended)',
    default: true,
  });
  let anthropicApiKey: string | undefined;
  if (wantAnthropic) {
    anthropicApiKey = await password({
      message: 'Anthropic API key (sk-ant-...):',
      validate: (v) => v.startsWith('sk-ant-') || 'Should start with sk-ant-',
      mask: '*',
    });
  }

  const wantVoyage = await confirm({
    message: 'Add Voyage API key for vector recall? (recommended — pennies per million memories)',
    default: true,
  });
  let voyageApiKey: string | undefined;
  let voyageEmbeddingModel = 'voyage-3-lite';
  if (wantVoyage) {
    voyageApiKey = await password({
      message: 'Voyage API key (pa-...):',
      validate: (v) => v.startsWith('pa-') || 'Should start with pa-',
      mask: '*',
    });
    voyageEmbeddingModel = await input({
      message: 'Voyage embedding model:',
      default: 'voyage-3-lite',
    });
  }

  return {
    mode,
    backend,
    databaseName,
    customHost,
    hosts,
    anthropicApiKey,
    voyageApiKey,
    voyageEmbeddingModel,
  };
}

function slugifyCwd(): string {
  const cwd = process.cwd();
  const name = cwd.split(/[/\\]/).pop() ?? 'project';
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24);
}
```

- [ ] **Step 2.2: Wire prompts into `init.ts`.**

Replace `packages/cli/src/commands/init.ts` with:

```typescript
import chalk from 'chalk';
import { runPrompts } from '../steps/prompts.js';

export async function runInit(): Promise<void> {
  console.log(chalk.bold.cyan('\nSpacetimeDB Memory MMO — interactive setup\n'));
  const answers = await runPrompts();
  console.log('\n' + chalk.gray('Choices:'));
  console.log(chalk.gray(JSON.stringify({ ...answers, anthropicApiKey: answers.anthropicApiKey ? '<redacted>' : undefined, voyageApiKey: answers.voyageApiKey ? '<redacted>' : undefined }, null, 2)));
  console.log(chalk.yellow('\n(Provisioning + config writing not yet implemented — Task 3+)'));
}
```

- [ ] **Step 2.3: Build + run init manually.**

```bash
npm run build --workspace spacetimedb-memory-mmo
node packages/cli/dist/index.js init
```

Expected: prompts run interactively. Step through with default answers. At the end, the redacted answers print. Run with skip-host + skip-keys path too — should also complete cleanly.

- [ ] **Step 2.4: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): interactive prompts for init flow"
git push
```

---

## Task 3 — DB provisioning step (local + maincloud)

**Files:**
- Create: `packages/cli/src/lib/exec.ts`
- Create: `packages/cli/src/steps/provision_db.ts`
- Modify: `packages/cli/src/commands/init.ts` (call provisioning)

**Goal:** Run `spacetime publish` and `spacetime generate` against the chosen target. Handle the "existing" mode by skipping publish.

- [ ] **Step 3.1: Create `packages/cli/src/lib/exec.ts`.**

```typescript
import { execa } from 'execa';
import chalk from 'chalk';

export async function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; quiet?: boolean } = {}
): Promise<{ stdout: string; stderr: string }> {
  if (!opts.quiet) {
    console.log(chalk.gray(`$ ${cmd} ${args.join(' ')}`));
  }
  try {
    const result = await execa(cmd, args, { cwd: opts.cwd, all: true });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    throw new Error(
      `Command failed: ${cmd} ${args.join(' ')}\n` +
      `${e.stderr ?? ''}\n${e.stdout ?? ''}\n${e.message}`
    );
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execa(cmd, ['--version']);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3.2: Create `packages/cli/src/steps/provision_db.ts`.**

```typescript
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
    throw new Error(
      'spacetime CLI not found. Install from https://spacetimedb.com/install'
    );
  }

  const host =
    answers.customHost ??
    (answers.backend === 'local'
      ? 'ws://localhost:3000'
      : 'wss://maincloud.spacetimedb.com');

  // Find the bundled spacetime-module template inside our installed package.
  // Layout when published: <node_modules>/spacetimedb-memory-mmo/templates/spacetime-module/
  // Layout in dev: <repo>/packages/cli/dist/../../../packages/spacetime-module
  const modulePath = resolve(__dirname, '..', '..', 'templates', 'spacetime-module');

  if (answers.mode === 'new') {
    console.log(chalk.cyan(`\nProvisioning new module ${answers.databaseName} on ${answers.backend}...`));
    const server = answers.backend === 'maincloud' ? 'maincloud' : 'local';
    if (answers.backend === 'maincloud') {
      // Verify login
      try {
        await run('spacetime', ['login', 'show'], { quiet: true });
      } catch {
        console.log(chalk.yellow('\nNot logged in to maincloud. Run `spacetime login` and then re-run `init`.'));
        throw new Error('spacetime login required');
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
```

- [ ] **Step 3.3: Add the spacetime-module template to the CLI package.**

The CLI needs to ship the spacetime-module source so users without our git repo can publish it. We do this via a `prepublishOnly` script that copies `packages/spacetime-module` into `packages/cli/templates/spacetime-module` during build.

Modify `packages/cli/package.json` `scripts`:

```json
  "scripts": {
    "build": "tsc && npm run sync:templates",
    "sync:templates": "rm -rf templates && cp -r ../spacetime-module templates/spacetime-module || (mkdir -p templates && xcopy /E /I ..\\spacetime-module templates\\spacetime-module)",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run"
  },
```

> **Note for cross-platform:** The `sync:templates` script tries `cp -r` first (POSIX) and falls back to `xcopy` (Windows). On Windows in PowerShell with Git Bash available, the first cmd works. If both fail, use a Node-based copy script instead — see fallback below.

> **Fallback:** If platform-shell variants are flaky, replace `sync:templates` with a Node script. Create `packages/cli/scripts/sync-templates.mjs`:
> ```javascript
> import { cpSync, rmSync, mkdirSync } from 'fs';
> import { resolve, dirname } from 'path';
> import { fileURLToPath } from 'url';
> const __dirname = dirname(fileURLToPath(import.meta.url));
> const src = resolve(__dirname, '..', '..', 'spacetime-module');
> const dst = resolve(__dirname, '..', 'templates', 'spacetime-module');
> rmSync(dst, { recursive: true, force: true });
> mkdirSync(dirname(dst), { recursive: true });
> cpSync(src, dst, { recursive: true });
> console.log(`Synced ${src} → ${dst}`);
> ```
> Then change the script to: `"sync:templates": "node scripts/sync-templates.mjs"`. **Use this fallback for Windows reliability.**

- [ ] **Step 3.4: Update init to call provisioning.**

Replace `packages/cli/src/commands/init.ts` with:

```typescript
import chalk from 'chalk';
import { runPrompts } from '../steps/prompts.js';
import { provisionDb } from '../steps/provision_db.js';

export async function runInit(): Promise<void> {
  console.log(chalk.bold.cyan('\nSpacetimeDB Memory MMO — interactive setup\n'));
  const answers = await runPrompts();
  const provision = await provisionDb(answers);
  console.log(chalk.green('\n✓ Provisioning complete'));
  console.log(chalk.gray(JSON.stringify(provision, null, 2)));
  console.log(chalk.yellow('\n(Config writing not yet implemented — Task 4+)'));
}
```

- [ ] **Step 3.5: Build + manual test (new local module).**

```bash
npm run build --workspace spacetimedb-memory-mmo
node packages/cli/dist/index.js init
# Choose: new, local, accept default name, skip hosts, skip keys
```

Expected: spacetime publish runs and succeeds. The new module shows up in `spacetime list --server local`.

- [ ] **Step 3.6: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): provision SpacetimeDB module for new/existing × local/maincloud"
git push
```

---

## Task 4 — Write `.env` and project marker dir

**Files:**
- Create: `packages/cli/src/steps/write_env.ts`
- Modify: `packages/cli/src/commands/init.ts`

**Goal:** Write `.spacetimedb-memory-mmo/.env` (gitignored) + `config.json` + `README.md` in the user's project root.

- [ ] **Step 4.1: Create `packages/cli/src/steps/write_env.ts`.**

```typescript
import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import type { InitAnswers } from './prompts.js';
import type { ProvisionResult } from './provision_db.js';

const MARKER_DIR = '.spacetimedb-memory-mmo';

export function writeEnv(answers: InitAnswers, prov: ProvisionResult): { dir: string; envPath: string } {
  const projectRoot = process.cwd();
  const dir = join(projectRoot, MARKER_DIR);
  mkdirSync(dir, { recursive: true });

  const envPath = join(dir, '.env');
  const envBody = [
    `# Auto-generated by spacetimedb-memory-mmo init`,
    `SPACETIMEDB_HOST=${prov.host}`,
    `SPACETIMEDB_DB_NAME=${prov.databaseName}`,
    answers.anthropicApiKey ? `ANTHROPIC_API_KEY=${answers.anthropicApiKey}` : `# ANTHROPIC_API_KEY=`,
    answers.voyageApiKey ? `VOYAGE_API_KEY=${answers.voyageApiKey}` : `# VOYAGE_API_KEY=`,
    `VOYAGE_EMBEDDING_MODEL=${answers.voyageEmbeddingModel}`,
    ``,
  ].join('\n');
  writeFileSync(envPath, envBody, { mode: 0o600 });

  const configPath = join(dir, 'config.json');
  const config = {
    version: 1,
    initializedAt: new Date().toISOString(),
    backend: answers.backend,
    databaseName: prov.databaseName,
    host: prov.host,
    hosts: answers.hosts,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const readmePath = join(dir, 'README.md');
  writeFileSync(
    readmePath,
    [
      `# .spacetimedb-memory-mmo/`,
      ``,
      `This directory was created by \`npx spacetimedb-memory-mmo init\`.`,
      ``,
      `- \`.env\` — secrets and connection config (DO NOT COMMIT)`,
      `- \`config.json\` — non-secret record of choices made`,
      ``,
      `To re-run setup: \`npx spacetimedb-memory-mmo init\` (will overwrite this dir).`,
      `To remove: \`npx spacetimedb-memory-mmo reset\`.`,
      ``,
    ].join('\n')
  );

  // Update .gitignore in project root (idempotent)
  const gitignorePath = join(projectRoot, '.gitignore');
  const ignoreLine = `${MARKER_DIR}/`;
  if (existsSync(gitignorePath)) {
    const current = readFileSync(gitignorePath, 'utf8');
    if (!current.split(/\r?\n/).includes(ignoreLine)) {
      appendFileSync(gitignorePath, `\n# Added by spacetimedb-memory-mmo\n${ignoreLine}\n`);
      console.log(chalk.green(`✓ Added ${ignoreLine} to .gitignore`));
    }
  } else {
    writeFileSync(gitignorePath, `# Created by spacetimedb-memory-mmo\n${ignoreLine}\n`);
    console.log(chalk.green(`✓ Created .gitignore with ${ignoreLine}`));
  }

  console.log(chalk.green(`✓ Wrote ${envPath}`));
  return { dir, envPath };
}
```

- [ ] **Step 4.2: Wire into `init.ts`.**

Update `runInit` to call writeEnv after provisioning:

```typescript
import { writeEnv } from '../steps/write_env.js';
// ...
  const provision = await provisionDb(answers);
  const written = writeEnv(answers, provision);
  console.log(chalk.green(`\n✓ Setup files at ${written.dir}`));
```

- [ ] **Step 4.3: Test in a scratch directory.**

```bash
mkdir -p /tmp/scratch-mcp-test
cd /tmp/scratch-mcp-test
node "<path-to-repo>/packages/cli/dist/index.js" init
# Choose: new, local, accept default name, skip hosts, skip keys
ls -la .spacetimedb-memory-mmo/
cat .spacetimedb-memory-mmo/.env
cat .gitignore
```

Expected: marker dir exists with .env, config.json, README.md. .gitignore exists/updated with `.spacetimedb-memory-mmo/`. Return to repo root afterward.

- [ ] **Step 4.4: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): write .env + config + .gitignore for installed projects"
git push
```

---

## Task 5 — Write MCP host config (Claude Code, Cursor)

**Files:**
- Create: `packages/cli/src/steps/write_mcp_config.ts`
- Modify: `packages/cli/src/commands/init.ts`

**Goal:** Drop the right MCP config into `.claude/settings.json` and/or `.cursor/mcp.json`. Existing files are merged (not overwritten).

- [ ] **Step 5.1: Create `packages/cli/src/steps/write_mcp_config.ts`.**

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import type { AiHost, InitAnswers } from './prompts.js';

const MCP_NAME = 'memory';

interface ClaudeSettings {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
  [k: string]: unknown;
}

interface CursorMcp {
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }>;
}

function buildEntry(envPath: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  return {
    command: 'npx',
    args: ['-y', '--package=spacetimedb-memory-mmo', 'spacetimedb-memory-mmo-mcp'],
    env: {
      DOTENV_CONFIG_PATH: envPath,
    },
  };
}

export function writeMcpConfig(
  hosts: AiHost[],
  envPath: string,
  _answers: InitAnswers
): void {
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
    let cfg: ClaudeSettings = {};
    if (existsSync(path)) {
      try {
        cfg = JSON.parse(readFileSync(path, 'utf8')) as ClaudeSettings;
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
    let cfg: CursorMcp = {};
    if (existsSync(path)) {
      try {
        cfg = JSON.parse(readFileSync(path, 'utf8')) as CursorMcp;
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
```

> **Note:** The MCP server entry uses `npx -y --package=spacetimedb-memory-mmo spacetimedb-memory-mmo-mcp`. This requires the **mcp-server package to expose a bin alias** of `spacetimedb-memory-mmo-mcp`. Verify in `packages/mcp-server/package.json` (Plan 2 Task 4.1) — the `bin` field there should match. If it's named differently, adjust the args here.
>
> The env var `DOTENV_CONFIG_PATH` is read by Node's `--env-file` (in dotenv mode). Alternatively, the MCP server can read from `process.env.DOTENV_CONFIG_PATH` and load that file itself; we do the latter for cross-Node-version safety. (Add this to mcp-server in Step 5.3.)

- [ ] **Step 5.2: Update mcp-server to read `DOTENV_CONFIG_PATH`.**

Edit `packages/mcp-server/src/env.ts`. At the top, before reading `process.env`:

```typescript
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';

if (process.env.DOTENV_CONFIG_PATH && existsSync(process.env.DOTENV_CONFIG_PATH)) {
  dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH });
}
```

Add `dotenv` to `packages/mcp-server/package.json` dependencies:

```json
    "dotenv": "^16.4.0",
```

- [ ] **Step 5.3: Verify mcp-server build still works.**

```bash
npm install
npm run build --workspace @spacetimedb-memory-mmo/mcp-server
```

- [ ] **Step 5.4: Wire writeMcpConfig into init.**

Update `runInit`:

```typescript
import { writeMcpConfig } from '../steps/write_mcp_config.js';
// ...
  const written = writeEnv(answers, provision);
  writeMcpConfig(answers.hosts, written.envPath, answers);
```

- [ ] **Step 5.5: Test end-to-end in a scratch project.**

```bash
mkdir -p /tmp/scratch-mcp-test2
cd /tmp/scratch-mcp-test2
node "<path-to-repo>/packages/cli/dist/index.js" init
# Choose: new, local, default name, claude-code, skip keys
ls -la .claude/
cat .claude/settings.json
```

Expected: `.claude/settings.json` contains an `mcpServers.memory` entry with the npx command.

- [ ] **Step 5.6: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): write MCP server config for claude-code/cursor hosts"
git push
```

---

## Task 6 — Final summary + `doctor` + `reset`

**Files:**
- Create: `packages/cli/src/steps/final_summary.ts`
- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/commands/doctor.ts`
- Modify: `packages/cli/src/commands/reset.ts`

**Goal:** Polish UX: clear summary at end of init, useful `doctor`, safe `reset`.

- [ ] **Step 6.1: Create `packages/cli/src/steps/final_summary.ts`.**

```typescript
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
  console.log(`  Extraction: ${answers.anthropicApiKey ? chalk.green('Anthropic enabled') : chalk.gray('off (manual entities)')}`);
  console.log(`  Embeddings: ${answers.voyageApiKey ? chalk.green('Voyage enabled') : chalk.gray('off (entity-only recall)')}`);
  console.log('');

  if (answers.hosts.includes('claude-code')) {
    console.log(chalk.bold('Next:'));
    console.log(`  Open this folder in Claude Code. The ${chalk.cyan('memory.*')} tools will be available.`);
    console.log(`  Try asking: ${chalk.italic('"Remember that Alice prefers oat milk"')}`);
  } else if (answers.hosts.length === 0) {
    console.log(chalk.bold('Manual MCP config:'));
    console.log(`  Add to your AI host's MCP config:`);
    console.log(chalk.gray('    {'));
    console.log(chalk.gray(`      "command": "npx",`));
    console.log(chalk.gray(`      "args": ["-y", "--package=spacetimedb-memory-mmo", "spacetimedb-memory-mmo-mcp"],`));
    console.log(chalk.gray(`      "env": { "DOTENV_CONFIG_PATH": "${process.cwd()}/.spacetimedb-memory-mmo/.env" }`));
    console.log(chalk.gray('    }'));
  }
  console.log('');
  console.log(chalk.gray(`Re-run anytime with: npx spacetimedb-memory-mmo init`));
  console.log(chalk.gray(`Diagnose problems:    npx spacetimedb-memory-mmo doctor`));
  console.log('');
}
```

- [ ] **Step 6.2: Wire summary into init.**

Replace `runInit` with:

```typescript
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
  writeMcpConfig(answers.hosts, written.envPath, answers);
  printSummary(answers, provision);
}
```

- [ ] **Step 6.3: Implement `doctor`.**

Replace `packages/cli/src/commands/doctor.ts`:

```typescript
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { commandExists, run } from '../lib/exec.js';

export async function runDoctor(): Promise<void> {
  const ok = (msg: string) => console.log(chalk.green('✓'), msg);
  const fail = (msg: string) => console.log(chalk.red('✗'), msg);
  const warn = (msg: string) => console.log(chalk.yellow('!'), msg);

  console.log(chalk.bold.cyan('\nspacetimedb-memory-mmo doctor\n'));

  // 1. spacetime CLI
  if (await commandExists('spacetime')) {
    const v = await run('spacetime', ['--version'], { quiet: true });
    ok(`spacetime CLI: ${v.stdout.split('\n')[0]}`);
  } else {
    fail('spacetime CLI not found. Install: https://spacetimedb.com/install');
  }

  // 2. Marker dir
  const marker = join(process.cwd(), '.spacetimedb-memory-mmo');
  if (!existsSync(marker)) {
    warn(`No .spacetimedb-memory-mmo/ here. Run \`npx spacetimedb-memory-mmo init\` first.`);
    return;
  }
  ok(`Found ${marker}`);

  // 3. .env
  const envPath = join(marker, '.env');
  if (!existsSync(envPath)) {
    fail(`Missing ${envPath}`);
    return;
  }
  ok(`.env present`);

  // 4. Parse .env
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
  if (env.ANTHROPIC_API_KEY) ok('ANTHROPIC_API_KEY set (extraction enabled)'); else warn('No ANTHROPIC_API_KEY (entities must be passed manually)');
  if (env.VOYAGE_API_KEY) ok('VOYAGE_API_KEY set (vector recall enabled)'); else warn('No VOYAGE_API_KEY (entity-only recall)');

  // 5. Try connecting via spacetime CLI
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
```

- [ ] **Step 6.4: Implement `reset`.**

Replace `packages/cli/src/commands/reset.ts`:

```typescript
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

  // Also clean .claude / .cursor entries (best-effort, leave other entries intact)
  for (const [dir, file] of [['.claude', 'settings.json'], ['.cursor', 'mcp.json']]) {
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
```

- [ ] **Step 6.5: Build + test all three commands.**

```bash
npm run build --workspace spacetimedb-memory-mmo

# In a scratch dir:
cd /tmp/scratch-mcp-test3
node "<repo>/packages/cli/dist/index.js" init
node "<repo>/packages/cli/dist/index.js" doctor
node "<repo>/packages/cli/dist/index.js" reset
```

Expected: init runs the full flow + summary. doctor reports green checks. reset prompts and cleans up.

- [ ] **Step 6.6: Commit + push.**

```bash
git add -A
git commit -m "feat(cli): final summary + doctor + reset commands"
git push
```

---

## Task 7 — `LICENSE` and final root README

**Files:**
- Verify: `LICENSE` exists at repo root (Plan 1 confirms it does — MIT? confirm)
- Modify: root `README.md` to point at npm install path
- Create: `CHANGELOG.md` v0.0.1 entry

**Goal:** Repo is presentable for public consumption. Anyone arriving from npm or GitHub knows what this is and how to install it.

- [ ] **Step 7.1: Verify LICENSE.**

```bash
cat LICENSE | head -5
```

If it's anything other than MIT (or another permissive OSS license), STOP and ask the user.

- [ ] **Step 7.2: Replace root README with the public-facing version.**

Read existing README, replace with:

```markdown
# SpacetimeDB Memory MMO

> Multi-agent compound memory for AI agents, backed by SpacetimeDB.

Install into any project folder in one command:

\`\`\`bash
npx spacetimedb-memory-mmo init
\`\`\`

Adds a graph-memory MCP server to Claude Code, Cursor, or any other MCP-compatible
AI host. Memories are atomic notes with named entity tags + optional vector
embeddings, stored in a SpacetimeDB module that multiple agents can share live.

## What you get

- 🧠 **Persistent memory** across AI sessions, with entity-graph navigation
- 🤝 **Multi-agent** — multiple agents on multiple machines share the same memory in real time
- 🔌 **MCP standard** — works with Claude Code, Cursor, Windsurf, custom agents
- 💸 **Cost-aware** — Haiku 4.5 for extraction, Voyage for embeddings, content-hash caching
- 🏠 **Local-first** — runs on your machine by default; optional cloud sync via SpacetimeDB Maincloud

## Install

\`\`\`bash
# In any project folder:
npx spacetimedb-memory-mmo init
\`\`\`

The installer asks:

1. New memory system or connect to existing?
2. Local (private, fast) or Maincloud (free hosted, syncs across devices)?
3. Configure Claude Code, Cursor, both, or skip?
4. Anthropic API key (optional, enables auto entity extraction)?
5. Voyage API key (optional, enables vector recall)?

After install, talk to your AI agent normally — it now has \`memory.remember\` and \`memory.recall\` tools.

## Prerequisites

- Node.js 20+
- [SpacetimeDB CLI](https://spacetimedb.com/install)
- For Maincloud: a free SpacetimeDB account (\`spacetime login\`)
- For auto-extraction: an [Anthropic API key](https://console.anthropic.com/) (optional, ~$0.0001 per memory)
- For vector recall: a [Voyage API key](https://dashboard.voyageai.com/) (optional, ~$0.00002 per memory)

## MCP tools exposed

| Tool | What it does |
|---|---|
| \`memory.remember(content, entities?)\` | Save a memory. Auto-extracts entities if Anthropic key configured. |
| \`memory.recall(query, k?, entity?)\` | Two-stage retrieval: entity match → vector re-rank. |
| \`memory.forget(noteIds[])\` | Delete memories you own. |
| \`memory.list_entities()\` | All entities with note counts. |
| \`memory.list_recent(k?)\` | Most recent K memories. |
| \`memory.tag(noteId, entity)\` / \`memory.untag(noteId, entityId)\` | Adjust tags. |

## Other commands

\`\`\`bash
npx spacetimedb-memory-mmo doctor   # diagnose installation issues
npx spacetimedb-memory-mmo reset    # remove local config and start over
\`\`\`

## How it works

Inspired by [HippoRAG](https://arxiv.org/abs/2405.14831) (entity-graph + PageRank-style retrieval),
[Graphiti / Zep](https://github.com/getzep/graphiti) (bi-temporal edges — Plan 4), and
[Mem0](https://mem0.ai/) (extract/update/delete memory operations).

Storage layer is [SpacetimeDB](https://spacetimedb.com) — a reactive relational DB
with built-in subscriptions. Multiple agents connect to the same module and see
each other's writes in real time, without needing a separate message bus.

See [docs/superpowers/plans/](./docs/superpowers/plans/) for the multi-plan implementation roadmap.

## Status

- ✅ **Plan 1** — graph-memory backend
- ✅ **Plan 2** — MCP server with extraction + embeddings
- ✅ **Plan 3** — \`npx\` installer + npm publish
- 🔜 **Plan 4** — multi-agent ACLs + bi-temporal relations + PageRank retrieval
- 🔜 **Plan 5** — dashboard polish + scheduled community summarization

## License

MIT
```

(Note: I escaped the backticks in this content because the plan itself is in markdown — the implementer should write the README WITHOUT escaping, just with normal triple-backticks for code fences.)

- [ ] **Step 7.3: Create `CHANGELOG.md`.**

```markdown
# Changelog

## [0.0.1] - 2026-05-06

### Initial release

- Core graph-memory schema in SpacetimeDB (atomic notes + named entities + many-to-many links)
- MCP server with `remember`, `recall`, `forget`, `list_entities`, `list_recent`, `tag`, `untag` tools
- Optional Anthropic Haiku 4.5 entity extraction
- Optional Voyage embedding-based vector recall with content-hash cache
- `npx spacetimedb-memory-mmo init` interactive installer
- Supports local SpacetimeDB and Maincloud hosting
- Supports Claude Code and Cursor (more hosts via manual MCP config)
```

- [ ] **Step 7.4: Commit + push.**

```bash
git add -A
git commit -m "docs: public README + changelog v0.0.1"
git push
```

---

## Task 8 — Tests for the CLI

**Files:**
- Create: `packages/cli/src/tests/write_mcp_config.test.ts`
- Create: `packages/cli/src/tests/write_env.test.ts`

**Goal:** Regression net for the file-writing logic. Prompts and DB provisioning are too interactive / external to easily unit-test, but the file writers are pure functions over an in-memory FS we can mock.

- [ ] **Step 8.1: Create `packages/cli/src/tests/write_env.test.ts`.**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeEnv } from '../steps/write_env.js';

let dir: string;
const origCwd = process.cwd();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'memmmo-test-'));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(origCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe('writeEnv', () => {
  it('creates marker dir, .env, config.json, and .gitignore', () => {
    const result = writeEnv(
      {
        mode: 'new',
        backend: 'local',
        databaseName: 'test-db',
        hosts: [],
        voyageEmbeddingModel: 'voyage-3-lite',
        anthropicApiKey: 'sk-ant-test',
        voyageApiKey: 'pa-test',
      },
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
    require('fs').writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
    writeEnv(
      {
        mode: 'new',
        backend: 'local',
        databaseName: 'test-db',
        hosts: [],
        voyageEmbeddingModel: 'voyage-3-lite',
      },
      { host: 'ws://localhost:3000', databaseName: 'test-db', modulePath: '' }
    );
    const ignore = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('.spacetimedb-memory-mmo/');
    // Run twice — should not double-add
    writeEnv(
      { mode: 'new', backend: 'local', databaseName: 'x', hosts: [], voyageEmbeddingModel: 'v' },
      { host: 'h', databaseName: 'x', modulePath: '' }
    );
    const ignore2 = readFileSync(join(dir, '.gitignore'), 'utf8');
    expect(ignore2.match(/\.spacetimedb-memory-mmo\//g)?.length).toBe(1);
  });
});
```

- [ ] **Step 8.2: Create `packages/cli/src/tests/write_mcp_config.test.ts`.**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeMcpConfig } from '../steps/write_mcp_config.js';
import type { InitAnswers } from '../steps/prompts.js';

let dir: string;
const origCwd = process.cwd();

const baseAnswers: InitAnswers = {
  mode: 'new',
  backend: 'local',
  databaseName: 'test',
  hosts: [],
  voyageEmbeddingModel: 'voyage-3-lite',
};

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
    writeMcpConfig(['claude-code'], '/abs/path/.env', baseAnswers);
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
    writeMcpConfig(['claude-code'], '/p/.env', baseAnswers);
    const cfg = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
    expect(cfg.existingKey).toBe('keep');
    expect(cfg.mcpServers.other).toBeDefined();
    expect(cfg.mcpServers.memory).toBeDefined();
  });

  it('writes both hosts when both selected', () => {
    writeMcpConfig(['claude-code', 'cursor'], '/p/.env', baseAnswers);
    expect(existsSync(join(dir, '.claude', 'settings.json'))).toBe(true);
    expect(existsSync(join(dir, '.cursor', 'mcp.json'))).toBe(true);
  });

  it('does nothing when hosts empty', () => {
    writeMcpConfig([], '/p/.env', baseAnswers);
    expect(existsSync(join(dir, '.claude'))).toBe(false);
    expect(existsSync(join(dir, '.cursor'))).toBe(false);
  });
});
```

- [ ] **Step 8.3: Run CLI tests.**

```bash
npm run test --workspace spacetimedb-memory-mmo
```

Expected: 6 tests passing across the two test files.

- [ ] **Step 8.4: Commit + push.**

```bash
git add -A
git commit -m "test(cli): write_env + write_mcp_config tests"
git push
```

---

## Task 9 — npm publish prep + publish

**Files:**
- Verify: all relevant `package.json` `version` and `dependencies` align
- Modify: `packages/mcp-server/package.json` (publish-ready)
- Modify: `packages/cli/package.json` (final dep version)

**Goal:** `npm publish` from `packages/cli/` and `packages/mcp-server/` succeeds. Anyone can `npx spacetimedb-memory-mmo init` from anywhere.

- [ ] **Step 9.1: Confirm npm name available.**

```bash
npm view spacetimedb-memory-mmo 2>&1 | head -3
npm view @spacetimedb-memory-mmo/mcp-server 2>&1 | head -3
```

If either returns metadata (not a 404), stop and pick a different name.

- [ ] **Step 9.2: Convert mcp-server to a publishable package.**

Edit `packages/mcp-server/package.json`:

- Change `"name"` from `@spacetimedb-memory-mmo/mcp-server` to `spacetimedb-memory-mmo-mcp-server` (npm scopes require an org; we use a dash-separated name to avoid that overhead).
- Set `"version": "0.0.1"`.
- Confirm `"bin"`:

```json
  "bin": {
    "spacetimedb-memory-mmo-mcp": "dist/index.js"
  },
```

- Add `"files"`:

```json
  "files": ["dist", "README.md"],
```

- Add publishing metadata:

```json
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO.git",
    "directory": "packages/mcp-server"
  },
  "homepage": "https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO/tree/main/packages/mcp-server#readme",
```

- [ ] **Step 9.3: Update CLI dep on the new mcp-server name.**

Edit `packages/cli/package.json`. Replace:

```json
    "@spacetimedb-memory-mmo/mcp-server": "0.0.1"
```

with:

```json
    "spacetimedb-memory-mmo-mcp-server": "0.0.1"
```

Update `packages/cli/src/steps/write_mcp_config.ts` `buildEntry` to match the published bin name (already `spacetimedb-memory-mmo-mcp` — no change).

- [ ] **Step 9.4: Update `packages/dashboard/package.json` to match new naming.**

Change `"name": "@spacetimedb-memory-mmo/dashboard"` to `"name": "spacetimedb-memory-mmo-dashboard"` and similarly for `spacetime-module`. The dashboard and spacetime-module won't be published to npm (they're internal), so the rename is just for consistency.

After renames, run:

```bash
npm install
```

Expected: workspace links re-resolve cleanly.

- [ ] **Step 9.5: Build everything one more time.**

```bash
npm run build
```

Expected: all four workspaces build without errors.

- [ ] **Step 9.6: Run all tests.**

```bash
npm run test
```

Expected: all tests pass across dashboard, mcp-server, cli.

- [ ] **Step 9.7: Dry-run publish for both packages.**

```bash
( cd packages/mcp-server && npm publish --dry-run )
( cd packages/cli && npm publish --dry-run )
```

Expected: shows the file list that would be published. Verify `dist/` is included for both, `templates/spacetime-module/` is included for cli.

- [ ] **Step 9.8: Real publish (in order: mcp-server first, then cli).**

```bash
( cd packages/mcp-server && npm publish --access public )
( cd packages/cli && npm publish --access public )
```

Expected: each prints "+ <pkg>@0.0.1". Verify on https://www.npmjs.com/package/spacetimedb-memory-mmo.

- [ ] **Step 9.9: Tag a GitHub release.**

```bash
git tag v0.0.1
git push --tags
gh release create v0.0.1 --generate-notes --title "v0.0.1 — initial release"
```

Expected: new GitHub release at https://github.com/TheJoeJep/SpacetimeDB-Memory-MMO/releases/tag/v0.0.1.

- [ ] **Step 9.10: Real-world smoke test from a fresh folder.**

```bash
cd /tmp
rm -rf real-test
mkdir real-test
cd real-test
npx -y spacetimedb-memory-mmo init
# Step through all prompts
ls -la .spacetimedb-memory-mmo/
cat .claude/settings.json
```

Expected: full install succeeds from npm. The marker dir + Claude config are written. Open the folder in Claude Code and verify the `memory.*` tools appear.

- [ ] **Step 9.11: Final commit + push.**

```bash
cd "<repo>"
git add -A
git commit -m "release: v0.0.1 — public npm + GitHub release"
git push
```

---

## Done — exit criteria

This plan is complete when **all of these are true**:

1. `npx spacetimedb-memory-mmo init` works from any folder on any machine, asking the four-question install flow.
2. Choosing "new + local" provisions a SpacetimeDB module locally; "new + maincloud" requires `spacetime login` and provisions on Clockwork's hosted infra.
3. Choosing Claude Code or Cursor writes a working MCP config; opening the folder in that AI host exposes the `memory.*` tools.
4. `npm publish` succeeded for `spacetimedb-memory-mmo` and `spacetimedb-memory-mmo-mcp-server`.
5. GitHub release `v0.0.1` is published at TheJoeJep/SpacetimeDB-Memory-MMO.
6. Real-world smoke test (`npx … init` in a fresh `/tmp` directory pulling from npm, not local workspace) succeeds.
7. All workspaces' tests pass: `npm run test` from repo root is fully green.

If all criteria pass, the system is **publicly installable**. Next step is Plan 4 (multi-agent ACLs + temporal relations) — but that can wait for user demand.
