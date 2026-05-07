import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';

export function AgentBar() {
  const { identity } = useSpacetimeDB();
  const setAgentName = useReducer(reducers.setAgentName);
  const [agents] = useTable(tables.agent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!identity) return <div className="agent-bar">Not connected</div>;

  const me = agents.find(a => a.identity.isEqual(identity));
  const displayName = me?.name || identity.toHexString().substring(0, 8);

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setAgentName({ name: draft.trim() });
    setEditing(false);
  };

  return (
    <div className="agent-bar">
      <span className="agent-label">Agent:</span>
      {editing ? (
        <form onSubmit={onSave} style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <input
            aria-label="agent name input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            autoFocus
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : (
        <>
          <span className="agent-name">{displayName}</span>
          <button onClick={() => { setDraft(me?.name || ''); setEditing(true); }}>
            Edit
          </button>
        </>
      )}
    </div>
  );
}
