/**
 * Common starter memories that demonstrate the system and are useful out of the box.
 * Categories: writing style, tech stack preferences, code preferences, annoyances, workflow.
 *
 * These are designed to be the kind of facts a user would actually want any AI agent
 * working on their machine to remember — opinionated defaults, not generic platitudes.
 */
export const SEED_MEMORIES: { content: string; entities: string[] }[] = [
  {
    content:
      "Writing style: prefer concise direct answers — give me the conclusion first, then context if I ask. No hedging, no excessive apologies, no 'I think'. Plain language over corporate-speak.",
    entities: ['writing-style', 'communication', 'preferences'],
  },
  {
    content:
      "Default tech stack: TypeScript + React 18 + Vite for frontends. Node 20+ for tooling. Plain CSS with custom properties — only use Tailwind when explicitly asked. Vitest for tests.",
    entities: ['tech-stack', 'typescript', 'react', 'preferences'],
  },
  {
    content:
      "Code style: small focused files, functional patterns over classes for business logic, no comments unless explaining a non-obvious WHY, prettier defaults but 100-char line limit. Strict TypeScript — no any without comment.",
    entities: ['code-style', 'preferences'],
  },
  {
    content:
      "Annoyances: don't add emojis unless I ask. Don't suggest LangChain or Pinecone. Don't write docstrings that just restate the function name. Don't add 'TODO' or 'FIXME' comments — track in issues instead.",
    entities: ['annoyances', 'preferences'],
  },
  {
    content:
      "Workflow: small frequent commits over giant ones. Run tests before declaring work done. Write the plan first when the task is non-trivial — don't just dive in. Always state what you're going to do, then do it.",
    entities: ['workflow', 'preferences'],
  },
];
