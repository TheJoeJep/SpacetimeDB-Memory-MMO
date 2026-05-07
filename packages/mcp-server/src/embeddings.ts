import { createHash } from 'crypto';
import type { Conn } from './connection.js';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function fetchVoyageEmbedding(
  apiKey: string,
  model: string,
  content: string
): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: content, model }),
  });
  if (!response.ok) {
    throw new Error(`Voyage API error ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
  if (!json.data?.[0]?.embedding) throw new Error('Voyage response missing embedding');
  return json.data[0].embedding;
}

export async function getEmbedding(
  conn: Conn,
  apiKey: string | undefined,
  model: string,
  content: string
): Promise<number[] | null> {
  if (!apiKey) return null;

  const hash = hashContent(content);
  const cached = (conn.db as any).embeddingCache.contentHash.find(hash);
  if (cached) return cached.embedding;

  const embedding = await fetchVoyageEmbedding(apiKey, model, content);
  await (conn.reducers as any).cacheEmbedding({ contentHash: hash, embedding, model });
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
