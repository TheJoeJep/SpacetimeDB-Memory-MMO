import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';
import { agentColorFromIdentity } from '../lib/agentColor';

export type GraphNodeKind = 'memory' | 'entity';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  // memory-only
  content?: string;
  authorHex?: string;
  authorColor?: string;
  createdAtMs?: number;
  // entity-only
  count?: number;
  // shared
  rawId: bigint;
  // populated by force graph
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface Props {
  onSelect: (node: GraphNode | null) => void;
  selectedId: string | null;
}

const PULSE_DURATION_MS = 4000;

export function MemoryGraph({ onSelect, selectedId }: Props) {
  const { identity } = useSpacetimeDB();
  const [notes] = useTable(tables.memoryNote);
  const [entities] = useTable(tables.entity);
  const [links] = useTable(tables.noteEntity);
  const [, force] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const newNodeMs = useRef(new Map<string, number>());

  const meHex = identity?.toHexString() ?? '';

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build graph data
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      const k = link.entityId.toString();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const nodes: GraphNode[] = [];

    for (const note of notes) {
      const authorHex = note.addedBy.toHexString();
      nodes.push({
        id: `m:${note.id.toString()}`,
        kind: 'memory',
        label: note.content.slice(0, 40),
        content: note.content,
        authorHex,
        authorColor: agentColorFromIdentity(authorHex),
        createdAtMs: Number(note.createdAt.microsSinceUnixEpoch / 1000n),
        rawId: note.id,
      });
    }

    for (const e of entities) {
      const c = counts.get(e.id.toString()) ?? 0;
      if (c === 0) continue; // skip orphan entities — clutter
      nodes.push({
        id: `e:${e.id.toString()}`,
        kind: 'entity',
        label: e.name,
        count: c,
        rawId: e.id,
      });
    }

    const edges: GraphLink[] = [];
    for (const link of links) {
      const noteKey = `m:${link.noteId.toString()}`;
      const entityKey = `e:${link.entityId.toString()}`;
      if (
        nodes.some(n => n.id === noteKey) &&
        nodes.some(n => n.id === entityKey)
      ) {
        edges.push({ source: noteKey, target: entityKey });
      }
    }

    return { nodes, links: edges };
  }, [notes, entities, links]);

  // Track newly-arrived nodes for pulse animation
  useEffect(() => {
    const now = Date.now();
    for (const n of data.nodes) {
      if (!newNodeMs.current.has(n.id)) {
        newNodeMs.current.set(n.id, now);
      }
    }
    // Repaint loop while any pulse is active
    let raf = 0;
    const tick = () => {
      const t = Date.now();
      let anyActive = false;
      for (const [, when] of newNodeMs.current) {
        if (t - when < PULSE_DURATION_MS) {
          anyActive = true;
          break;
        }
      }
      force(x => x + 1);
      if (anyActive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data.nodes]);

  const nodeRadius = (n: GraphNode) => {
    if (n.kind === 'entity') {
      return Math.max(10, Math.min(26, 8 + Math.sqrt(n.count ?? 1) * 6));
    }
    return 8;
  };

  const drawNode = (rawNode: GraphNode | { x?: number; y?: number }, ctx: CanvasRenderingContext2D, _scale: number) => {
    const n = rawNode as GraphNode;
    if (n.x === undefined || n.y === undefined) return;
    const r = nodeRadius(n);
    const isSelected = selectedId === n.id;
    const isMine = n.kind === 'memory' && n.authorHex === meHex;

    const newAt = newNodeMs.current.get(n.id);
    const pulseT = newAt ? Math.max(0, 1 - (Date.now() - newAt) / PULSE_DURATION_MS) : 0;

    // Outer halo
    if (pulseT > 0 || isSelected) {
      const haloR = r + (isSelected ? 14 : 8 + 24 * pulseT);
      const haloAlpha = isSelected ? 0.25 : 0.45 * pulseT;
      const haloColor =
        n.kind === 'memory'
          ? n.authorColor ?? '#4dd0ff'
          : '#ff7ad9';
      ctx.beginPath();
      ctx.arc(n.x, n.y, haloR, 0, 2 * Math.PI);
      ctx.fillStyle = withAlpha(haloColor, haloAlpha);
      ctx.fill();
    }

    // Glow ring
    const ringColor =
      n.kind === 'memory'
        ? (isMine ? n.authorColor ?? '#4dd0ff' : '#4dd0ff')
        : '#ff7ad9';
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 2, 0, 2 * Math.PI);
    ctx.fillStyle = withAlpha(ringColor, 0.18);
    ctx.fill();

    // Bubble core
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    const grad = ctx.createRadialGradient(
      n.x - r * 0.3,
      n.y - r * 0.3,
      r * 0.1,
      n.x,
      n.y,
      r
    );
    if (n.kind === 'memory') {
      const c = isMine ? (n.authorColor ?? '#80e3ff') : '#80e3ff';
      grad.addColorStop(0, lighten(c));
      grad.addColorStop(1, c);
    } else {
      grad.addColorStop(0, '#ffa8e8');
      grad.addColorStop(1, '#ff7ad9');
    }
    ctx.fillStyle = grad;
    ctx.fill();

    // Label
    ctx.font = `${n.kind === 'entity' ? 12 : 10}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = n.kind === 'entity' ? '#ffe1f5' : 'rgba(230, 232, 240, 0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const fullLabel =
      n.kind === 'entity'
        ? n.label
        : (n.content && n.content.length > 36 ? n.content.slice(0, 33) + '…' : n.content ?? '');
    ctx.fillText(fullLabel, n.x, n.y + r + 6);
  };

  // Auto fit-to-screen on data change (settle, then zoom).
  // Clamp max zoom so a sparse graph doesn't end up looking like 2 giant balls.
  useEffect(() => {
    if (!graphRef.current) return;
    if (data.nodes.length === 0) return;
    const t = setTimeout(() => {
      try {
        graphRef.current?.zoomToFit?.(600, 100);
        // Clamp zoom AFTER fit so few-node graphs don't max out
        const z = graphRef.current?.zoom?.();
        if (typeof z === 'number' && z > 2.5) {
          graphRef.current?.zoom?.(2.5, 400);
        }
      } catch {
        /* graph not ready yet */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [data.nodes.length]);

  return (
    <div className="graph-canvas" ref={containerRef}>
      {size.width > 0 && (
        <ForceGraph2D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={1}
          nodeCanvasObject={drawNode as never}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={() => 'rgba(140, 160, 220, 0.22)'}
          linkWidth={() => 1}
          linkDirectionalParticles={0}
          d3AlphaDecay={0.022}
          d3VelocityDecay={0.32}
          cooldownTicks={140}
          warmupTicks={60}
          onNodeClick={(node) => onSelect(node as GraphNode)}
          onBackgroundClick={() => onSelect(null)}
          enableNodeDrag
        />
      )}
    </div>
  );
}

function withAlpha(color: string, a: number): string {
  // Accepts hsl(...) or #rrggbb
  if (color.startsWith('hsl(')) {
    return color.replace('hsl(', 'hsla(').replace(')', `, ${a})`);
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}

function lighten(color: string): string {
  if (color.startsWith('hsl(')) {
    return color.replace(/(\d+)%\)/, (_m, _l) => `90%)`);
  }
  return '#ffffff';
}
