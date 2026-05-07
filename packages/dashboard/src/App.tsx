import { useState } from 'react';
import './App.css';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from './module_bindings';
import { AmbientBackground } from './components/AmbientBackground';
import { TopBar } from './components/TopBar';
import { MemoryGraph } from './components/MemoryGraph';
import type { GraphNode } from './components/MemoryGraph';
import { DetailPanel } from './components/DetailPanel';
import { AddMemoryBar } from './components/AddMemoryBar';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const noteCount = notes.length;
  const entityCount = entities.length;

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

      {noteCount === 0 && (
        <div className="empty-cosmos">
          <div className="empty-glyph">— Empty cosmos —</div>
          <div className="empty-headline">
            No memories yet. Speak the first one into existence below.
          </div>
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
