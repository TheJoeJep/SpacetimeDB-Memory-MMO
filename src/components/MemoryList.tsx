import { useState } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

interface Props {
  filterEntityId?: bigint | null;
}

export function MemoryList({ filterEntityId = null }: Props = {}) {
  const { identity } = useSpacetimeDB();
  const [notes, isLoading] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const deleteMemory = useReducer(reducers.deleteMemory);
  const updateMemory = useReducer(reducers.updateMemory);
  const tagMemory = useReducer(reducers.tagMemory);
  const untagMemory = useReducer(reducers.untagMemory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  if (isLoading) return <div className="memory-list">Loading…</div>;
  if (notes.length === 0) {
    return <div className="memory-list empty">No memories yet. Add one above.</div>;
  }

  const entityById = new Map(entities.map(e => [e.id.toString(), e]));
  const linksByNote = new Map<string, { linkId: bigint; entityId: bigint; name: string }[]>();
  for (const link of links) {
    const noteKey = link.noteId.toString();
    const ent = entityById.get(link.entityId.toString());
    if (!ent) continue;
    if (!linksByNote.has(noteKey)) linksByNote.set(noteKey, []);
    linksByNote.get(noteKey)!.push({ linkId: link.id, entityId: link.entityId, name: ent.name });
  }

  const filteredNotes = filterEntityId === null
    ? notes
    : notes.filter(n => {
        const noteLinks = linksByNote.get(n.id.toString()) || [];
        return noteLinks.some(l => l.entityId === filterEntityId);
      });

  const sorted = [...filteredNotes].sort((a, b) =>
    Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
  );

  return (
    <div className="memory-list">
      <h3>Memories ({sorted.length}{filterEntityId !== null && ` of ${notes.length}`})</h3>
      <ul>
        {sorted.map(note => {
          const isMine = identity && note.addedBy.isEqual(identity);
          const date = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));
          const tags = linksByNote.get(note.id.toString()) || [];
          const noteKey = note.id.toString();
          const isEditing = editingId === noteKey;

          return (
            <li key={noteKey} className="memory-item">
              {isEditing ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (!editDraft.trim()) return;
                    updateMemory({ noteId: note.id, content: editDraft.trim() });
                    setEditingId(null);
                  }}
                >
                  <textarea
                    aria-label={`edit memory ${noteKey}`}
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </form>
              ) : (
                <p className="memory-content">{note.content}</p>
              )}

              <div className="memory-tags">
                {tags.map(tag => (
                  <span key={tag.linkId.toString()} className="tag-chip">
                    {tag.name}
                    {isMine && (
                      <button
                        type="button"
                        aria-label={`remove tag ${tag.name} from memory ${noteKey}`}
                        onClick={() => untagMemory({ noteId: note.id, entityId: tag.entityId })}
                        style={{ marginLeft: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {isMine && (
                  <form
                    style={{ display: 'inline-flex', gap: '0.25rem' }}
                    onSubmit={e => {
                      e.preventDefault();
                      const v = (tagDraft[noteKey] || '').trim();
                      if (!v) return;
                      tagMemory({ noteId: note.id, entityName: v });
                      setTagDraft(d => ({ ...d, [noteKey]: '' }));
                    }}
                  >
                    <input
                      aria-label={`add tag to memory ${noteKey}`}
                      value={tagDraft[noteKey] || ''}
                      onChange={e => setTagDraft(d => ({ ...d, [noteKey]: e.target.value }))}
                      placeholder="+ tag"
                      size={8}
                    />
                  </form>
                )}
              </div>

              <div className="memory-meta">
                <span>{date.toLocaleString()}</span>
                {isMine && !isEditing && (
                  <span style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => { setEditDraft(note.content); setEditingId(noteKey); }}
                      aria-label={`edit memory ${noteKey}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMemory({ noteId: note.id })}
                      aria-label={`delete memory ${noteKey}`}
                    >
                      Delete
                    </button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
