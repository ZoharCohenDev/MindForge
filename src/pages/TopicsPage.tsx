import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  FolderPlus,
  FunctionSquare,
  Lightbulb,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createTopicNote,
  updateTopicNote,
  uploadNoteAttachment,
  createTree,
  seedTreeWithSeedNode,
} from "../lib/dataApi";
import { treeService } from "../lib/treeService";
import { SEED_TREES, getSeedTreeBySlug } from "../data/seedTrees";
import { useTreeGeneration } from "../lib/useTreeGeneration";
import { GenerationProgress } from "../components/GenerationProgress";
import type { Attachment, CodeBlock, Note, SubExpression, Topic, Tree, TreeNode } from "../types";
import {
  sortTreeNodes,
  calcTreeProgress,
  makeExpandToDepth,
} from "../lib/treeUtils";
import { useTreeEditor } from "../lib/useTreeEditor";

type ModalState =
  | { type: "subject"; topic: Topic }
  | { type: "concept"; topic: Topic }
  | { type: "note"; topic: Topic }
  | { type: "edit-note"; note: Note; topic: Topic }
  | { type: "view-notes"; topic: Topic }
  | null;




function getTopicPath(topicId: string, allTopics: Topic[]): string {
  const map = new Map(allTopics.map((t) => [t.id, t]));
  const path: string[] = [];
  let cur = map.get(topicId);
  while (cur) {
    path.unshift(cur.title);
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return path.join(' → ');
}

// ---------------------------------------------------------------------------
// Pyodide (client-side Python) — loaded once, cached for the session
// ---------------------------------------------------------------------------
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

// ── Module-level constants (stable across renders) ─────────────────────────
const CAREER_EXAMPLES = ['AI Engineer', 'Full Stack Developer', 'Data Scientist', 'DevOps Engineer', 'Cybersecurity Analyst'];
const TREE_ICON_OPTIONS = ['🌱', '🧠', '💻', '🔬', '🎨', '📚', '⚡', '🚀', '🌍', '🎯', '🤖', '🌐'];
const CONVERT_LANGS = ['Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','SQL','Bash'];
const PISTON_LANG_MAP = new Set(['Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Bash']);

export function TopicsPage() {
  const [trees, setTrees] = useState<Tree[]>([]);
  const [activeTree, setActiveTree] = useState<Tree | null>(null);
  const [view, setView] = useState<'list' | 'open'>('list');
  const [isLoadingTrees, setIsLoadingTrees] = useState(true);
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tree editor — owns all node/note state for the currently-open tree.
  const editor = useTreeEditor(activeTree);
  // Create-tree modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'ai' | 'blank'>('ai');
  // AI generation flow
  const [genGoal, setGenGoal] = useState('');
  const gen = useTreeGeneration();
  // Blank create flow
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeDesc, setNewTreeDesc] = useState('');
  const [newTreeIcon, setNewTreeIcon] = useState('\uD83C\uDF31');
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Confirm-delete tree
  const [confirmDeleteTreeId, setConfirmDeleteTreeId] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [childTitle, setChildTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [noteMath, setNoteMath] = useState("");
  const [showMathBlock, setShowMathBlock] = useState(false);
  const [subExpressions, setSubExpressions] = useState<SubExpression[]>([]);
  const [subExprExpression, setSubExprExpression] = useState("");
  const [subExprName, setSubExprName] = useState("");
  const [subExprValue, setSubExprValue] = useState("");
  const [showSubExprForm, setShowSubExprForm] = useState(false);
  const [isSavingModal, setIsSavingModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Per-block convert state
  const [convertingIdx, setConvertingIdx] = useState<number | null>(null);
  const [convertTargets, setConvertTargets] = useState<Record<number, string>>({});
  const [convertErrors, setConvertErrors] = useState<Record<number, string>>({});
  // Per-block run state
  const [runningIdx, setRunningIdx] = useState<number | null>(null);
  const [blockOutputs, setBlockOutputs] = useState<Record<number, { stdout: string; stderr: string; exitCode: number; plotImages?: string[] }>>({});
  const [noteAttachments, setNoteAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'topic'; id: string; label: string }
    | { kind: 'note'; id: string; label: string }
    | null
  >(null);

  // Load trees once on mount. Do not auto-open — show the list view first.
  useEffect(() => {
    void (async () => {
      try {
        const treeRows = await treeService.getAll();
        setTrees(treeRows);
      } catch (err) {
        console.error(err);
        setError('Could not load your trees.');
      } finally {
        setIsLoadingTrees(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSubjectModal = (topic: Topic) => {
    setModal({ type: "subject", topic });
    setChildTitle("");
  };

  const openConceptModal = (topic: Topic) => {
    setModal({ type: "concept", topic });
    setChildTitle("");
  };

  const openNoteModal = (topic: Topic) => {
    setModal({ type: "note", topic });
    setNoteTitle("");
    setNoteContent("");
    setCodeBlocks([]);
    setNoteMath("");
    setShowMathBlock(false);
    setSubExpressions([]);
    setSubExprExpression("");
    setSubExprName("");
    setSubExprValue("");
    setShowSubExprForm(false);
    setNoteAttachments([]);
  };

  const openEditNoteModal = (note: Note, topic: Topic) => {
    setModal({ type: "edit-note", note, topic });
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setCodeBlocks(note.code_blocks ?? []);
    setNoteMath(note.math_expression ?? "");
    setShowMathBlock(!!note.math_expression);
    setSubExpressions(note.sub_expressions ?? []);
    setSubExprExpression("");
    setSubExprName("");
    setSubExprValue("");
    setShowSubExprForm(false);
    setNoteAttachments(note.attachments ?? []);
  };

  const openViewNotesModal = (topic: Topic) => {
    setModal({ type: "view-notes", topic });
  };

  const closeModal = () => {
    setModal(null);
    setChildTitle("");
    setNoteTitle("");
    setNoteContent("");
    setCodeBlocks([]);
    setNoteMath("");
    setShowMathBlock(false);
    setSubExpressions([]);
    setSubExprExpression("");
    setSubExprName("");
    setSubExprValue("");
    setShowSubExprForm(false);
    setSelectedNoteId(null);
    setConfirmDelete(null);
    setAiError(null);
    setIsGenerating(false);
    setConvertingIdx(null);
    setConvertTargets({});
    setConvertErrors({});
    setRunningIdx(null);
    setBlockOutputs({});
    setNoteAttachments([]);
    setUploadingFile(false);
  };

  const insertMathSymbol = (symbol: string) => {
    setNoteMath((prev) => prev + symbol);
  };

  const addSubExpression = () => {
    if (subExprExpression.trim() && subExprName.trim() && subExprValue.trim()) {
      setSubExpressions((prev) => [
        ...prev,
        { expression: subExprExpression.trim(), name: subExprName.trim(), value: subExprValue.trim() },
      ]);
      setSubExprExpression("");
      setSubExprName("");
      setSubExprValue("");
    }
  };

  const handleSeed = async () => {
    if (!activeTree) return;
    setIsSeeding(true);
    editor.setEditorError(null);
    try {
      const seededTree = await treeService.seedFromTemplate(activeTree.slug);
      setTrees(prev => prev.map(t => t.id === seededTree.id ? seededTree : t));
      setActiveTree(seededTree);
      // Force topic reload; tree id is unchanged so closure activeTree.id works.
      await editor.refresh();
    } catch (err) {
      console.error(err);
      editor.setEditorError(`Could not seed the ${activeTree.name} tree.`);
    } finally {
      setIsSeeding(false);
    }
  };

  // ── Tree list view handlers ───────────────────────────────────────────────

  const handleOpenTree = (tree: Tree) => {
    setActiveTree(tree);
    setView('open');
  };

  const handleBackToList = () => {
    setView('list');
    setActiveTree(null);
    // editor clears its own topics/notes when activeTree becomes null.
  };

  const openCreateModal = () => {
    setCreateMode('ai');
    setGenGoal('');
    gen.reset();
    setNewTreeName('');
    setNewTreeDesc('');
    setNewTreeIcon('\uD83C\uDF31');
    setCreateError(null);
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (gen.phase === 'generating') return; // block close while generating
    gen.reset();
    setCreateOpen(false);
  };

  const handleGenerateTree = async () => {
    const goal = genGoal.trim();
    if (!goal) return;
    try {
      const payload = await gen.generate(goal);
      if (!payload) return; // aborted
      const tree = await createTree({
        name: payload.name,
        description: payload.description,
        icon: payload.icon,
      });
      await seedTreeWithSeedNode(tree.id, tree.slug, payload.tree);
      setTrees(prev => [...prev, tree]);
      setCreateOpen(false);
      gen.reset();
      handleOpenTree(tree);
    } catch (err) {
      console.error(err);
      // gen.phase is already 'error' from the hook
    }
  };

  const handleCreateTree = async () => {
    const name = newTreeName.trim();
    if (!name) return;
    setIsCreatingTree(true);
    setCreateError(null);
    try {
      const tree = await treeService.create({
        name,
        description: newTreeDesc.trim() || undefined,
        icon: newTreeIcon,
      });
      setTrees(prev => [...prev, tree]);
      setCreateOpen(false);
      setNewTreeName('');
      setNewTreeDesc('');
      setNewTreeIcon('\uD83C\uDF31');
      handleOpenTree(tree);
    } catch (err) {
      console.error(err);
      setCreateError('Could not create tree. Please try again.');
    } finally {
      setIsCreatingTree(false);
    }
  };

  const handleDeleteTree = async (treeId: string) => {
    setError(null);
    try {
      await treeService.delete(treeId);
      setTrees(prev => prev.filter(t => t.id !== treeId));
      setConfirmDeleteTreeId(null);
    } catch (err) {
      console.error(err);
      setError('Could not delete tree.');
    }
  };

  const handleSeedTemplate = async (slug: string) => {
    setIsSeeding(true);
    setError(null);
    try {
      const seededTree = await treeService.seedFromTemplate(slug);
      // Upsert the returned tree in local state without a round-trip re-fetch.
      setTrees(prev => {
        const exists = prev.some(t => t.id === seededTree.id);
        return exists
          ? prev.map(t => t.id === seededTree.id ? seededTree : t)
          : [...prev, seededTree];
      });
      handleOpenTree(seededTree);
    } catch (err) {
      console.error(err);
      setError(`Could not load the ${slug} template.`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveModal = async () => {
    if (!modal) return;
    setIsSavingModal(true);
    editor.setEditorError(null);
    try {
      if (modal.type === "subject" || modal.type === "concept") {
        const title = childTitle.trim();
        if (!title) return;
        if (!activeTree) return;
        await editor.addChild(modal.topic, title, activeTree.slug, activeTree.id);
        // addChild expands the parent; refresh after to load the new node.
        closeModal();
        await editor.refresh(true);
        return;
      }
      if (modal.type === "note") {
        const content = noteContent.trim();
        if (!content) return;
        await createTopicNote(
          modal.topic.id,
          content,
          noteTitle.trim() || "Explanation",
          codeBlocks.filter(b => b.code.trim()).length > 0 ? codeBlocks.filter(b => b.code.trim()) : undefined,
          showMathBlock && noteMath.trim() ? noteMath.trim() : undefined,
          subExpressions.length > 0 ? subExpressions : undefined,
          noteAttachments.length > 0 ? noteAttachments : undefined,
        );
        editor.setExpandedIds((prev) => ({ ...prev, [modal.topic.id]: true }));
      }
      if (modal.type === "edit-note") {
        const content = noteContent.trim();
        if (!content) return;
        await updateTopicNote(modal.note.id, {
          title: noteTitle.trim() || "Explanation",
          content,
          code_blocks: codeBlocks.filter(b => b.code.trim()).length > 0 ? codeBlocks.filter(b => b.code.trim()) : null,
          math_expression: showMathBlock && noteMath.trim() ? noteMath.trim() : null,
          sub_expressions: subExpressions.length > 0 ? subExpressions : null,
          attachments: noteAttachments.length > 0 ? noteAttachments : null,
        });
      }
      closeModal();
      await editor.refresh(true);
    } catch (err) {
      console.error(err);
      editor.setEditorError("Could not save your change.");
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!modal || (modal.type !== 'note' && modal.type !== 'edit-note')) return;
    setIsGenerating(true);
    setAiError(null);
    try {
      const topicPath = getTopicPath(modal.topic.id, editor.topics);
      const response = await fetch('/api/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicTitle: modal.topic.title, topicPath }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server error ${response.status}`);
      }
      const data = await response.json() as {
        title?: string;
        explanation?: string;
        code?: string;
        formula?: string;
        sub_expressions?: { expression: string; name: string; value: string }[];
      };
      if (data.title?.trim())       setNoteTitle(data.title.trim());
      if (data.explanation?.trim()) setNoteContent(data.explanation.trim());
      if (data.code?.trim())        setCodeBlocks([{ language: 'Python', code: data.code.trim() }]);
      if (data.formula?.trim())     { setNoteMath(data.formula.trim()); setShowMathBlock(true); }
      if (data.sub_expressions?.length) setSubExpressions(data.sub_expressions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setAiError(msg);
      console.error('[AI generate]', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCode = async (idx: number) => {
    const block = codeBlocks[idx];
    if (!block?.code.trim()) return;
    if (!PISTON_LANG_MAP.has(block.language)) return;
    setRunningIdx(idx);
    setBlockOutputs(prev => { const n = { ...prev }; delete n[idx]; return n; });

    // ── Python: run client-side via Pyodide (supports numpy/pandas/matplotlib) ──
    if (block.language === 'Python') {
      try {
        const py = await getPyodide();
        let stdout = '';
        let stderr = '';
        py.setStdout({ batched: (s: string) => { stdout += s + '\n'; } });
        py.setStderr({ batched: (s: string) => { stderr += s + '\n'; } });
        // Override plt.show() to capture plots as base64 PNGs
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
        await py.loadPackagesFromImports(block.code);
        let exitCode = 0;
        try {
          await py.runPythonAsync(block.code);
        } catch (pyErr: unknown) {
          stderr = String(pyErr);
          exitCode = 1;
        }
        const rawImages = py.runPython('_plot_images');
        const plotImages: string[] = rawImages && typeof rawImages.toJs === 'function'
          ? (rawImages.toJs() as string[])
          : [];
        setBlockOutputs(prev => ({
          ...prev,
          [idx]: { stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode, plotImages },
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Execution failed';
        setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: '', stderr: msg, exitCode: 1 } }));
        console.error('[run-code]', err);
      } finally {
        setRunningIdx(null);
      }
      return;
    }

    // ── All other languages: proxy through Judge0 ──
    try {
      const resp = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: block.language, code: block.code }),
      });
      const data = await resp.json() as any;
      if (!resp.ok) throw new Error(data?.error ?? `Execution failed (${resp.status})`);
      const typed = data as { run: { stdout: string; stderr: string; code: number } };
      setBlockOutputs(prev => ({
        ...prev,
        [idx]: {
          stdout: typed.run.stdout ?? '',
          stderr: typed.run.stderr ?? '',
          exitCode: typed.run.code ?? 0,
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed';
      setBlockOutputs(prev => ({ ...prev, [idx]: { stdout: '', stderr: msg, exitCode: 1 } }));
      console.error('[run-code]', err);
    } finally {
      setRunningIdx(null);
    }
  };

  const handleConvertCode = async (idx: number) => {
    const block = codeBlocks[idx];
    if (!block?.code.trim()) return;
    const targetLanguage = convertTargets[idx] ?? CONVERT_LANGS[0];
    if (targetLanguage.toLowerCase() === block.language.toLowerCase()) {
      setConvertErrors(prev => ({ ...prev, [idx]: 'Choose a different target language.' }));
      return;
    }
    setConvertingIdx(idx);
    setConvertErrors(prev => { const next = { ...prev }; delete next[idx]; return next; });
    try {
      const response = await fetch('/api/convert-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: block.code,
          sourceLanguage: block.language,
          targetLanguage,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Server error ${response.status}`);
      }
      const data = await response.json() as { convertedCode?: string; targetLanguage?: string; notes?: string };
      const converted = data.convertedCode?.trim();
      if (!converted) throw new Error('AI returned empty code.');
      setCodeBlocks(prev => prev.map((b, i) =>
        i === idx ? { language: data.targetLanguage ?? targetLanguage, code: converted } : b
      ));
      // Show notes as a brief inline message if present
      if (data.notes?.trim()) {
        setConvertErrors(prev => ({ ...prev, [idx]: `ℹ️ ${data.notes}` }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      setConvertErrors(prev => ({ ...prev, [idx]: msg }));
      console.error('[convert-code]', err);
    } finally {
      setConvertingIdx(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === 'topic') {
        await editor.deleteNode(confirmDelete.id);
      } else {
        await editor.deleteNote(confirmDelete.id);
      }
    } finally {
      setConfirmDelete(null);
    }
  };

  const leafTopics = editor.leafTopics;

  const isModalTopicLeaf = useMemo(() => {
    if (!modal || (modal.type !== 'note' && modal.type !== 'edit-note')) return false;
    return !editor.topics.some((t) => t.parent_id === modal.topic.id);
  }, [modal, editor.topics]);

  const doneCount = leafTopics.filter((t) => t.status === "done").length;

  // Two-panel notes viewer helpers
  const viewNotesList =
    modal?.type === "view-notes" ? (editor.notesByTopic[modal.topic.id] ?? []) : [];
  const activeNote =
    viewNotesList.find((n) => n.id === selectedNoteId) ??
    viewNotesList[0] ??
    null;

  const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const isExpanded = !!editor.expandedIds[node.id];
    const children = sortTreeNodes(node.children);
    const hasChildren = children.length > 0;
    const isDone = node.status === "done";
    const progress = hasChildren ? calcTreeProgress(node) : null;
    const topicNotes = editor.notesByTopic[node.id] ?? [];

    return (
      <div key={node.id} className="tr-group">
        {/* Row */}
        <div className={`tr-row${isDone ? " tr-row-done" : ""}`}>
          {/* Indent guides */}
          {Array.from({ length: depth }).map((_, i) => (
            <div key={i} className="tr-guide" />
          ))}

          {/* Expand chevron */}
          <button
            type="button"
            className={`tr-chevron${!hasChildren ? " tr-chevron-hidden" : ""}${isExpanded ? " tr-chevron-open" : ""}`}
            onClick={() => hasChildren && editor.toggleExpanded(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            tabIndex={hasChildren ? 0 : -1}
          >
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>

          {/* Done checkbox — only shown for leaf nodes */}
          {!hasChildren && (
            <button
              type="button"
              className={`tr-check${isDone ? " tr-check-done" : ""}`}
              onClick={() => editor.toggleDone(node)}
              aria-label={isDone ? "Mark as not done" : "Mark as done"}
            >
              {isDone && <Check size={10} strokeWidth={3} />}
            </button>
          )}

          {/* Title — click to jump to Knowledge Graph (only for nodes already on the graph) */}
          <button
            type="button"
            className={`tr-title${isDone ? " tr-title-done" : ""}${depth === 0 ? " tr-title-root" : depth === 1 ? " tr-title-l1" : ""}${editor.inGraphIds.has(node.id) ? " tr-title-in-graph" : ""}`}
            onClick={editor.inGraphIds.has(node.id) ? () => navigate(`/graph?focus=${node.id}`) : undefined}
            style={{ cursor: editor.inGraphIds.has(node.id) ? 'pointer' : 'default' }}
            title={editor.inGraphIds.has(node.id) ? "Open in Knowledge Graph" : undefined}
          >
            {node.title}
          </button>

          {/* Hover actions */}
          <div className="tr-actions">
            {hasChildren && (
              <>
                <button
                  type="button"
                  className="tr-action tr-action-labeled"
                  onClick={() => openSubjectModal(node)}
                  title="Add subject"
                >
                  <FolderPlus size={11} />
                  <span>Subject</span>
                </button>
                <button
                  type="button"
                  className="tr-action tr-action-labeled"
                  onClick={() => openConceptModal(node)}
                  title="Add concept"
                >
                  <Lightbulb size={11} />
                  <span>Concept</span>
                </button>
              </>
            )}
            <button
              type="button"
              className="tr-action tr-action-labeled"
              onClick={() => openNoteModal(node)}
              title="Add explanation"
            >
              <NotebookPen size={11} />
              <span>Explanation</span>
            </button>
            <button
              type="button"
              className="tr-action tr-action-labeled tr-action-danger"
              onClick={() => setConfirmDelete({ kind: 'topic', id: node.id, label: node.title })}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Progress pill */}
          {progress !== null && (
            <span className="tr-progress">
              <span
                className="tr-progress-fill"
                style={{ width: `${progress}%` }}
              />
              <span className="tr-progress-text">{progress}%</span>
            </span>
          )}

          {/* Note badge — click to view all explanations */}
          {topicNotes.length > 0 && (
            <button
              type="button"
              className="tr-note-badge tr-note-badge-btn"
              onClick={() => openViewNotesModal(node)}
              title={`${topicNotes.length} explanation${topicNotes.length !== 1 ? "s" : ""}`}
            >
              <BookOpen size={9} />
              {topicNotes.length}
            </button>
          )}
        </div>

        {/* Children (CSS-animated wrapper) */}
        {hasChildren && (
          <div
            className={`tr-children-wrapper${isExpanded ? " tr-children-open" : ""}`}
          >
            <div className="tr-children-inner">
              {children.map((child) => renderNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── List view ───────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="page-stack">
        {/* Header */}
        <div className="tr-page-bar">
          <div className="tr-page-bar-left">
            <h2>My Trees</h2>
            <p>Select a tree to open it, or create a new one</p>
          </div>
          <div className="tr-page-bar-right">
            <button
              type="button"
              className="primary-button"
              onClick={openCreateModal}
            >
              <Plus size={14} style={{ marginRight: '4px' }} />
              New Tree
            </button>
          </div>
        </div>

        {error && (
          <div className="tl-error-banner">
            <span>{error}</span>
            <button type="button" className="tl-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Tree cards */}
        {isLoadingTrees ? (
          <p className="tl-loading">Loading your trees…</p>
        ) : trees.length === 0 ? (
          <section className="glass-card">
            <div className="tl-empty">
              <div className="tl-empty-icon">🌳</div>
              <h3>No trees yet</h3>
              <p>Generate a tree with AI, or start from a template below.</p>
            </div>
          </section>
        ) : (
          <div className="tl-grid">
            {trees.map((tree) => (
              <button
                key={tree.id}
                type="button"
                className="tl-card"
                onClick={() => handleOpenTree(tree)}
              >
                <div className="tl-card-icon">{tree.icon ?? '🌳'}</div>
                <div className="tl-card-body">
                  <div className="tl-card-name">{tree.name}</div>
                  {tree.description && (
                    <div className="tl-card-desc">{tree.description}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="tl-card-delete"
                  title="Delete tree"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteTreeId(tree.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </button>
            ))}
            <button
              type="button"
              className="tl-card tl-card-new"
              onClick={openCreateModal}
            >
              <Plus size={18} />
              <span>New Tree</span>
            </button>
          </div>
        )}

        {/* Templates — always visible so user can add more */}
        <div>
          <p className="tl-section-label">Start from a template</p>
          <div className="tl-grid">
            {SEED_TREES.map((def) => (
              <button
                key={def.slug}
                type="button"
                className="tl-card tl-card-template"
                onClick={() => void handleSeedTemplate(def.slug)}
                disabled={isSeeding}
              >
                <div className="tl-card-icon">{def.icon}</div>
                <div className="tl-card-body">
                  <div className="tl-card-name">{def.name}</div>
                  <div className="tl-card-desc">{def.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Create tree modal */}
        {createOpen && (
          <div className="tr-backdrop" onClick={closeCreateModal}>
            <div
              className={`tr-modal ${
                gen.phase === 'generating' || gen.phase === 'done'
                  ? 'tr-modal--generate'
                  : 'tr-modal--dialog'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tr-modal-header">
                <div className="tr-modal-icon">
                  {createMode === 'ai' && (gen.phase === 'generating' || gen.phase === 'done')
                    ? <RefreshCw size={15} className="spin" />
                    : createMode === 'ai'
                      ? <Sparkles size={15} />
                      : <Plus size={15} />}
                </div>
                <div className="tr-modal-title-block">
                  <strong>
                    {createMode === 'ai' && gen.phase === 'done'
                      ? 'Saving tree…'
                      : createMode === 'ai' && gen.phase === 'generating'
                        ? 'Generating…'
                        : createMode === 'ai'
                          ? 'Generate Learning Tree'
                          : 'Create Blank Tree'}
                  </strong>
                  <p className="tr-modal-parent">
                    {createMode === 'ai' && (gen.phase === 'generating' || gen.phase === 'done')
                      ? `Building roadmap for "${genGoal}"…`
                      : createMode === 'ai'
                        ? 'AI will build a personalised learning roadmap'
                        : 'Give your learning tree a name'}
                  </p>
                </div>
                {gen.phase !== 'generating' && gen.phase !== 'done' && (
                  <button type="button" className="tr-modal-close" onClick={closeCreateModal}>
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* ── AI generation step ── */}
              {createMode === 'ai' && (gen.phase === 'idle' || gen.phase === 'error') && (
                <>
                  <div className="tr-modal-body">
                    <label>
                      What do you want to become?
                      <input
                        className="tl-goal-input"
                        value={genGoal}
                        onChange={(e) => setGenGoal(e.target.value)}
                        placeholder="e.g. AI Engineer, Data Scientist…"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void handleGenerateTree()}
                      />
                    </label>
                    <div className="tl-chips">
                      {CAREER_EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          className={`tl-chip${genGoal === ex ? ' tl-chip-active' : ''}`}
                          onClick={() => setGenGoal(ex)}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                    {gen.error && <div className="tl-error-banner"><span>{gen.error}</span></div>}
                  </div>
                  <div className="tr-modal-actions">
                    <button
                      type="button"
                      className="tl-mode-switch"
                      onClick={() => setCreateMode('blank')}
                    >
                      Create blank instead
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleGenerateTree()}
                      disabled={!genGoal.trim()}
                    >
                      <Sparkles size={14} style={{ marginRight: '4px' }} />
                      Generate Tree
                    </button>
                  </div>
                </>
              )}

              {/* ── Generating / Done progress ── */}
              {createMode === 'ai' && (gen.phase === 'generating' || gen.phase === 'done') && (
                <div className="tr-modal-body">
                  <GenerationProgress steps={gen.steps} role={genGoal} />
                  {gen.phase === 'done' && (
                    <p className="tl-gen-sub" style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                      Saving your tree to the database…
                    </p>
                  )}
                </div>
              )}

              {/* ── Blank create form ── */}
              {createMode === 'blank' && (
                <>
                  <div className="tr-modal-body">
                    <label>
                      Name
                      <input
                        value={newTreeName}
                        onChange={(e) => setNewTreeName(e.target.value)}
                        placeholder="e.g. Machine Learning"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && void handleCreateTree()}
                      />
                    </label>
                    <label>
                      Description <span style={{ opacity: 0.5 }}>(optional)</span>
                      <input
                        value={newTreeDesc}
                        onChange={(e) => setNewTreeDesc(e.target.value)}
                        placeholder="What will you learn?"
                      />
                    </label>
                    <div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--tk-text-muted)', display: 'block', marginBottom: '0.45rem' }}>Icon</span>
                      <div className="tl-icon-picker">
                        {TREE_ICON_OPTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            className={`tl-icon-opt${newTreeIcon === icon ? ' tl-icon-opt-active' : ''}`}
                            onClick={() => setNewTreeIcon(icon)}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    {createError && <p className="form-message">{createError}</p>}
                  </div>
                  <div className="tr-modal-actions">
                    <button type="button" className="tl-mode-switch" onClick={() => setCreateMode('ai')}>
                      ← Generate with AI instead
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleCreateTree()}
                      disabled={!newTreeName.trim() || isCreatingTree}
                    >
                      {isCreatingTree ? 'Creating…' : 'Create Tree'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Confirm delete tree */}
        {confirmDeleteTreeId && (
          <div className="tr-backdrop tr-confirm-backdrop" onClick={() => setConfirmDeleteTreeId(null)}>
            <div className="tr-confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="tr-confirm-icon"><Trash2 size={20} /></div>
              <p className="tr-confirm-text">
                Delete <strong>"{trees.find(t => t.id === confirmDeleteTreeId)?.name ?? 'this tree'}"</strong>?
                <br /><span style={{ fontSize: '0.82rem', opacity: 0.7 }}>All topics inside will be permanently removed.</span>
              </p>
              <div className="tr-confirm-actions">
                <button type="button" className="secondary-button" onClick={() => setConfirmDeleteTreeId(null)}>Cancel</button>
                <button type="button" className="danger-button" onClick={() => void handleDeleteTree(confirmDeleteTreeId)}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Open (editor) view ──────────────────────────────────────────────────────────────
  const hasSeedTemplate = activeTree ? !!getSeedTreeBySlug(activeTree.slug) : false;

  return (
    <div className="page-stack">
      {/* Page header bar */}
      <div className="tr-page-bar">
        <div className="tr-page-bar-left">
          <button type="button" className="tr-back-btn" onClick={handleBackToList}>
            <ChevronLeft size={14} />
            My Trees
          </button>
          <h2>{activeTree?.name ?? 'Tree'}</h2>
          <p>Check off topics as you master them</p>
        </div>
        <div className="tr-page-bar-right">
          {editor.topics.length === 0 && activeTree && hasSeedTemplate && (
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleSeed()}
              disabled={isSeeding}
            >
              {isSeeding ? 'Seeding…' : `Load ${activeTree.name} template`}
            </button>
          )}
        </div>
      </div>

      {/* Command bar (toolbar) */}
      <div className="tr-cmd-bar">
        <div className="tr-cmd-progress">
          <div className="tr-cmd-track">
            <div className="tr-cmd-fill" style={{ width: `${editor.overallProgress}%` }} />
          </div>
          <span className="tr-cmd-label">
            {doneCount}&thinsp;/&thinsp;{leafTopics.length}&nbsp;&nbsp;{editor.overallProgress}%
          </span>
        </div>

        <div className="tr-cmd-divider" />

        <div className="tr-cmd-actions">
          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => editor.setExpandedIds(makeExpandToDepth(editor.topics))}
            disabled={editor.topics.length === 0}
            title="Expand all"
          >
            <ChevronsUpDown size={13} />
            Expand
          </button>

          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => editor.setExpandedIds({})}
            disabled={editor.topics.length === 0}
            title="Collapse all"
          >
            <ChevronsDownUp size={13} />
            Collapse
          </button>

          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => void editor.refresh()}
            disabled={editor.isRefreshing}
            title="Refresh"
          >
            <RefreshCw size={13} className={editor.isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="tl-error-banner">
          <span>{error}</span>
          <button type="button" className="tl-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tree */}
      {editor.topics.length === 0 ? (
        <section className="glass-card empty-state-card">
          <h3>No topics yet</h3>
          <p>
            {hasSeedTemplate
              ? `Click “Load ${activeTree?.name} template” above to populate this tree.`
              : 'This tree is empty. Add subjects and concepts to get started.'}
          </p>
        </section>
      ) : (
        <section className="glass-card tr-shell">
          {sortTreeNodes(editor.treeNodes).map((node) => renderNode(node, 0))}
        </section>
      )}

      {/* Modal */}
      {modal && (
        <div className="tr-backdrop" onClick={closeModal}>
          <div className={`tr-modal${modal.type === "view-notes" ? " tr-modal--notes" : modal.type === "note" || modal.type === "edit-note" ? " tr-modal--form" : " tr-modal--dialog"}`} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="tr-modal-header">
              <div className="tr-modal-icon">
                {modal.type === "subject" && <FolderPlus size={15} />}
                {modal.type === "concept" && <Lightbulb size={15} />}
                {(modal.type === "note" || modal.type === "edit-note") && <NotebookPen size={15} />}
                {modal.type === "view-notes" && <BookOpen size={15} />}
              </div>
              <div className="tr-modal-title-block">
                <strong>
                  {modal.type === "subject" && "Add Subject"}
                  {modal.type === "concept" && "Add Concept"}
                  {modal.type === "note" && "Add Explanation"}
                  {modal.type === "edit-note" && "Edit Explanation"}
                  {modal.type === "view-notes" && "Explanations"}
                </strong>
                <p className="tr-modal-parent">
                  {modal.type === "view-notes"
                    ? `for "${modal.topic.title}"`
                    : modal.type === "edit-note"
                    ? `in "${modal.topic.title}"`
                    : `under "${modal.topic.title}"`}
                </p>
              </div>
              <button
                type="button"
                className="tr-modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className={`tr-modal-body${modal.type === "view-notes" ? " tr-modal-body--notes" : ""}`}>
              {(modal.type === "subject" || modal.type === "concept") && (
                <label>
                  {modal.type === "subject" ? "Subject title" : "Concept title"}
                  <input
                    value={childTitle}
                    onChange={(e) => setChildTitle(e.target.value)}
                    placeholder={
                      modal.type === "subject"
                        ? "e.g. Deep Learning"
                        : "e.g. Backpropagation"
                    }
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && void handleSaveModal()}
                  />
                </label>
              )}
              {(modal.type === "note" || modal.type === "edit-note") && (
                <div className="tr-modal-form">
                  {/* AI generation — leaf nodes only */}
                  {isModalTopicLeaf && (
                    <div className="ai-gen-row">
                      <div className="ai-gen-info">
                        <Sparkles size={13} className="ai-gen-icon" />
                        <span className="ai-gen-label">Auto-fill with AI</span>
                      </div>
                      <div className="ai-gen-right">
                        {aiError && <span className="ai-gen-error">{aiError}</span>}
                        <button
                          type="button"
                          className="ai-gen-btn"
                          onClick={() => void handleGenerateAI()}
                          disabled={isGenerating || isSavingModal}
                          title="Generate explanation, code, and formula using AI"
                        >
                          <Sparkles size={12} />
                          {isGenerating ? 'Generating…' : 'Generate with AI'}
                        </button>
                      </div>
                    </div>
                  )}

                  <label>
                    Title
                    <input
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g. Key insight"
                      autoFocus={modal.type === "note"}
                    />
                  </label>
                  <label>
                    Explanation
                    <textarea
                      rows={4}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Your explanation, examples, shortcuts…"
                      onPaste={async (e) => {
                        const items = Array.from(e.clipboardData.items);
                        const imageItem = items.find(it => it.type.startsWith('image/'));
                        if (!imageItem) return;
                        e.preventDefault();
                        const file = imageItem.getAsFile();
                        if (!file) return;
                        setUploadingFile(true);
                        try {
                          const att = await uploadNoteAttachment(file);
                          setNoteAttachments(prev => [...prev, att]);
                        } catch (err) {
                          console.error(err);
                          editor.setEditorError('Could not upload pasted image. Check Supabase Storage is configured.');
                        } finally {
                          setUploadingFile(false);
                        }
                      }}
                    />
                  </label>

                  {/* Multi-language code blocks */}
                  {codeBlocks.length > 0 && (
                    <div className="tr-code-blocks-list">
                      {codeBlocks.map((block, idx) => (
                        <div key={idx} className="tr-code-block-item">
                          <div className="tr-code-block-header">
                            <div className="tr-code-block-lang-wrap">
                              <Code2 size={12} />
                              <select
                                className="tr-lang-select"
                                value={block.language}
                                onChange={(e) => setCodeBlocks(prev => prev.map((b, i) => i === idx ? { ...b, language: e.target.value } : b))}
                              >
                                {['Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','SQL','HTML','CSS','Bash','JSON','Other'].map(lang => (
                                  <option key={lang} value={lang}>{lang}</option>
                                ))}
                              </select>
                            </div>

                            {/* Convert with AI */}
                            <div className="cb-convert-wrap">
                              <ArrowRightLeft size={11} className="cb-convert-icon" />
                              <select
                                className="tr-lang-select cb-convert-select"
                                value={convertTargets[idx] ?? CONVERT_LANGS[0]}
                                onChange={(e) => setConvertTargets(prev => ({ ...prev, [idx]: e.target.value }))}
                                disabled={convertingIdx === idx}
                                title="Target language"
                              >
                                {CONVERT_LANGS.map(lang => (
                                  <option key={lang} value={lang}>{lang}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="cb-convert-btn"
                                onClick={() => void handleConvertCode(idx)}
                                disabled={convertingIdx === idx || isSavingModal || !block.code.trim()}
                                title="Convert code to target language using AI"
                              >
                                {convertingIdx === idx ? 'Converting…' : 'Convert'}
                              </button>
                            </div>

                            <button
                              type="button"
                              className="tr-code-block-remove"
                              onClick={() => setCodeBlocks(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove this code block"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {convertErrors[idx] && (
                            <p className={`cb-convert-msg${convertErrors[idx].startsWith('ℹ️') ? ' cb-convert-msg--info' : ' cb-convert-msg--error'}`}>
                              {convertErrors[idx]}
                            </p>
                          )}
                          <textarea
                            className="tr-code-input"
                            rows={5}
                            value={block.code}
                            onChange={(e) => setCodeBlocks(prev => prev.map((b, i) => i === idx ? { ...b, code: e.target.value } : b))}
                            placeholder={`// ${block.language} code here…`}
                            spellCheck={false}
                          />
                          {/* Run output */}
                          {blockOutputs[idx] !== undefined && (
                            <div className="cb-output">
                              <div className="cb-output-header">
                                <span className={`cb-output-status ${blockOutputs[idx].exitCode === 0 ? 'cb-output-status--ok' : 'cb-output-status--err'}`}>
                                  {blockOutputs[idx].exitCode === 0 ? '✓ exit 0' : `✗ exit ${blockOutputs[idx].exitCode}`}
                                </span>
                                <button
                                  type="button"
                                  className="cb-output-clear"
                                  onClick={() => setBlockOutputs(prev => { const n = { ...prev }; delete n[idx]; return n; })}
                                  title="Clear output"
                                >
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
                          {/* Run button — only for executable languages */}
                          {PISTON_LANG_MAP.has(block.language) && (
                            <button
                              type="button"
                              className="cb-run-btn"
                              onClick={() => void handleRunCode(idx)}
                              disabled={runningIdx === idx || !block.code.trim()}
                              title={`Run ${block.language} code`}
                            >
                              <Play size={11} />
                              {runningIdx === idx ? 'Running…' : 'Run'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="tr-add-code-btn"
                    onClick={() => setCodeBlocks(prev => [...prev, { language: 'Python', code: '' }])}
                  >
                    <Plus size={13} />
                    Add code block
                  </button>

                  {/* Math expression block */}
                  {showMathBlock && (
                    <div style={{ marginTop: "12px" }}>
                      <label>
                        Math expression
                        <textarea
                          className="tr-code-input"
                          rows={3}
                          value={noteMath}
                          onChange={(e) => setNoteMath(e.target.value)}
                          placeholder="e.g. mean = μ or E = mc^2"
                          spellCheck={false}
                        />
                      </label>
                      <label style={{ marginTop: "10px" }}>
                        Math symbols (click to insert)
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", padding: "10px", backgroundColor: "rgba(99,102,241,0.05)", borderRadius: "6px" }}>
                          {["√","^","_","μ","σ","σ²","∑","∫","π","∞","≈","≠","×","÷","°"].map(s => (
                            <button key={s} type="button" onClick={() => insertMathSymbol(s)} style={{ padding: "6px 10px", fontSize: "0.9rem", backgroundColor: "var(--tk-surface-2)", border: "1px solid var(--tk-border)", borderRadius: "4px", cursor: "pointer", color: "var(--tk-text)" }}>{s}</button>
                          ))}
                        </div>
                      </label>

                      {subExpressions.length > 0 && (
                        <div style={{ marginTop: "12px", padding: "10px", backgroundColor: "rgba(99,102,241,0.08)", borderRadius: "6px" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "8px", color: "var(--tk-text)" }}>Sub-expressions:</div>
                          <ul style={{ margin: 0, paddingLeft: "20px", listStyle: "disc" }}>
                            {subExpressions.map((expr, idx) => (
                              <li key={idx} style={{ fontSize: "0.85rem", color: "var(--tk-text-muted)", marginBottom: "6px" }}>
                                <strong>{expr.expression}</strong> = {expr.name} ({expr.value})
                                <button type="button" onClick={() => setSubExpressions(prev => prev.filter((_, i) => i !== idx))} style={{ marginLeft: "8px", padding: "2px 6px", fontSize: "0.75rem", backgroundColor: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "3px", cursor: "pointer" }}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button type="button" className="tr-add-code-btn" onClick={() => setShowSubExprForm(v => !v)} style={{ marginTop: "12px" }}>
                        {showSubExprForm ? "− Hide sub-expression form" : "+ Add sub-expression"}
                      </button>

                      {showSubExprForm && (
                        <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "rgba(99,102,241,0.05)", borderRadius: "6px" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "10px", color: "var(--tk-text)" }}>Sub-expression details:</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                            <input type="text" placeholder="Expression (e.g. E(x))" value={subExprExpression} onChange={e => setSubExprExpression(e.target.value)} style={{ padding: "8px", fontSize: "0.85rem", border: "1px solid var(--tk-border)", borderRadius: "4px", backgroundColor: "var(--tk-surface-2)", color: "var(--tk-text)" }} />
                            <input type="text" placeholder="Name (e.g. mean)" value={subExprName} onChange={e => setSubExprName(e.target.value)} style={{ padding: "8px", fontSize: "0.85rem", border: "1px solid var(--tk-border)", borderRadius: "4px", backgroundColor: "var(--tk-surface-2)", color: "var(--tk-text)" }} />
                            <input type="text" placeholder="Value (e.g. 5)" value={subExprValue} onChange={e => setSubExprValue(e.target.value)} style={{ padding: "8px", fontSize: "0.85rem", border: "1px solid var(--tk-border)", borderRadius: "4px", backgroundColor: "var(--tk-surface-2)", color: "var(--tk-text)" }} />
                          </div>
                          <button type="button" className="tr-add-code-btn" onClick={addSubExpression} style={{ marginTop: "10px" }}>✓ Add to list</button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="tr-add-code-btn"
                    onClick={() => setShowMathBlock(v => !v)}
                  >
                    <FunctionSquare size={13} />
                    {showMathBlock ? "Remove math expression" : "Add math expression"}
                  </button>

                  {/* Attachments */}
                  <div className="tr-attachments-section">
                    {noteAttachments.length > 0 && (
                      <div className="tr-attachments-list">
                        {noteAttachments.map((att, idx) => (
                          <div key={idx} className="tr-attachment-chip">
                            {att.type === 'image'
                              ? <img src={att.url} alt={att.name} className="tr-attachment-thumb" />
                              : <span className="tr-attachment-pdf-icon">PDF</span>
                            }
                            <span className="tr-attachment-name">{att.name}</span>
                            <button
                              type="button"
                              className="tr-attachment-remove"
                              onClick={() => setNoteAttachments(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove attachment"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="tr-paste-hint">
                      {uploadingFile ? 'Uploading image…' : '📋 Paste an image to attach it'}
                    </span>
                  </div>
                </div>
              )}
              {modal.type === "view-notes" && (
                viewNotesList.length === 0 ? (
                  <p className="tr-view-notes-empty">No explanations yet.</p>
                ) : (
                  <div className="tr-vn-layout">
                    {/* Left sidebar — note titles */}
                    <div className="tr-vn-sidebar">
                      {viewNotesList.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className={`tr-vn-sidebar-item${activeNote?.id === note.id ? " tr-vn-sidebar-item-active" : ""}`}
                          onClick={() => setSelectedNoteId(note.id)}
                          title={note.title}
                        >
                          {note.title}
                        </button>
                      ))}
                    </div>

                    {/* Right content panel */}
                    <div className="tr-vn-content">
                      {activeNote ? (
                        <div className="tr-vn-note">
                          <div className="tr-vn-note-header">
                            <span className="tr-vn-note-title">{activeNote.title}</span>
                            <div className="tr-view-note-actions">
                              <button
                                type="button"
                                className="tr-view-note-btn"
                                onClick={() => openEditNoteModal(activeNote, modal.topic)}
                                title="Edit"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                className="tr-view-note-btn tr-view-note-btn-danger"
                                onClick={() => setConfirmDelete({ kind: 'note', id: activeNote.id, label: activeNote.title })}
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="tr-view-note-body">{activeNote.content}</div>
                          {activeNote.code_example && (
                            <pre className="tr-view-note-code"><code>{activeNote.code_example}</code></pre>
                          )}
                          {activeNote.code_blocks && activeNote.code_blocks.length > 0 && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {activeNote.code_blocks.map((block, idx) => (
                                <div key={idx}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                    <Code2 size={11} style={{ color: 'var(--tk-accent)' }} />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--tk-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{block.language}</span>
                                  </div>
                                  <pre className="tr-view-note-code"><code>{block.code}</code></pre>
                                </div>
                              ))}
                            </div>
                          )}
                          {activeNote.math_expression && (
                            <pre className="tr-view-note-code"><code>{activeNote.math_expression}</code></pre>
                          )}
                          {activeNote.sub_expressions && activeNote.sub_expressions.length > 0 && (
                            <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "rgba(99,102,241,0.08)", borderRadius: "6px" }}>
                              <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "6px", color: "var(--tk-text)" }}>Sub-expressions:</div>
                              <ul style={{ margin: 0, paddingLeft: "20px", listStyle: "disc" }}>
                                {activeNote.sub_expressions.map((expr, idx) => (
                                  <li key={idx} style={{ fontSize: "0.85rem", color: "var(--tk-text-muted)", marginBottom: "4px" }}>
                                    <strong>{expr.expression}</strong> = {expr.name} ({expr.value})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {activeNote.attachments && activeNote.attachments.length > 0 && (
                            <div className="tr-view-attachments">
                              {activeNote.attachments.map((att, idx) => (
                                att.type === 'image' ? (
                                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="tr-view-attachment-img-wrap">
                                    <img src={att.url} alt={att.name} className="tr-view-attachment-img" />
                                    <span className="tr-view-attachment-label">{att.name}</span>
                                  </a>
                                ) : (
                                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="tr-view-attachment-pdf">
                                    <span className="tr-attachment-pdf-icon">PDF</span>
                                    <span className="tr-view-attachment-label">{att.name}</span>
                                  </a>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="tr-modal-actions">
              {modal.type === "view-notes" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={closeModal}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleSaveModal()}
                    disabled={isSavingModal}
                  >
                    {isSavingModal ? "Saving…" : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="tr-backdrop tr-confirm-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="tr-modal tr-modal--compact" onClick={(e) => e.stopPropagation()}>
            <div className="tr-modal-header">
              <div className="tr-modal-icon tr-modal-icon--danger">
                <Trash2 size={15} />
              </div>
              <div className="tr-modal-title-block">
                <strong>Confirm Delete</strong>
                <p className="tr-modal-parent">This action cannot be undone</p>
              </div>
              <button type="button" className="tr-modal-close" onClick={() => setConfirmDelete(null)} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="tr-modal-body">
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--tk-text)', lineHeight: 1.6 }}>
                Delete <strong>"{confirmDelete.label}"</strong>?
                {confirmDelete.kind === 'topic' && (
                  <> This will also delete all child topics.</>
                )}
                {' '}This cannot be undone.
              </p>
            </div>
            <div className="tr-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void handleConfirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
