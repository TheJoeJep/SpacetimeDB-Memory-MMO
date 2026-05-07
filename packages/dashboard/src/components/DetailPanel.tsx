import { useEffect, useRef, useState } from 'react';
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

  // Editable content draft — initialised from node, kept in sync when node changes
  const [draft, setDraft] = useState('');
  const initialDraft = useRef('');
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (node?.kind === 'memory' && node.content) {
      setDraft(node.content);
      initialDraft.current = node.content;
    } else {
      setDraft('');
      initialDraft.current = '';
    }
    setTagDraft('');
  }, [node?.id]);

  // ESC closes too
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndSave();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!node) return null;

  const isMemory = node.kind === 'memory';
  const meHex = identity?.toHexString() ?? '';
  const noteId = node.rawId;
  const note = isMemory ? notes.find(n => n.id === noteId) : undefined;
  const entity = !isMemory ? entities.find(e => e.id === noteId) : undefined;
  const isMine = note ? note.addedBy.toHexString() === meHex : false;

  const closeAndSave = () => {
    if (isMemory && isMine && note && draft.trim() && draft.trim() !== initialDraft.current) {
      updateMemory({ noteId: note.id, content: draft.trim() });
    }
    onClose();
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeAndSave();
    }
  };

  // Linked entities for memory
  const noteEntities = note
    ? links
        .filter(l => l.noteId === note.id)
        .map(l => entities.find(e => e.id === l.entityId))
        .filter((e): e is NonNullable<typeof e> => !!e)
    : [];

  // Linked notes for entity
  const linkedNotes = entity
    ? links
        .filter(l => l.entityId === entity.id)
        .map(l => notes.find(n => n.id === l.noteId))
        .filter((n): n is NonNullable<typeof n> => !!n)
        .sort((a, b) =>
          Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch)
        )
    : [];

  return (
    <div className="modal-backdrop" onMouseDown={onBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-close" onClick={closeAndSave} aria-label="close detail panel">×</button>

        {isMemory && note && (
          <>
            <div className="modal-kind">
              <span className="modal-kind-tag" style={{ borderColor: agentColorFromIdentity(note.addedBy.toHexString()) }}>
                Memory
              </span>
              <span className="modal-id">#{noteId.toString()}</span>
            </div>

            {isMine ? (
              <textarea
                className="modal-content-edit"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                aria-label={`edit memory ${noteId.toString()}`}
                autoFocus
                rows={5}
              />
            ) : (
              <p className="modal-content-readonly">{note.content}</p>
            )}

            <div className="modal-meta-row">
              <AuthorBadge identityHex={note.addedBy.toHexString()} agents={agents} />
              <span className="modal-meta-sep">·</span>
              <span className="modal-meta-time">
                {new Date(Number(note.createdAt.microsSinceUnixEpoch / 1000n)).toLocaleString()}
              </span>
            </div>

            <div>
              <div className="modal-section-label">Linked entities</div>
              <div className="modal-tags">
                {noteEntities.length === 0 && (
                  <span className="modal-empty">— none —</span>
                )}
                {noteEntities.map(ent => (
                  <span key={ent.id.toString()} className="tag-chip-modal">
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
              </div>
              {isMine && (
                <form
                  className="modal-tag-add"
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
                    placeholder="+ add an entity"
                  />
                </form>
              )}
            </div>

            {isMine && (
              <div className="modal-actions">
                <button className="modal-btn primary" onClick={closeAndSave}>
                  Save
                </button>
                <button
                  className="modal-btn danger"
                  aria-label={`delete memory ${noteId.toString()}`}
                  onClick={() => { deleteMemory({ noteId: note.id }); onClose(); }}
                >
                  Forget
                </button>
              </div>
            )}
            {!isMine && (
              <div className="modal-actions">
                <button className="modal-btn primary" onClick={onClose}>Close</button>
              </div>
            )}
          </>
        )}

        {!isMemory && entity && (
          <>
            <div className="modal-kind">
              <span className="modal-kind-tag entity">Entity</span>
              <span className="modal-id">{linkedNotes.length} memor{linkedNotes.length === 1 ? 'y' : 'ies'}</span>
            </div>
            <h2 className="modal-title">{entity.name}</h2>

            <div>
              <div className="modal-section-label">Memories</div>
              <ul className="modal-linked-list">
                {linkedNotes.map(n => (
                  <li
                    key={n.id.toString()}
                    className="modal-linked-item"
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

            <div className="modal-actions">
              <button className="modal-btn primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuthorBadge({ identityHex, agents }: { identityHex: string; agents: ReadonlyArray<{ identity: { toHexString: () => string; isEqual: (other: any) => boolean }; name?: string }> }) {
  const color = agentColorFromIdentity(identityHex);
  const a = agents.find(x => x.identity.toHexString() === identityHex);
  const name = a?.name || identityHex.substring(0, 8);
  return (
    <span className="author-badge">
      <span className="author-dot" style={{ background: color, color }} />
      <span>{name}</span>
    </span>
  );
}
