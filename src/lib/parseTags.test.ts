import { describe, it, expect } from 'vitest';
import { parseTags } from './parseTags';

describe('parseTags', () => {
  it('returns an empty array for empty input', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
  });

  it('splits on commas and trims whitespace', () => {
    expect(parseTags('alice, bob , charlie')).toEqual(['alice', 'bob', 'charlie']);
  });

  it('lowercases tags', () => {
    expect(parseTags('Alice, BOB')).toEqual(['alice', 'bob']);
  });

  it('removes empty entries from extra commas', () => {
    expect(parseTags('alice,,bob,')).toEqual(['alice', 'bob']);
  });

  it('deduplicates after normalization, preserving first-seen order', () => {
    expect(parseTags('alice, Alice, bob, ALICE')).toEqual(['alice', 'bob']);
  });
});
