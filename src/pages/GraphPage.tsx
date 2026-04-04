import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Code2, Network, Play, X } from 'lucide-react';
import { listTopicNotes, listTopics } from '../lib/dataApi';
import type { Note, Topic, TreeType } from '../types';

// ── Pyodide (client-side Python) — loaded once, shared across notes ──────────
declare global { interface Window { loadPyodide: (cfg: { indexURL: string }) => Promise<any>; } }
let _pyodideInstance: any = null;
let _pyodideLoading: Promise<any> | null = null;
async function getPyodide(): Promise<any> {
  if (_pyodideInstance) return _pyodideInstance;
  if (_pyodideLoading) return _pyodideLoading;
  _pyodideLoading = (async () => {
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Pyodide'));
        document.head.appendChild(s);
      });
    }
    const py = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' });
    _pyodideInstance = py;
    return py;
  })();
  return _pyodideLoading;
}
const RUNNABLE_LANGS = new Set(['Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Bash']);

// ── Data types ────────────────────────────────────────────────────────────────

/** isDone = user checked it; isPathway = ancestor included to preserve hierarchy */
type TNode = { topic: Topic; isDone: boolean; children: TNode[] };

type LNode = {
  topic: Topic;
  isDone: boolean;
  x: number;
  y: number;
  r: number;
  color: string;
  /** 0 = root at center, 1+ = orbital levels */
  depth: number;
  /** angle (radians) from parent toward this node — used for label offset */
  labelAngle: number;
  children: LNode[];
};

type Edge = {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  dashed: boolean;
};

// ── Tree building ─────────────────────────────────────────────────────────────

/**
 * Build a tree that includes:
 * - every topic with status === 'done'
 * - every ancestor needed to preserve the hierarchy path
 * Pathway ancestors are flagged isDone=false so we can style them differently.
 */
function buildGraphTree(topics: Topic[]): TNode[] {
  const topicMap = new Map(topics.map(t => [t.id, t]));
  const doneSet  = new Set(topics.filter(t => t.status === 'done').map(t => t.id));

  // Collect all IDs to show: done topics + their full ancestor chains
  const includeSet = new Set<string>();
  doneSet.forEach(id => {
    let cur: Topic | undefined = topicMap.get(id);
    while (cur) {
      includeSet.add(cur.id);
      cur = cur.parent_id ? topicMap.get(cur.parent_id) : undefined;
    }
  });

  // Build node map for included topics
  const included = topics.filter(t => includeSet.has(t.id));
  const nodeMap  = new Map(
    included.map(t => [t.id, { topic: t, isDone: doneSet.has(t.id), children: [] as TNode[] }]),
  );

  const roots: TNode[] = [];
  included.forEach(t => {
    const node = nodeMap.get(t.id)!;
    if (t.parent_id && includeSet.has(t.parent_id)) {
      nodeMap.get(t.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function leafCount(n: TNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0);
}

// ── Layout constants ──────────────────────────────────────────────────────────

const CX = 560;
const CY = 560;

/** Distance from each parent node to its children, per orbital level (0 = first hop from root) */
const ORBIT_RADII  = [185, 130, 92, 65, 47, 34] as const;
/** Dot radius for each orbital level */
const NODE_SIZES   = [13, 10, 8,  6.5, 5.5, 5]  as const;
/** Colors for orbital levels 0‥5 (level 0 = first ring from root) */
const ORBIT_COLORS = ['#818cf8', '#60a5fa', '#34d399', '#f97316', '#fb7185', '#e879f9'] as const;

/** Root node constants (special, placed at center) */
const ROOT_R     = 22;
const ROOT_COLOR = '#fbbf24';

/** Label typography per depth index (0 = first ring children, used for ORBIT_COLORS) */
const LABEL_FONT   = [9.5, 8.5, 7.5, 6.5, 6]    as const;
const LABEL_MAXLEN = [18,  14,  11,  9,   7]     as const;
const LABEL_OFFSET = [13,  11,  9,   7,   6]     as const;

// ── Layout functions ──────────────────────────────────────────────────────────

/**
 * Recursively place `nodes` around (px, py) within the angle sector [a0, a1].
 * `orbitLevel` is 0-based: 0 = first hop from root, 1 = second hop, etc.
 * Each node's children inherit its own sector — creating natural parent–child clusters.
 */
function layoutSubtree(
  nodes: TNode[],
  px: number,
  py: number,
  a0: number,
  a1: number,
  orbitLevel: number,
): LNode[] {
  if (!nodes.length || orbitLevel >= ORBIT_RADII.length) return [];
  const orbitR = ORBIT_RADII[orbitLevel]!;
  const size   = NODE_SIZES[orbitLevel]!;
  const color  = ORBIT_COLORS[orbitLevel % ORBIT_COLORS.length]!;
  const total  = nodes.reduce((s, n) => s + leafCount(n), 0) || 1;
  const span   = a1 - a0;
  let   angle  = a0;

  return nodes.map(n => {
    const frac   = leafCount(n) / total;
    const nodeA0 = angle;
    const nodeA1 = angle + frac * span;
    const mid    = (nodeA0 + nodeA1) / 2;
    angle        = nodeA1;
    const nx     = px + orbitR * Math.cos(mid);
    const ny     = py + orbitR * Math.sin(mid);
    return {
      topic:      n.topic,
      isDone:     n.isDone,
      x:          nx,
      y:          ny,
      r:          size,
      color,
      depth:      orbitLevel + 1,  // 1-based for display
      labelAngle: mid,
      children:   layoutSubtree(n.children, nx, ny, nodeA0, nodeA1, orbitLevel + 1),
    };
  });
}

/** Flatten a laid-out tree into parallel lists of edges and nodes. */
function traverse(
  nodes: LNode[],
  px: number,
  py: number,
  parentDone: boolean,
  edges: Edge[],
  allNodes: LNode[],
) {
  for (const n of nodes) {
    edges.push({
      x1: px, y1: py, x2: n.x, y2: n.y,
      color: n.color,
      dashed: !n.isDone || !parentDone,
    });
    allNodes.push(n);
    traverse(n.children, n.x, n.y, n.isDone, edges, allNodes);
  }
}

/** Full graph layout: single root → center; multiple roots → orbit center. */
function buildLayout(topics: Topic[]) {
  const roots:    TNode[] = buildGraphTree(topics);
  const edges:    Edge[]  = [];
  const allNodes: LNode[] = [];

  if (roots.length === 0) return { edges, allNodes };

  if (roots.length === 1) {
    // Single root at absolute center — it becomes the visual "sun"
    const r = roots[0]!;
    const rootNode: LNode = {
      topic:      r.topic,
      isDone:     r.isDone,
      x:          CX,
      y:          CY,
      r:          ROOT_R,
      color:      ROOT_COLOR,
      depth:      0,
      labelAngle: 0,
      children:   layoutSubtree(r.children, CX, CY, -Math.PI / 2, Math.PI * 1.5, 0),
    };
    allNodes.push(rootNode);
    traverse(rootNode.children, CX, CY, rootNode.isDone, edges, allNodes);
  } else {
    // Multiple roots orbit virtual center
    const laid = layoutSubtree(roots, CX, CY, -Math.PI / 2, Math.PI * 1.5, 0);
    laid.forEach(n => {
      edges.push({ x1: CX, y1: CY, x2: n.x, y2: n.y, color: n.color, dashed: !n.isDone });
      allNodes.push(n);
      traverse(n.children, n.x, n.y, n.isDone, edges, allNodes);
    });
  }
  return { edges, allNodes };
}
// ── Note card (collapsible) ─────────────────────────────────────────────────

function NoteCard({ note, accentColor }: { note: Note; accentColor: string }) {
  const [open, setOpen] = useState(true);
  const [runningIdx, setRunningIdx] = useState<number | null>(null);
  const [blockOutputs, setBlockOutputs] = useState<Record<number, { stdout: string; stderr: string; exitCode: number; plotImages?: string[] }>>({});
  const hasExtra = !!(note.code_example || (note.code_blocks?.length ?? 0) > 0);

  const handleRunCode = async (code: string, language: string, idx: number) => {
    if (!code.trim() || !RUNNABLE_LANGS.has(language)) return;
    setRunningIdx(idx);
    setBlockOutputs(prev => { const n = { ...prev }; delete n[idx]; return n; });

    if (language === 'Python') {
      try {
        const py = await getPyodide();
        let stdout = ''; let stderr = '';
        py.setStdout({ batched: (s: string) => { stdout += s + '\n'; } });
        py.setStderr({ batched: (s: string) => { stderr += s + '\n'; } });
        await py.runPythonAsync(`
_plot_images = []
try:
    import matplotlib as _mpl
    _mpl.use('Agg')
    import matplotlib.pyplot as _plt
    import io as _io, base64 as _b64
    def _show_capture(*a, **kw):
        buf = _io.BytesIO()
        _plt.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        _plot_images.append(_b64.b64encode(buf.read()).decode())
        _plt.close('all')
    _plt.show = _show_capture
except ImportError:
    pass
        `);
        await py.loadPackagesFromImports(code);
        let exitCode = 0;
        try { await py.runPythonAsync(code); } catch (e: unknown) { stderr = String(e); exitCode = 1; }
        const rawImages = py.runPython('_plot_images');
        const plotImages: string[] = rawImages?.toJs?.() ?? [];
        setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode, plotImages } }));
      } catch (err: unknown) {
        setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: '', stderr: String(err instanceof Error ? err.message : err), exitCode: 1 } }));
      } finally { setRunningIdx(null); }
      return;
    }

    try {
      const resp = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      });
      const data = await resp.json() as any;
      if (!resp.ok) throw new Error(data?.error ?? `Execution failed (${resp.status})`);
      const typed = data as { run: { stdout: string; stderr: string; code: number } };
      setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: typed.run.stdout ?? '', stderr: typed.run.stderr ?? '', exitCode: typed.run.code ?? 0 } }));
    } catch (err: unknown) {
      setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: '', stderr: String(err instanceof Error ? err.message : err), exitCode: 1 } }));
    } finally { setRunningIdx(null); }
  };

  return (
    <div style={{
      marginBottom: '8px',
      border: `1px solid ${accentColor}25`,
      borderRadius: '8px',
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.025)',
    }}>
      {/* Note title bar */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ color: accentColor, flexShrink: 0, opacity: 0.8 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)', flex: 1 }}>
          {note.title}
        </span>
        {hasExtra && (
          <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <Code2 size={11} color={accentColor} opacity={0.6} />
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 12px 11px' }}>
          {/* Body text */}
          <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {note.content}
          </p>

          {/* Legacy single code block */}
          {note.code_example && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                <Code2 size={10} color="#818cf8" />
                <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Code</span>
              </div>
              <pre style={{
                margin: 0, padding: '9px 11px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '6px',
                fontSize: '0.73rem', color: '#a5f3fc',
                lineHeight: 1.6, overflowX: 'auto',
                whiteSpace: 'pre', fontFamily: 'ui-monospace, Menlo, monospace',
                border: '1px solid rgba(129,140,248,0.2)',
              }}><code>{note.code_example}</code></pre>
            </div>
          )}

          {/* Multi-language code blocks */}
          {(note.code_blocks?.length ?? 0) > 0 && note.code_blocks!.map((block, idx) => (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <Code2 size={10} color="#818cf8" />
                <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{block.language}</span>
                {RUNNABLE_LANGS.has(block.language) && (
                  <button
                    type="button"
                    className="cb-run-btn"
                    onClick={() => void handleRunCode(block.code, block.language, idx)}
                    disabled={runningIdx === idx || !block.code.trim()}
                  >
                    <Play size={10} />
                    {runningIdx === idx ? 'Running…' : 'Run'}
                  </button>
                )}
              </div>
              <pre style={{
                margin: 0, padding: '9px 11px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '6px',
                fontSize: '0.73rem', color: '#a5f3fc',
                lineHeight: 1.6, overflowX: 'auto',
                whiteSpace: 'pre', fontFamily: 'ui-monospace, Menlo, monospace',
                border: '1px solid rgba(129,140,248,0.2)',
              }}><code>{block.code}</code></pre>
              {blockOutputs[idx] !== undefined && (
                <div className="cb-output">
                  <div className="cb-output-header">
                    <span className={`cb-output-status ${blockOutputs[idx].exitCode === 0 ? 'cb-output-status--ok' : 'cb-output-status--err'}`}>
                      {blockOutputs[idx].exitCode === 0 ? '✓ exit 0' : `✗ exit ${blockOutputs[idx].exitCode}`}
                    </span>
                    <button type="button" className="cb-output-clear" onClick={() => setBlockOutputs(prev => { const n = { ...prev }; delete n[idx]; return n; })} title="Clear">
                      <X size={11} />
                    </button>
                  </div>
                  <pre className="cb-output-pre">
                    {(blockOutputs[idx].stdout + (blockOutputs[idx].stdout && blockOutputs[idx].stderr ? '\n' : '') + blockOutputs[idx].stderr).trimEnd() || '(no output)'}
                  </pre>
                  {blockOutputs[idx].plotImages?.map((img, i) => (
                    <img key={i} src={`data:image/png;base64,${img}`} alt={`plot ${i + 1}`} style={{ maxWidth: '100%', marginTop: '8px', borderRadius: '4px', display: 'block' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Group of notes for one topic, with a collapsible header */
function TopicNoteGroup({
  title, color, notes, defaultOpen = true,
}: { title: string; color: string; notes: Note[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '18px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: open ? '10px' : '0',
          padding: '6px 0', background: 'none', border: 'none',
          borderBottom: `1px solid ${color}30`,
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontWeight: 700, fontSize: '0.84rem', color, flex: 1 }}>{title}</span>
        <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.3)', marginRight: '4px' }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown size={12} color={color} /> : <ChevronRight size={12} color={color} />}
      </button>
      {open && notes.map(n => <NoteCard key={n.id} note={n} accentColor={color} />)}
    </div>
  );
}
// ── Component ─────────────────────────────────────────────────────────────────

export function GraphPage() {
  const [topics,       setTopics]       = useState<Topic[]>([]);
  const [notes,        setNotes]        = useState<Note[]>([]);
  const [activeTree,   setActiveTree]   = useState<TreeType>('ai');
  const [hovered,      setHovered]      = useState<LNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<LNode | null>(null);
  const [view,         setView]         = useState({ x: 0, y: 0, scale: 1 });
  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth <= 768);
  const [searchParams] = useSearchParams();

  const dragging     = useRef(false);
  const lastPos      = useRef({ x: 0, y: 0 });
  const containerRef  = useRef<HTMLDivElement>(null);
  const sidePanelRef  = useRef<HTMLDivElement>(null);
  const viewRef      = useRef({ x: 0, y: 0, scale: 1 });
  const animRef      = useRef<number | null>(null);
  const touchRef     = useRef<{ startX: number; startY: number; startVX: number; startVY: number; lastDist: number | null }>({
    startX: 0, startY: 0, startVX: 0, startVY: 0, lastDist: null,
  });
  // Keep viewRef in sync so animateTo always reads the latest view
  viewRef.current = view;

  useEffect(() => {
    void Promise.all([listTopics(activeTree), listTopicNotes()])
      .then(([t, n]) => { setTopics(t); setNotes(n); })
      .catch(console.error);
  }, [activeTree]);

  // Track mobile breakpoint
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Non-passive wheel listener for zoom — re-runs once the canvas mounts (doneCount > 0)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      // Don't zoom when scrolling inside the notes side panel
      if (sidePanelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      // Zoom towards the mouse cursor position inside the SVG
      const rect   = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView(v => {
        const newScale = Math.min(5, Math.max(0.15, v.scale * factor));
        const ratio    = newScale / v.scale;
        return {
          scale: newScale,
          x:     mouseX - ratio * (mouseX - v.x),
          y:     mouseY - ratio * (mouseY - v.y),
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length]);  // re-attach once topics load and canvas renders

  // Non-passive touch listeners for pan + pinch-zoom on mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        touchRef.current = { startX: t.clientX, startY: t.clientY, startVX: viewRef.current.x, startVY: viewRef.current.y, lastDist: null };
      } else if (e.touches.length === 2) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        touchRef.current.lastDist = Math.hypot(dx, dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0]!;
        const dx = t.clientX - touchRef.current.startX;
        const dy = t.clientY - touchRef.current.startY;
        setView(v => ({ ...v, x: touchRef.current.startVX + dx, y: touchRef.current.startVY + dy }));
      } else if (e.touches.length === 2) {
        const dx = e.touches[1]!.clientX - e.touches[0]!.clientX;
        const dy = e.touches[1]!.clientY - e.touches[0]!.clientY;
        const dist = Math.hypot(dx, dy);
        if (touchRef.current.lastDist !== null && touchRef.current.lastDist > 0) {
          const ratio = dist / touchRef.current.lastDist;
          setView(v => ({ ...v, scale: Math.max(0.15, Math.min(5, v.scale * ratio)) }));
        }
        touchRef.current.lastDist = dist;
      }
    };
    const onTouchEnd = () => { touchRef.current.lastDist = null; };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length]);

  const { edges, allNodes } = useMemo(() => buildLayout(topics), [topics]);

  // Notes grouped by topic id
  const notesByTopic = useMemo(() =>
    notes.reduce<Record<string, Note[]>>((acc, n) => {
      if (!n.topic_id) return acc;
      (acc[n.topic_id] ??= []).push(n);
      return acc;
    }, {}),
  [notes]);

  /** Smoothly animate the viewport to `target` over 1.8 s (ease-out quartic). */
  const animateTo = useCallback((target: { x: number; y: number; scale: number }) => {
    if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    const from      = { ...viewRef.current };
    const startTime = performance.now();
    const DURATION  = 1800;
    const step = (now: number) => {
      const t    = Math.min((now - startTime) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 4); // ease-out quartic
      setView({
        x:     from.x     + (target.x     - from.x)     * ease,
        y:     from.y     + (target.y     - from.y)     * ease,
        scale: from.scale + (target.scale - from.scale) * ease,
      });
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else       animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Centre on ?focus=TOPIC_ID once allNodes is computed
  const focusHandled = useRef(false);
  useEffect(() => {
    if (focusHandled.current || allNodes.length === 0) return;
    const focusId = searchParams.get('focus');
    if (!focusId) return;
    const target = allNodes.find(n => n.topic.id === focusId);
    if (!target) return;
    focusHandled.current = true;
    const s = 2.2;
    animateTo({ x: s * (CX - target.x), y: s * (CY - target.y), scale: s });
    setSelectedNode(target);
  }, [allNodes, searchParams, animateTo]);

  const doneCount  = useMemo(() => topics.filter(t => t.status === 'done').length, [topics]);
  const totalNodes = allNodes.length;

  const handleNodeClick = useCallback((n: LNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(prev => prev?.topic.id === n.topic.id ? null : n);
  }, []);

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Cancel any in-progress animation so the user can take over immediately
    if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  // SVG transform: zoom anchored on center (CX, CY) + pan offset
  const tx = view.x + CX * (1 - view.scale);
  const ty = view.y + CY * (1 - view.scale);

  return (
    <div className="graph-page-stack">

      {/* Header */}
      <div className="tr-page-bar">
        <div className="tr-page-bar-left">
          <h2>Knowledge Graph</h2>
          <p>Your mastered topics visualised — only ✓ checked items appear</p>
        </div>
        <div className="tr-page-bar-right gp-header-controls">
          {/* Tree switcher */}
          <div className="tr-tree-switcher">
            <button
              type="button"
              className={`tr-tree-tab${activeTree === 'ai' ? ' tr-tree-tab-active' : ''}`}
              onClick={() => { setActiveTree('ai'); setTopics([]); setSelectedNode(null); }}
            >
              <span className="tr-tree-tab-icon">🤖</span>
              AI Tree
            </button>
            <button
              type="button"
              className={`tr-tree-tab${activeTree === 'fullstack' ? ' tr-tree-tab-active' : ''}`}
              onClick={() => { setActiveTree('fullstack'); setTopics([]); setSelectedNode(null); }}
            >
              <span className="tr-tree-tab-icon">🌐</span>
              Full Stack
            </button>
          </div>
          <span className="gp-count-label">
            {doneCount} mastered · {totalNodes} nodes shown
          </span>
          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px 4px' }}>
            <button
              className="secondary-button"
              onClick={() => setView(v => ({ ...v, scale: Math.min(5, v.scale * 1.3) }))}
              style={{ fontSize: '1rem', padding: '2px 9px', lineHeight: 1, fontWeight: 700, minWidth: 0 }}
              title="Zoom in"
            >+</button>
            <span style={{ fontSize: '0.72rem', color: 'var(--tk-text-muted)', minWidth: '38px', textAlign: 'center' }}>
              {Math.round(view.scale * 100)}%
            </span>
            <button
              className="secondary-button"
              onClick={() => setView(v => ({ ...v, scale: Math.max(0.15, v.scale / 1.3) }))}
              style={{ fontSize: '1rem', padding: '2px 9px', lineHeight: 1, fontWeight: 700, minWidth: 0 }}
              title="Zoom out"
            >−</button>
          </div>
          <button
            className="secondary-button"
            onClick={() => { if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; } setView({ x: 0, y: 0, scale: 1 }); }}
            style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Empty state */}
      {doneCount === 0 ? (
        <div
          className="glass-card gp-empty-card"
          style={{
            minHeight: '460px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px',
          }}
        >
          <Network size={56} style={{ color: 'var(--tk-text-muted)', opacity: 0.25 }} />
          <h3 style={{ margin: 0, fontWeight: 600 }}>No mastered topics yet</h3>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--tk-text-muted)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.75 }}>
            Go to the <strong>{activeTree === 'ai' ? 'AI Tree' : 'Full Stack'}</strong> page and check ✓ topics as you master them.
            Each one you check will appear here as a node in your knowledge graph.
          </p>
        </div>
      ) : (
        /* Graph canvas */
        <div
          ref={containerRef}
          className="gp-canvas"
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            background: 'radial-gradient(ellipse at 50% 42%, #0d1030 0%, #050710 100%)',
            border: '1px solid rgba(99,102,241,0.22)',
            position: 'relative',
            cursor: 'grab',
            userSelect: 'none',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onClick={() => setSelectedNode(null)}
        >
          {/* Hint */}
          <p style={{
            position: 'absolute', top: 13, left: 16, margin: 0,
            fontSize: '0.69rem', color: 'rgba(255,255,255,0.25)',
            pointerEvents: 'none', zIndex: 5,
          }}>
            Pinch/scroll to zoom · Swipe/drag to pan
          </p>

          {/* Legend */}
          <div style={{
            position: 'absolute', top: 13, right: 16,
            display: 'flex', flexDirection: 'column', gap: '5px',
            zIndex: 5,
          }}>
            {(['Level 1','Level 2','Level 3','Level 4+'] as const).map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: ORBIT_COLORS[i],
                  boxShadow: `0 0 7px ${ORBIT_COLORS[i]}99`,
                }} />
                <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.38)' }}>{label}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '3px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: 'transparent',
                border: '1.5px dashed rgba(255,255,255,0.3)',
              }} />
              <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.28)' }}>Pathway (not yet ✓)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: ORBIT_COLORS[0],
                boxShadow: `0 0 7px ${ORBIT_COLORS[0]}99`,
              }} />
              <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.38)' }}>Mastered (✓)</span>
            </div>
          </div>

          {/* Hover tooltip */}
          {hovered && (
            <div style={{
              position: 'absolute', bottom: 18, left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(6,8,22,0.92)',
              border: `1px solid ${hovered.color}55`,
              borderRadius: '9px',
              padding: '7px 18px',
              fontSize: '0.84rem', fontWeight: 600,
              color: hovered.color,
              pointerEvents: 'none',
              zIndex: 20, whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
              boxShadow: `0 0 24px ${hovered.color}22`,
            }}>
              {hovered.topic.title}
              <span style={{ marginLeft: '8px', opacity: 0.45, fontSize: '0.7rem', fontWeight: 400 }}>
                depth {hovered.depth}
              </span>
              <span style={{
                marginLeft: '8px', fontSize: '0.7rem', fontWeight: 600,
                color: hovered.isDone ? '#34d399' : 'rgba(255,255,255,0.3)',
              }}>
                {hovered.isDone ? '✓ mastered' : '○ pathway'}
              </span>
            </div>
          )}

          {/* SVG */}
          <svg
            viewBox="0 0 1120 1120"
            width="100%"
            height="100%"
            style={{ display: 'block', minHeight: '100%' }}
          >
            <g transform={`translate(${tx} ${ty}) scale(${view.scale})`}>

              {/* Subtle center glow */}
              <circle cx={CX} cy={CY} r={90} fill="rgba(255,255,255,0.008)" />
              <circle cx={CX} cy={CY} r={45} fill="rgba(255,255,255,0.014)" />

              {/* Edges — solid for done→done, dashed for pathway links */}
              {edges.map((e, i) => (
                <line
                  key={i}
                  x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={e.color}
                  strokeWidth={e.dashed ? '1' : '1.4'}
                  strokeOpacity={e.dashed ? '0.15' : '0.38'}
                  strokeDasharray={e.dashed ? '4 7' : undefined}
                />
              ))}

              {/* Node halos */}
              {allNodes.map((n, i) => (
                <circle
                  key={i}
                  cx={n.x} cy={n.y}
                  r={hovered?.topic.id === n.topic.id ? n.r * 3.2 : n.r * 1.9}
                  fill={n.color}
                  opacity={hovered?.topic.id === n.topic.id ? 0.18 : (n.isDone ? 0.08 : 0.03)}
                  style={{ transition: 'r 0.18s, opacity 0.18s' }}
                />
              ))}

              {/* Nodes */}
              {allNodes.map((n, i) => (
                <g key={i}>
                  {n.isDone ? (
                    /* Solid glowing dot for mastered topics */
                    <circle
                      cx={n.x} cy={n.y} r={n.r}
                      fill={n.color}
                      opacity="0.93"
                      style={{ cursor: 'pointer', filter: `drop-shadow(0 0 ${n.r * 0.9}px ${n.color}88)` }}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={e => handleNodeClick(n, e)}
                    />
                  ) : (
                    /* Hollow dashed ring for pathway (not-yet-mastered) ancestors */
                    <>
                      <circle
                        cx={n.x} cy={n.y} r={n.r}
                        fill="rgba(0,0,0,0.35)"
                        stroke={n.color}
                        strokeWidth="1.2"
                        strokeOpacity="0.45"
                        strokeDasharray="3 3"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHovered(n)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={e => handleNodeClick(n, e)}
                      />
                    </>
                  )}
                  {/* Selected ring */}
                  {selectedNode?.topic.id === n.topic.id && (
                    <circle
                      cx={n.x} cy={n.y} r={n.r + 4}
                      fill="none"
                      stroke={n.color}
                      strokeWidth="2"
                      strokeOpacity="0.9"
                    />
                  )}
                  {/* Bright ring on hover */}
                  {hovered?.topic.id === n.topic.id && selectedNode?.topic.id !== n.topic.id && (
                    <circle
                      cx={n.x} cy={n.y} r={n.r + 2.5}
                      fill="none"
                      stroke={n.color}
                      strokeWidth="1.5"
                      strokeOpacity="0.7"
                    />
                  )}
                </g>
              ))}

              {/* Labels on ALL nodes — direction uses labelAngle (radially outward from parent) */}
              {allNodes.map(n => {
                const di     = Math.max(0, Math.min(n.depth - 1, LABEL_FONT.length - 1));
                const fs     = n.depth === 0 ? 13 : LABEL_FONT[di]!;
                const ml     = n.depth === 0 ? 22  : LABEL_MAXLEN[di]!;
                const off    = n.depth === 0 ? ROOT_R + 16 : n.r + LABEL_OFFSET[di]!;
                const lbl    = n.topic.title.length > ml
                  ? n.topic.title.slice(0, ml - 1) + '…'
                  : n.topic.title;
                let lx: number, ly: number;
                let anchor: 'start' | 'end' | 'middle';
                if (n.depth === 0) {
                  lx = CX; ly = CY + ROOT_R + 17; anchor = 'middle';
                } else {
                  const cos = Math.cos(n.labelAngle);
                  lx     = n.x + off * cos;
                  ly     = n.y + off * Math.sin(n.labelAngle) + 3;
                  anchor = cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle';
                }
                const isHov = hovered?.topic.id === n.topic.id;
                return (
                  <text
                    key={n.topic.id}
                    x={lx} y={ly}
                    textAnchor={anchor}
                    fontSize={fs}
                    fontWeight={n.depth <= 1 || isHov ? '700' : '400'}
                    fill={isHov ? n.color : n.isDone ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)'}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {lbl}
                  </text>
                );
              })}
            </g>
          </svg>

          {/* ── Desktop side panel (right rail) ── */}
          {selectedNode && !isMobile && (
            <div
              ref={sidePanelRef}
              onClick={e => e.stopPropagation()}
              className="gp-side-panel"
              style={{
                background: 'rgba(4,6,18,0.97)',
                borderLeft: `1px solid ${selectedNode.color}40`,
                backdropFilter: 'blur(24px)',
                display: 'flex', flexDirection: 'column',
                zIndex: 30,
              }}
            >
              {/* ── Sticky header ── */}
              <div style={{
                padding: '16px 16px 12px',
                borderBottom: `1px solid ${selectedNode.color}30`,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${selectedNode.color}12 0%, rgba(4,6,18,0) 100%)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', marginTop: '3px',
                    background: selectedNode.color, flexShrink: 0,
                    boxShadow: `0 0 10px ${selectedNode.color}99`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', lineHeight: 1.3, wordBreak: 'break-word' }}>
                      {selectedNode.topic.title}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.67rem', fontWeight: 600,
                        color: selectedNode.isDone ? '#34d399' : 'rgba(255,255,255,0.3)',
                        background: selectedNode.isDone ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selectedNode.isDone ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '4px', padding: '1px 7px',
                      }}>
                        {selectedNode.isDone ? '✓ mastered' : '○ pathway'}
                      </span>
                      <span style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.25)' }}>
                        Level {selectedNode.depth}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px', padding: '5px 6px', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.4)', lineHeight: 1, flexShrink: 0,
                    }}
                    aria-label="Close"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* ── Scrollable body ── */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px' }}>

                {/* Own notes */}
                {(notesByTopic[selectedNode.topic.id] ?? []).length > 0 ? (
                  <TopicNoteGroup
                    title={selectedNode.topic.title}
                    color={selectedNode.color}
                    notes={notesByTopic[selectedNode.topic.id] ?? []}
                    defaultOpen
                  />
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 14px', marginBottom: '16px',
                    background: 'rgba(255,255,255,0.025)',
                    borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <BookOpen size={13} color="rgba(255,255,255,0.2)" />
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                      No notes for this topic yet.
                    </span>
                  </div>
                )}

                {/* Children notes */}
                {selectedNode.children.length > 0 &&
                  selectedNode.children.some(c => (notesByTopic[c.topic.id] ?? []).length > 0) && (
                  <>
                    <div style={{
                      fontSize: '0.67rem', fontWeight: 700,
                      color: 'rgba(255,255,255,0.22)',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      marginBottom: '12px', marginTop: '4px',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                      Children notes
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                    </div>
                    {selectedNode.children
                      .filter(c => (notesByTopic[c.topic.id] ?? []).length > 0)
                      .map(child => (
                        <TopicNoteGroup
                          key={child.topic.id}
                          title={child.topic.title}
                          color={child.color}
                          notes={notesByTopic[child.topic.id] ?? []}
                          defaultOpen={false}
                        />
                      ))
                    }
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile full-screen node modal ── */}
      {selectedNode && isMobile && (
        <div className="gp-mobile-modal" onClick={e => e.stopPropagation()}>
          {/* Header with back button */}
          <div className="gp-mobile-modal-header" style={{ borderBottom: `1px solid ${selectedNode.color}30` }}>
            <button className="gp-mobile-modal-back" onClick={() => setSelectedNode(null)}>
              <ArrowLeft size={15} />
              Back to graph
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedNode.topic.title}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 600,
                  color: selectedNode.isDone ? '#34d399' : 'rgba(255,255,255,0.3)',
                  background: selectedNode.isDone ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selectedNode.isDone ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px', padding: '1px 7px',
                }}>
                  {selectedNode.isDone ? '✓ mastered' : '○ pathway'}
                </span>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedNode.color, boxShadow: `0 0 6px ${selectedNode.color}` }} />
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="gp-mobile-modal-body">
            {(notesByTopic[selectedNode.topic.id] ?? []).length > 0 ? (
              <TopicNoteGroup
                title={selectedNode.topic.title}
                color={selectedNode.color}
                notes={notesByTopic[selectedNode.topic.id] ?? []}
                defaultOpen
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 14px', marginBottom: '16px',
                background: 'rgba(255,255,255,0.025)',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <BookOpen size={13} color="rgba(255,255,255,0.2)" />
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                  No notes for this topic yet.
                </span>
              </div>
            )}
            {selectedNode.children.length > 0 &&
              selectedNode.children.some(c => (notesByTopic[c.topic.id] ?? []).length > 0) && (
              <>
                <div style={{
                  fontSize: '0.67rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.22)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '12px', marginTop: '4px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                  Children notes
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                </div>
                {selectedNode.children
                  .filter(c => (notesByTopic[c.topic.id] ?? []).length > 0)
                  .map(child => (
                    <TopicNoteGroup
                      key={child.topic.id}
                      title={child.topic.title}
                      color={child.color}
                      notes={notesByTopic[child.topic.id] ?? []}
                      defaultOpen={false}
                    />
                  ))
                }
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
