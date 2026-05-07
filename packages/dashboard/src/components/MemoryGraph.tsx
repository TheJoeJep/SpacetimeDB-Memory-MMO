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
const ENTITY_COLOR = '#ff7ad9';
const MEMORY_DEFAULT_COLOR = '#4dd0ff';

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
      if (c === 0) continue; // skip orphans
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

  // Auto fit + clamp zoom
  useEffect(() => {
    if (!graphRef.current) return;
    if (data.nodes.length === 0) return;
    const t = setTimeout(() => {
      try {
        graphRef.current?.zoomToFit?.(600, 100);
        const z = graphRef.current?.zoom?.();
        if (typeof z === 'number' && z > 1.6) {
          graphRef.current?.zoom?.(1.6, 400);
        }
      } catch {
        /* not ready */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [data.nodes.length]);

  // Compute set of edges connected to selected node (for highlight)
  const connectedNodeIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const link of data.links) {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
      if (s === selectedId) set.add(t);
      if (t === selectedId) set.add(s);
    }
    return set;
  }, [selectedId, data.links]);

  const nodeRadius = (n: GraphNode) => {
    if (n.kind === 'entity') {
      const base = 16 + Math.sqrt(n.count ?? 1) * 5;
      return Math.max(18, Math.min(40, base));
    }
    // memories sized by content length, clamped
    const len = n.content?.length ?? 12;
    const base = 18 + Math.min(14, Math.sqrt(len) * 2.2);
    return Math.max(22, Math.min(34, base));
  };

  const drawNode = (rawNode: GraphNode | { x?: number; y?: number }, ctx: CanvasRenderingContext2D, _scale: number) => {
    const n = rawNode as GraphNode;
    if (n.x === undefined || n.y === undefined) return;
    const r = nodeRadius(n);
    const isSelected = selectedId === n.id;
    const dimmed = !!selectedId && !connectedNodeIds.has(n.id);

    const newAt = newNodeMs.current.get(n.id);
    const pulseT = newAt ? Math.max(0, 1 - (Date.now() - newAt) / PULSE_DURATION_MS) : 0;

    // Color: memory uses author color (or default cyan), entity uses magenta
    const ringColor =
      n.kind === 'memory'
        ? n.authorColor ?? MEMORY_DEFAULT_COLOR
        : ENTITY_COLOR;

    // Dim factor
    const op = dimmed ? 0.22 : 1;

    // Halo on selected/pulse
    if (isSelected) {
      const haloR = r + 18;
      ctx.beginPath();
      ctx.arc(n.x, n.y, haloR, 0, 2 * Math.PI);
      ctx.fillStyle = withAlpha(ringColor, 0.18);
      ctx.fill();
    } else if (pulseT > 0) {
      const haloR = r + 6 + 18 * pulseT;
      ctx.beginPath();
      ctx.arc(n.x, n.y, haloR, 0, 2 * Math.PI);
      ctx.fillStyle = withAlpha(ringColor, 0.35 * pulseT);
      ctx.fill();
    }

    // Inner subtle dark fill so labels are readable on neon
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    if (isSelected) {
      // Filled neon with gradient when selected
      const grad = ctx.createRadialGradient(n.x, n.y, r * 0.1, n.x, n.y, r);
      grad.addColorStop(0, withAlpha(ringColor, 0.95));
      grad.addColorStop(1, withAlpha(ringColor, 0.55));
      ctx.fillStyle = grad;
    } else {
      // Subtle dark inner so text reads against background
      ctx.fillStyle = `rgba(10, 14, 31, ${0.78 * op})`;
    }
    ctx.fill();

    // Neon ring
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.lineWidth = isSelected ? 2.4 : 1.6;
    ctx.strokeStyle = withAlpha(ringColor, op);
    ctx.shadowColor = withAlpha(ringColor, 0.7 * op);
    ctx.shadowBlur = isSelected ? 18 : 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner soft ring (depth)
    if (!isSelected) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r - 2.5, 0, 2 * Math.PI);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = withAlpha(ringColor, 0.18 * op);
      ctx.stroke();
    }

    // Text inside bubble
    const text = n.kind === 'entity' ? n.label : titleFromContent(n.content ?? '');
    const fontSize = n.kind === 'entity' ? 8.5 : 7.5;
    const lineHeight = fontSize + 1.5;
    ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
    const lines = wrapText(ctx, text, r * 1.7).slice(0, 3);
    if (lines.length === 3) {
      // ellipsize the last
      const last = lines[2];
      while (ctx.measureText(last + '…').width > r * 1.7 && lines[2].length > 0) {
        lines[2] = lines[2].slice(0, -1);
      }
      lines[2] = lines[2] + '…';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected
      ? '#0a0e1f'
      : withAlpha(ringColor, 0.95 * op);

    const totalH = lines.length * lineHeight;
    const startY = n.y - totalH / 2 + lineHeight / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], n.x, startY + i * lineHeight);
    }
  };

  const linkColor = (link: any) => {
    if (!selectedId) return 'rgba(140, 160, 220, 0.18)';
    const s = typeof link.source === 'string' ? link.source : link.source?.id;
    const t = typeof link.target === 'string' ? link.target : link.target?.id;
    const involved = s === selectedId || t === selectedId;
    if (!involved) return 'rgba(140, 160, 220, 0.06)';
    // Highlight color = the selected node's ring color
    const sel = data.nodes.find(n => n.id === selectedId);
    const c = sel?.kind === 'entity' ? ENTITY_COLOR : (sel?.authorColor ?? MEMORY_DEFAULT_COLOR);
    return withAlpha(c, 0.85);
  };

  const linkWidth = (link: any) => {
    if (!selectedId) return 1;
    const s = typeof link.source === 'string' ? link.source : link.source?.id;
    const t = typeof link.target === 'string' ? link.target : link.target?.id;
    return s === selectedId || t === selectedId ? 1.8 : 0.7;
  };

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
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GraphNode;
            if (n.x === undefined || n.y === undefined) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x, n.y, nodeRadius(n), 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalParticles={selectedId ? 2 : 0}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.006}
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

function titleFromContent(content: string): string {
  const trimmed = content.trim();
  // Use the first ~40 chars as the bubble label; full text shown in modal
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 38).trim();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  // Hard-wrap any remaining over-long line
  const out: string[] = [];
  for (const l of lines) {
    if (ctx.measureText(l).width <= maxWidth) {
      out.push(l);
      continue;
    }
    let cur = '';
    for (const ch of l) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) {
        out.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function withAlpha(color: string, a: number): string {
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
