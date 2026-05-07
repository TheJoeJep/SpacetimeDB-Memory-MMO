import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You extract canonical entity names from short user-supplied facts.

Rules:
- Extract people, projects, organizations, products, places, key concepts
- Lowercase, no spaces (use kebab-case for multi-word: "project-x")
- Skip pronouns, dates, generic words
- Return at most 6 entities
- If the fact has no clear entities, return an empty array`;

export async function extractEntities(
  apiKey: string,
  content: string
): Promise<string[]> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    tools: [
      {
        name: 'record_entities',
        description: 'Record the canonical entities extracted from the fact.',
        input_schema: {
          type: 'object' as const,
          properties: {
            entities: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 6,
            },
          },
          required: ['entities'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'record_entities' },
  });

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'record_entities') {
      const input = block.input as { entities?: unknown };
      if (Array.isArray(input.entities)) {
        return input.entities
          .filter((x): x is string => typeof x === 'string')
          .map(x => x.trim().toLowerCase())
          .filter(Boolean);
      }
    }
  }
  return [];
}
