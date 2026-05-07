import { input, password, select, confirm } from '@inquirer/prompts';

export type AiHost = 'claude-code' | 'cursor';

export interface InitAnswers {
  mode: 'new' | 'existing';
  backend: 'local' | 'maincloud';
  databaseName: string;
  customHost?: string;
  hosts: AiHost[];
  anthropicApiKey?: string;
  voyageApiKey?: string;
  voyageEmbeddingModel: string;
}

export async function runPrompts(): Promise<InitAnswers> {
  const mode = (await select({
    message: 'What do you want to do?',
    choices: [
      { name: 'Set up a new memory system (recommended)', value: 'new' },
      { name: 'Connect to an existing memory system', value: 'existing' },
    ],
    default: 'new',
  })) as 'new' | 'existing';

  let backend: 'local' | 'maincloud' = 'local';
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
    const choice = (await select({
      message: 'Existing system address?',
      choices: [
        { name: 'Local at ws://localhost:3000', value: 'local' },
        { name: 'Maincloud at wss://maincloud.spacetimedb.com', value: 'maincloud' },
        { name: 'Custom URI', value: 'custom' },
      ],
    })) as 'local' | 'maincloud' | 'custom';
    if (choice === 'custom') {
      customHost = await input({
        message: 'Custom WebSocket URI (e.g. ws://192.168.1.10:3000):',
        validate: (v) => /^wss?:\/\//.test(v) || 'Must start with ws:// or wss://',
      });
      backend = 'local';
    } else {
      backend = choice;
    }
  }

  const databaseName = await input({
    message: mode === 'new' ? 'Name for the new memory module:' : 'Existing module name:',
    default: mode === 'new' ? `compound-memory-${slugifyCwd()}` : undefined,
    validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, dashes only',
  });

  const hostChoice = (await select<'claude-code' | 'cursor' | 'both' | 'skip'>({
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
    hostChoice === 'both' ? ['claude-code', 'cursor']
    : hostChoice === 'skip' ? []
    : [hostChoice];

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
    message: 'Add Voyage API key for vector recall? (recommended)',
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
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 24) || 'project';
}
