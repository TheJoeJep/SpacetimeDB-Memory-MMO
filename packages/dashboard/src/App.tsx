import { useState } from 'react';
import './App.css';
import { useSpacetimeDB } from 'spacetimedb/react';
import { AgentBar } from './components/AgentBar';
import { AddMemory } from './components/AddMemory';
import { MemoryList } from './components/MemoryList';
import { EntitySidebar } from './components/EntitySidebar';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();
  const [filterEntityId, setFilterEntityId] = useState<bigint | null>(null);

  if (!connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting to compound-memory-dev…</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <AgentBar />
      <div className="layout">
        <EntitySidebar selectedEntityId={filterEntityId} onSelect={setFilterEntityId} />
        <main className="main-area">
          <AddMemory />
          <MemoryList filterEntityId={filterEntityId} />
        </main>
      </div>
    </div>
  );
}

export default App;
