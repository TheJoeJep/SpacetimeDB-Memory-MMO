import { useEffect, useState } from 'react';
import './App.css';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';
import { tables, reducers } from './module_bindings';
import { AmbientBackground } from './components/AmbientBackground';
import { TopBar } from './components/TopBar';
import { MemoryGraph } from './components/MemoryGraph';
import type { GraphNode } from './components/MemoryGraph';
import { DetailPanel } from './components/DetailPanel';
import { AddMemoryBar } from './components/AddMemoryBar';
import { SearchPalette } from './components/SearchPalette';
import { DEFAULT_SECTIONS } from './lib/sections';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const ensureSection = useReducer(reducers.ensureSection);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [planting, setPlanting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const noteCount = notes.length;
  const entityCount = entities.length;
  const sectionCount = entities.filter(e => e.kind === 'section').length;

  // Cmd/Ctrl+K opens the search palette; '/' too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && /^(input|textarea)$/i.test(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === '/' && !inField && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const onPlantSections = async () => {
    setPlanting(true);
    for (const name of DEFAULT_SECTIONS) {
      ensureSection({ name });
      await new Promise(r => setTimeout(r, 60));
    }
    setPlanting(false);
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

      {/* Small corner toast — only shown until at least one section exists */}
      {sectionCount === 0 && (
        <div className="getstarted-toast">
          <div className="getstarted-headline">Plant sections to organize</div>
          <button
            className="getstarted-btn"
            onClick={onPlantSections}
            disabled={planting}
          >
            {planting ? 'Planting…' : `+ ${DEFAULT_SECTIONS.length} sections`}
          </button>
        </div>
      )}

      <AddMemoryBar />

      <div className="legend">
        <div className="legend-row"><span className="legend-dot section" /> Section</div>
        <div className="legend-row"><span className="legend-dot memory" /> Memory</div>
        <div className="legend-row"><span className="legend-dot entity" /> Entity</div>
      </div>

      <DetailPanel node={selected} onClose={() => setSelected(null)} onSelectNode={setSelected} />

      <SearchPalette
        open={searchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => { setSearchOpen(false); setSearchQuery(''); }}
        onSelect={(node) => setSelected(node)}
      />
    </div>
  );
}

export default App;
