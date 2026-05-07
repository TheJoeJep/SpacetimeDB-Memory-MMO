import { useState } from 'react';
import type { FormEvent } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import { parseTags } from '../lib/parseTags';

export function AddMemory() {
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const addMemoryWithEntities = useReducer(reducers.addMemoryWithEntities);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    const entityNames = parseTags(tagInput);
    addMemoryWithEntities({ content: trimmed, entityNames });
    setContent('');
    setTagInput('');
  };

  return (
    <form className="add-memory" onSubmit={onSubmit}>
      <h3>Add memory</h3>
      <textarea
        aria-label="memory content input"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What should I remember?"
        rows={3}
      />
      <input
        aria-label="entity tags input"
        type="text"
        value={tagInput}
        onChange={e => setTagInput(e.target.value)}
        placeholder="Entity tags (comma-separated, e.g. alice, project-x)"
      />
      <button type="submit" disabled={!content.trim()}>Save</button>
    </form>
  );
}
