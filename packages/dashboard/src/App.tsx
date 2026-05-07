import { useState } from 'react';
import './App.css';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from './module_bindings';
import { AmbientBackground } from './components/AmbientBackground';
import { TopBar } from './components/TopBar';
import { MemoryGraph } from './components/MemoryGraph';
import type { GraphNode } from './components/MemoryGraph';
import { DetailPanel } from './components/DetailPanel';
import { AddMemoryBar } from './components/AddMemoryBar';
import { SEED_MEMORIES } from './lib/seedMemories';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const addMemoryWithEntities = useReducer(reducers.addMemoryWithEntities);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [seeding, setSeeding] = useState(false);

  const noteCount = notes.length;
  const entityCount = entities.length;
  const myNoteCount = identity ? notes.filter(n => n.addedBy.isEqual(identity)).length : 0;

  const onSeed = async () => {
    setSeeding(true);
    for (const m of SEED_MEMORIES) {
      addMemoryWithEntities({
        content: m.content,
        entityNames: m.entities,
        embedding: undefined,
        clientToken: undefined,
      });
      await new Promise(r => setTimeout(r, 80));
    }
    setSeeding(false);
  };

  if (!connected || !identity) {
    return (
      <div className="app-cosmos">
        <AmbientBackground />
        <div className="connecting">
          <div className="connecting-orb" />
          <div className="connecting-text">Aligning to Spacetime…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-cosmos">
      <AmbientBackground />
      <MemoryGraph onSelect={setSelected} selectedId={selected?.id ?? null} />
      <TopBar noteCount={noteCount} entityCount={entityCount} />

      {myNoteCount === 0 && (
        <div className="empty-cosmos">
          <div className="empty-glyph">— {noteCount === 0 ? 'Empty cosmos' : 'Your first memory'} —</div>
          <div className="empty-headline">
            {noteCount === 0
              ? 'Plant the first memories, or speak yours into existence below.'
              : 'You haven’t added any memories yet. Plant the starter set, or write your own below.'}
          </div>
          <button className="seed-btn" onClick={onSeed} disabled={seeding}>
            {seeding ? 'Planting…' : `Plant ${SEED_MEMORIES.length} starter memories`}
          </button>
          <div className="empty-hint">↵ to save · comma-separate entity tags</div>
        </div>
      )}

      <AddMemoryBar />

      <div className="legend">
        <div className="legend-row"><span className="legend-dot memory" /> Memory</div>
        <div className="legend-row"><span className="legend-dot entity" /> Entity</div>
        <div className="legend-row"><span className="legend-dot recent" /> Recently added</div>
      </div>

      <DetailPanel node={selected} onClose={() => setSelected(null)} onSelectNode={setSelected} />
    </div>
  );
}

export default App;
