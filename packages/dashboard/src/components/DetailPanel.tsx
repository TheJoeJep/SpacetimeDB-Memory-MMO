import { useEffect, useState } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';
import { agentColorFromIdentity } from '../lib/agentColor';
import type { GraphNode } from './MemoryGraph';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  onSelectNode: (node: GraphNode | null) => void;
}

export function DetailPanel({ node, onClose, onSelectNode }: Props) {
  const { identity } = useSpacetimeDB();
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const [agents] = useTable(tables.agent);
  const deleteMemory = useReducer(reducers.deleteMemory);
  const updateMemory = useReducer(reducers.updateMemory);
  const tagMemory = useReducer(reducers.tagMemory);
  const untagMemory = useReducer(reducers.untagMemory);

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    setEditing(false);
    setEditDraft('');
    setTagDraft('');
  }, [node?.id]);

  if (!node) return <aside className="detail-panel" aria-hidden />;

  const isMemory = node.kind === 'memory';
  const meHex = identity?.toHexString() ?? '';
  const noteId = node.rawId;

  if (isMemory) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return <aside className="detail-panel open" />;
    const isMine = note.addedBy.toHexString() === meHex;
    const author = agents.find(a => a.identity.isEqual(note.addedBy));
    const authorName = author?.name || note.addedBy.toHexString().substring(0, 8);
    const authorColor = agentColorFromIdentity(note.addedBy.toHexString());
    const createdAt = new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n));

    const noteEntities = links
      .filter(l => l.noteId === note.id)
      .map(l => entities.find(e => e.id === l.entityId))
      .filter((e): e is NonNullable<typeof e> => !!e);

    return (
      <aside className="detail-panel open" role="dialog">
        <button className="detail-close" onClick={onClose} aria-label="close detail panel">×</button>
        <div className="detail-kind">Memory · #{noteId.toString()}</div>

        {editing ? (
          <textarea
            className="detail-edit-textarea"
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            aria-label={`edit memory ${noteId.toString()}`}
            autoFocus
          />
        ) : (
          <p className="detail-title">{note.content}</p>
        )}

        <div className="detail-meta-row">
          <span
            className="agent-avatar"
            style={{ width: 14, height: 14, background: authorColor, color: authorColor }}
          />
          <span>{authorName}</span>
          <span style={{ color: 'var(--star-ghost)' }}>·</span>
          <span>{createdAt.toLocaleString()}</span>
        </div>

        <div>
          <div className="detail-section-label">Linked entities</div>
          <div className="detail-tags">
            {noteEntities.map(ent => (
              <span key={ent.id.toString()} className="tag-chip">
                {ent.name}
                {isMine && (
                  <button
                    type="button"
                    className="tag-chip-remove"
                    aria-label={`remove tag ${ent.name} from memory ${noteId.toString()}`}
                    onClick={() => untagMemory({ noteId: note.id, entityId: ent.id })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {noteEntities.length === 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--star-ghost)' }}>
                — none —
              </span>
            )}
          </div>
          {isMine && (
            <form
              className="detail-tag-add"
              onSubmit={e => {
                e.preventDefault();
                if (!tagDraft.trim()) return;
                tagMemory({ noteId: note.id, entityName: tagDraft.trim() });
                setTagDraft('');
              }}
            >
              <input
                aria-label={`add tag to memory ${noteId.toString()}`}
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                placeholder="+ add entity"
              />
            </form>
          )}
        </div>

        {isMine && (
          <div className="detail-actions">
            {editing ? (
              <>
                <button
                  className="detail-btn"
                  onClick={() => {
                    if (!editDraft.trim()) return;
                    updateMemory({ noteId: note.id, content: editDraft.trim() });
                    setEditing(false);
                  }}
                >
                  Save
                </button>
                <button className="detail-btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="detail-btn"
                  aria-label={`edit memory ${noteId.toString()}`}
                  onClick={() => { setEditDraft(note.content); setEditing(true); }}
                >
                  Edit
                </button>
                <button
                  className="detail-btn danger"
                  aria-label={`delete memory ${noteId.toString()}`}
                  onClick={() => { deleteMemory({ noteId: note.id }); onClose(); }}
                >
                  Forget
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    );
  }

  // Entity panel
  const entity = entities.find(e => e.id === noteId);
  if (!entity) return <aside className="detail-panel open" />;
  const linkedNoteIds = links.filter(l => l.entityId === entity.id).map(l => l.noteId);
  const linkedNotes = linkedNoteIds
    .map(id => notes.find(n => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .sort((a, b) =>
      Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
    );

  return (
    <aside className="detail-panel open" role="dialog">
      <button className="detail-close" onClick={onClose} aria-label="close detail panel">×</button>
      <div className="detail-kind">Entity · {linkedNotes.length} memor{linkedNotes.length === 1 ? 'y' : 'ies'}</div>
      <h2 className="detail-title">{entity.name}</h2>

      <div>
        <div className="detail-section-label">Memories</div>
        <ul className="linked-list">
          {linkedNotes.map(n => (
            <li
              key={n.id.toString()}
              className="linked-item"
              onClick={() =>
                onSelectNode({
                  id: `m:${n.id.toString()}`,
                  kind: 'memory',
                  label: n.content.slice(0, 40),
                  content: n.content,
                  authorHex: n.addedBy.toHexString(),
                  authorColor: agentColorFromIdentity(n.addedBy.toHexString()),
                  createdAtMs: Number(n.createdAt.microsSinceUnixEpoch / 1000n),
                  rawId: n.id,
                })
              }
            >
              {n.content}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
