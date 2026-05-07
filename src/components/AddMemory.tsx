import { useState } from 'react';
import type { FormEvent } from 'react';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../module_bindings';

export function AddMemory() {
  const [content, setContent] = useState('');
  const addMemory = useReducer(reducers.addMemory);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    addMemory({ content: trimmed });
    setContent('');
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
      <button type="submit" disabled={!content.trim()}>Save</button>
    </form>
  );
}
