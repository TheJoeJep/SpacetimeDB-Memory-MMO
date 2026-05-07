import { useEffect, useRef } from 'react';
import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import type { GraphNode } from './MemoryGraph';
import { agentColorFromIdentity } from '../lib/agentColor';

interface Props {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  onSelect: (node: GraphNode) => void;
}

interface Hit {
  node: GraphNode;
  score: number;
  highlight: { before: string; match: string; after: string } | null;
}

export function SearchPalette({ open, query, onQueryChange, onClose, onSelect }: Props) {
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when opening
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const hits: Hit[] = [];

  if (q.length > 0) {
    // Search memories by content
    for (const n of notes) {
      const content = n.content.toLowerCase();
      const idx = content.indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 18);
        const end = Math.min(n.content.length, idx + q.length + 32);
        hits.push({
          node: {
            id: `m:${n.id.toString()}`,
            kind: 'memory',
            label: n.content.slice(0, 40),
            content: n.content,
            authorHex: n.addedBy.toHexString(),
            authorColor: agentColorFromIdentity(n.addedBy.toHexString()),
            createdAtMs: Number(n.createdAt.microsSinceUnixEpoch / 1000n),
            rawId: n.id,
          },
          score: idx === 0 ? 0 : idx, // earlier = better
          highlight: {
            before: (start > 0 ? '…' : '') + n.content.slice(start, idx),
            match: n.content.slice(idx, idx + q.length),
            after: n.content.slice(idx + q.length, end) + (end < n.content.length ? '…' : ''),
          },
        });
      }
    }

    // Search entities by name
    const counts = new Map<string, number>();
    for (const link of links) {
      const k = link.entityId.toString();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const e of entities) {
      const name = e.name.toLowerCase();
      const idx = name.indexOf(q);
      if (idx >= 0) {
        hits.push({
          node: {
            id: `e:${e.id.toString()}`,
            kind: 'entity',
            label: e.name,
            count: counts.get(e.id.toString()) ?? 0,
            rawId: e.id,
          },
          score: idx === 0 ? -100 : idx, // entities prefix-match get top priority
          highlight: null,
        });
      }
    }

    hits.sort((a, b) => a.score - b.score);
  }

  return (
    <div className="search-backdrop" onMouseDown={onClose}>
      <div className="search-palette" onMouseDown={e => e.stopPropagation()}>
        <div className="search-row">
          <span className="search-prefix">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search memories and entities…"
            spellCheck={false}
            onKeyDown={e => {
              if (e.key === 'Enter' && hits.length > 0) {
                e.preventDefault();
                onSelect(hits[0].node);
                onClose();
              }
            }}
          />
          <span className="search-shortcut">esc</span>
        </div>
        {q.length > 0 && (
          <ul className="search-results">
            {hits.length === 0 && <li className="search-empty">No matches.</li>}
            {hits.slice(0, 12).map(h => (
              <li
                key={h.node.id}
                className={`search-item ${h.node.kind}`}
                onClick={() => { onSelect(h.node); onClose(); }}
              >
                <span className="search-kind-tag">{h.node.kind === 'memory' ? 'M' : 'E'}</span>
                {h.node.kind === 'memory' && h.highlight ? (
                  <span className="search-snippet">
                    {h.highlight.before}
                    <span className="search-match">{h.highlight.match}</span>
                    {h.highlight.after}
                  </span>
                ) : (
                  <span className="search-snippet">{h.node.label}</span>
                )}
                {h.node.kind === 'entity' && (
                  <span className="search-meta">{h.node.count} memor{h.node.count === 1 ? 'y' : 'ies'}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {q.length === 0 && (
          <div className="search-hint-row">
            <kbd>↵</kbd> open · <kbd>esc</kbd> close · type to filter the cosmos
          </div>
        )}
      </div>
    </div>
  );
}
