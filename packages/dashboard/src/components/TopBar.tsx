import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from '../module_bindings';
import { agentColorFromIdentity } from '../lib/agentColor';

interface Props {
  noteCount: number;
  entityCount: number;
}

export function TopBar({ noteCount, entityCount }: Props) {
  const { identity } = useSpacetimeDB();
  const setAgentName = useReducer(reducers.setAgentName);
  const [agents] = useTable(tables.agent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const meHex = identity?.toHexString() ?? '';
  const me = identity ? agents.find(a => a.identity.isEqual(identity)) : undefined;
  const myColor = meHex ? agentColorFromIdentity(meHex) : '#888';
  const displayName = me?.name || meHex.substring(0, 8) || '—';

  // Other agents (excluding me) — show first 5 as colored dots
  const others = agents
    .filter(a => identity && !a.identity.isEqual(identity))
    .slice(0, 5)
    .map(a => ({
      hex: a.identity.toHexString(),
      name: a.name,
      color: agentColorFromIdentity(a.identity.toHexString()),
    }));

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setAgentName({ name: draft.trim() });
    setEditing(false);
  };

  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark" />
        <div className="brand-stack">
          <div className="brand-title">Memory Cosmos</div>
          <div className="brand-sub">SpacetimeDB · MMO</div>
        </div>
      </div>

      <div className="top-meta">
        <div className="stats-badge">
          <span><span className="num">{noteCount}</span>memories</span>
          <span><span className="num">{entityCount}</span>entities</span>
        </div>

        <div className="connection-dot">Online</div>

        {others.length > 0 && (
          <div className="agents-online" title={`${others.length} other agent${others.length === 1 ? '' : 's'} connected`}>
            {others.map(o => (
              <div
                key={o.hex}
                className="agents-online-dot"
                style={{ background: o.color, color: o.color }}
                title={o.name || o.hex.substring(0, 8)}
              />
            ))}
            <span className="agents-online-label">{others.length} agent{others.length === 1 ? '' : 's'}</span>
          </div>
        )}

        <div className="agent-pill">
          <div className="agent-avatar" style={{ background: myColor, color: myColor }} />
          {editing ? (
            <form onSubmit={onSave} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                aria-label="agent name input"
                className="agent-name-edit"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                autoFocus
              />
              <button type="submit" className="agent-save-btn">Save</button>
              <button type="button" className="agent-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
            </form>
          ) : (
            <>
              <span>{displayName}</span>
              <button
                className="agent-edit-btn"
                onClick={() => { setDraft(me?.name || ''); setEditing(true); }}
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
