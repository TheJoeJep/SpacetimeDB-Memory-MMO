import './App.css';
import { useSpacetimeDB } from 'spacetimedb/react';
import { AgentBar } from './components/AgentBar';
import { AddMemory } from './components/AddMemory';
import { MemoryList } from './components/MemoryList';

function App() {
  const { isActive: connected, identity } = useSpacetimeDB();

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
      <main className="main-area">
        <AddMemory />
        <MemoryList />
      </main>
    </div>
  );
}

export default App;
