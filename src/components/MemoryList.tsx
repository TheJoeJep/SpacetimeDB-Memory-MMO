import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function MemoryList() {
  const { identity } = useSpacetimeDB();
  const [notes, isLoading] = useTable(tables.memoryNote);
  const deleteMemory = useReducer(reducers.deleteMemory);

  if (isLoading) return <div className="memory-list">Loading…</div>;
  if (notes.length === 0) {
    return <div className="memory-list empty">No memories yet. Add one above.</div>;
  }

  const sorted = [...notes].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );

  return (
    <div className="memory-list">
      <h3>Memories ({sorted.length})</h3>
      <ul>
        {sorted.map(note => {
          const isMine = identity && note.addedBy.isEqual(identity);
          const date = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));
          return (
            <li key={note.id.toString()} className="memory-item">
              <p className="memory-content">{note.content}</p>
              <div className="memory-meta">
                <span>{date.toLocaleString()}</span>
                {isMine && (
                  <button
                    onClick={() => deleteMemory({ noteId: note.id })}
                    aria-label={`delete memory ${note.id.toString()}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
