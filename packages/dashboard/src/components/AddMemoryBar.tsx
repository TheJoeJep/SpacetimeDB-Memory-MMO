import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';
import { parseTags } from '../lib/parseTags';

export function AddMemoryBar() {
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const addMemoryWithEntities = useReducer(reducers.addMemoryWithEntities);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    const entityNames = parseTags(tagInput);
    addMemoryWithEntities({
      content: trimmed,
      entityNames,
      embedding: undefined,
      clientToken: undefined,
    });
    setContent('');
    setTagInput('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <form className="add-bar" onSubmit={onSubmit}>
      <div className="add-bar-row">
        <span className="add-bar-prefix">remember</span>
        <textarea
          aria-label="memory content input"
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Speak your memory into the cosmos…"
          rows={1}
        />
        <button
          type="submit"
          className="add-bar-submit"
          disabled={!content.trim()}
        >
          Save
        </button>
      </div>
      <div className="add-bar-divider" />
      <div className="add-bar-row">
        <span className="add-bar-prefix tag">tag</span>
        <input
          aria-label="entity tags input"
          type="text"
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          placeholder="alice, project-x, drinks  (comma-separated entities)"
        />
      </div>
    </form>
  );
}
