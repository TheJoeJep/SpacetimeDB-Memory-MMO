import { useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';

interface Props {
  selectedEntityId: bigint | null;
  onSelect: (entityId: bigint | null) => void;
}

export function EntitySidebar({ selectedEntityId, onSelect }: Props) {
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);

  const countByEntity = new Map<string, number>();
  for (const link of links) {
    const k = link.entityId.toString();
    countByEntity.set(k, (countByEntity.get(k) || 0) + 1);
  }

  const sorted = [...entities].sort((a, b) => a.name.localeCompare(b.name));
  const selectedKey = selectedEntityId?.toString() ?? null;

  return (
    <aside className="entity-sidebar">
      <h3>Entities</h3>
      <ul>
        <li>
          <button
            type="button"
            className={selectedKey === null ? 'entity-row active' : 'entity-row'}
            onClick={() => onSelect(null)}
          >
            All
          </button>
        </li>
        {sorted.map(ent => {
          const k = ent.id.toString();
          const count = countByEntity.get(k) || 0;
          return (
            <li key={k}>
              <button
                type="button"
                className={selectedKey === k ? 'entity-row active' : 'entity-row'}
                onClick={() => onSelect(ent.id)}
              >
                {ent.name} <span className="entity-count">({count})</span>
              </button>
            </li>
          );
        })}
        {entities.length === 0 && <li className="entity-empty">No entities yet.</li>}
      </ul>
    </aside>
  );
}
