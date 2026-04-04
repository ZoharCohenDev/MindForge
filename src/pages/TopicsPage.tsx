import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  FolderPlus,
  FunctionSquare,
  Lightbulb,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  createTopic,
  createTopicNote,
  deleteTopic,
  deleteTopicNote,
  listTopicNotes,
  listTopics,
  seedDefaultAiTree,
  seedDefaultFullStackTree,
  toggleTopicDone,
  updateTopicNote,
} from "../lib/dataApi";
import type { CodeBlock, Note, SubExpression, Topic, TreeType } from "../types";

type TopicNode = Topic & { children: TopicNode[] };

type ModalState =
  | { type: "subject"; topic: Topic }
  | { type: "concept"; topic: Topic }
  | { type: "note"; topic: Topic }
  | { type: "edit-note"; note: Note; topic: Topic }
  | { type: "view-notes"; topic: Topic }
  | null;

function buildTree(items: Topic[]) {
  const map = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];

  items.forEach((topic) => map.set(topic.id, { ...topic, children: [] }));

  items.forEach((topic) => {
    const current = map.get(topic.id)!;
    if (topic.parent_id) {
      const parent = map.get(topic.parent_id);
      if (parent) {
        parent.children.push(current);
        return;
      }
    }
    roots.push(current);
  });

  return roots;
}

function groupNotesByTopic(notes: Note[]) {
  return notes.reduce<Record<string, Note[]>>((acc, note) => {
    if (!note.topic_id) return acc;
    acc[note.topic_id] ??= [];
    acc[note.topic_id].push(note);
    return acc;
  }, {});
}

function sortNodes(nodes: TopicNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title);
  });
}

function calcProgress(node: TopicNode): number {
  const all: TopicNode[] = [];
  const walk = (n: TopicNode) => {
    all.push(n);
    n.children.forEach(walk);
  };
  node.children.forEach(walk);
  if (all.length === 0) return 0;
  return Math.round(
    (all.filter((n) => n.status === "done").length / all.length) * 100,
  );
}


function makeExpandToDepth(topics: Topic[], maxDepth: number = 1) {
  // Expand only nodes up to maxDepth (0, 1, 2 = 3 levels shown)
  return Object.fromEntries(
    topics.filter((t) => t.depth <= maxDepth).map((t) => [t.id, true])
  );
}

export function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeTree, setActiveTree] = useState<TreeType>('ai');
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'topic'; id: string; label: string }
    | { kind: 'note'; id: string; label: string }
    | null
  >(null);

  const refresh = async (tree?: TreeType, preserveExpanded = false) => {
    const treeType = tree ?? activeTree;
    setIsRefreshing(true);
    setError(null);
    try {
      const [topicRows, noteRows] = await Promise.all([
        listTopics(treeType),
        listTopicNotes(),
      ]);
      setTopics(topicRows);
      setNotes(noteRows);
      if (!preserveExpanded) {
        setExpandedIds(makeExpandToDepth(topicRows));
      }
    } catch (err) {
      console.error(err);
      setError("Could not load the tree.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTree]);

  const tree = useMemo(() => buildTree(topics), [topics]);
  const notesByTopic = useMemo(() => groupNotesByTopic(notes), [notes]);

  /** IDs of every topic that appears in the Knowledge Graph (done + all their ancestors). */
  const inGraphIds = useMemo<Set<string>>(() => {
    const topicMap = new Map(topics.map(t => [t.id, t]));
    const doneSet  = new Set(topics.filter(t => t.status === 'done').map(t => t.id));
    const included = new Set<string>();
    doneSet.forEach(id => {
      let cur: Topic | undefined = topicMap.get(id);
      while (cur) {
        included.add(cur.id);
        cur = cur.parent_id ? topicMap.get(cur.parent_id) : undefined;
      }
    });
    return included;
  }, [topics]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));

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
    setIsSeeding(true);
    setError(null);
    try {
      if (activeTree === 'ai') {
        await seedDefaultAiTree();
      } else {
        await seedDefaultFullStackTree();
      }
      await refresh();
    } catch (err) {
      console.error(err);
      setError(`Could not seed the ${activeTree === 'ai' ? 'AI' : 'Full Stack'} tree.`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSaveModal = async () => {
    if (!modal) return;
    setIsSavingModal(true);
    setError(null);
    try {
      if (modal.type === "subject" || modal.type === "concept") {
        const title = childTitle.trim();
        if (!title) return;
        const siblingCount = topics.filter(
          (t) => t.parent_id === modal.topic.id,
        ).length;
        await createTopic({
          title,
          summary: "",
          parent_id: modal.topic.id,
          depth: modal.topic.depth + 1,
          sort_order: siblingCount,
          status: "not_started",
          tree_type: activeTree,
        });
        setExpandedIds((prev) => ({ ...prev, [modal.topic.id]: true }));
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
        );
        setExpandedIds((prev) => ({ ...prev, [modal.topic.id]: true }));
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
        });
      }
      closeModal();
      await refresh(undefined, true);
    } catch (err) {
      console.error(err);
      setError("Could not save your change.");
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteTopicNote(noteId);
      await refresh(undefined, true);
    } catch (err) {
      console.error(err);
      setError("Could not delete the explanation.");
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await deleteTopic(topicId);
      await refresh();
    } catch (err) {
      console.error(err);
      setError("Could not delete the topic.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.kind === 'topic') {
        await handleDeleteTopic(confirmDelete.id);
      } else {
        await handleDeleteNote(confirmDelete.id);
      }
    } finally {
      setConfirmDelete(null);
    }
  };

  // Optimistic toggle — flips local state immediately, syncs to DB in background.
  const handleToggleDone = (node: TopicNode) => {
    const next = node.status === "done" ? "not_started" : "done";
    setTopics((prev) =>
      prev.map((t) => (t.id === node.id ? { ...t, status: next } : t)),
    );
    void toggleTopicDone(node).catch((err) => {
      console.error(err);
      // Revert on failure
      setTopics((prev) =>
        prev.map((t) => (t.id === node.id ? { ...t, status: node.status } : t)),
      );
    });
  };

  const leafTopics = useMemo(() => {
    const parentIds = new Set(topics.map(t => t.parent_id).filter(Boolean));
    return topics.filter(t => !parentIds.has(t.id));
  }, [topics]);

  const doneCount = leafTopics.filter((t) => t.status === "done").length;
  const overallProgress =
    leafTopics.length > 0
      ? Math.round((doneCount / leafTopics.length) * 100)
      : 0;

  // Two-panel notes viewer helpers
  const viewNotesList =
    modal?.type === "view-notes" ? (notesByTopic[modal.topic.id] ?? []) : [];
  const activeNote =
    viewNotesList.find((n) => n.id === selectedNoteId) ??
    viewNotesList[0] ??
    null;

  const renderNode = (node: TopicNode, depth = 0): React.ReactNode => {
    const isExpanded = !!expandedIds[node.id];
    const children = sortNodes(node.children);
    const hasChildren = children.length > 0;
    const isDone = node.status === "done";
    const progress = hasChildren ? calcProgress(node) : null;
    const topicNotes = notesByTopic[node.id] ?? [];

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
            onClick={() => hasChildren && toggleExpanded(node.id)}
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
              onClick={() => handleToggleDone(node)}
              aria-label={isDone ? "Mark as not done" : "Mark as done"}
            >
              {isDone && <Check size={10} strokeWidth={3} />}
            </button>
          )}

          {/* Title — click to jump to Knowledge Graph (only for nodes already on the graph) */}
          <button
            type="button"
            className={`tr-title${isDone ? " tr-title-done" : ""}${depth === 0 ? " tr-title-root" : depth === 1 ? " tr-title-l1" : ""}${inGraphIds.has(node.id) ? " tr-title-in-graph" : ""}`}
            onClick={inGraphIds.has(node.id) ? () => navigate(`/graph?focus=${node.id}`) : undefined}
            style={{ cursor: inGraphIds.has(node.id) ? 'pointer' : 'default' }}
            title={inGraphIds.has(node.id) ? "Open in Knowledge Graph" : undefined}
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

  return (
    <div className="page-stack">
      {/* Page header bar */}
      <div className="tr-page-bar">
        <div className="tr-page-bar-left">
          <h2>{activeTree === 'ai' ? 'AI Roadmap' : 'Full Stack Roadmap'}</h2>
          <p>Check off topics as you master them</p>
        </div>
        <div className="tr-page-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Tree switcher */}
          <div className="tr-tree-switcher">
            <button
              type="button"
              className={`tr-tree-tab${activeTree === 'ai' ? ' tr-tree-tab-active' : ''}`}
              onClick={() => { setActiveTree('ai'); setTopics([]); setNotes([]); }}
            >
              <span className="tr-tree-tab-icon">🤖</span>
              AI Tree
            </button>
            <button
              type="button"
              className={`tr-tree-tab${activeTree === 'fullstack' ? ' tr-tree-tab-active' : ''}`}
              onClick={() => { setActiveTree('fullstack'); setTopics([]); setNotes([]); }}
            >
              <span className="tr-tree-tab-icon">🌐</span>
              Full Stack
            </button>
          </div>
          {topics.length === 0 && (
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleSeed()}
              disabled={isSeeding}
            >
              {isSeeding ? 'Seeding…' : `Seed ${activeTree === 'ai' ? 'AI' : 'Full Stack'} tree`}
            </button>
          )}
        </div>
      </div>

      {/* Command bar (toolbar) */}
      <div className="tr-cmd-bar">
        <div className="tr-cmd-progress">
          <div className="tr-cmd-track">
            <div className="tr-cmd-fill" style={{ width: `${overallProgress}%` }} />
          </div>
          <span className="tr-cmd-label">
            {doneCount}&thinsp;/&thinsp;{leafTopics.length}&nbsp;&nbsp;{overallProgress}%
          </span>
        </div>

        <div className="tr-cmd-divider" />

        <div className="tr-cmd-actions">
          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => setExpandedIds(makeExpandToDepth(topics))}
            disabled={topics.length === 0}
            title="Expand all"
          >
            <ChevronsUpDown size={13} />
            Expand
          </button>

          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => setExpandedIds({})}
            disabled={topics.length === 0}
            title="Collapse all"
          >
            <ChevronsDownUp size={13} />
            Collapse
          </button>

          <button
            type="button"
            className="tr-cmd-btn"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            title="Refresh"
          >
            <RefreshCw size={13} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      {error && <p className="form-message">{error}</p>}

      {/* Tree */}
      {topics.length === 0 ? (
        <section className="glass-card empty-state-card">
          <h3>No topics yet</h3>
          <p>
            {activeTree === 'ai'
              ? 'Click "Seed AI tree" above to load your full AI learning roadmap — 214 topics across 6 depths.'
              : 'Click "Seed Full Stack tree" above to load your Full Stack learning roadmap.'}
          </p>
        </section>
      ) : (
        <section className="glass-card tr-shell">
          {sortNodes(tree).map((node) => renderNode(node, 0))}
        </section>
      )}

      {/* Modal */}
      {modal && (
        <div className="tr-backdrop" onClick={closeModal}>
          <div className={`tr-modal${modal.type === "view-notes" ? " tr-modal--notes" : ""}`} onClick={(e) => e.stopPropagation()}>
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
                            <button
                              type="button"
                              className="tr-code-block-remove"
                              onClick={() => setCodeBlocks(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove this code block"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          <textarea
                            className="tr-code-input"
                            rows={5}
                            value={block.code}
                            onChange={(e) => setCodeBlocks(prev => prev.map((b, i) => i === idx ? { ...b, code: e.target.value } : b))}
                            placeholder={`// ${block.language} code here…`}
                            spellCheck={false}
                          />
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
          <div className="tr-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="tr-confirm-icon">
              <Trash2 size={20} />
            </div>
            <p className="tr-confirm-text">
              Delete <strong>"{confirmDelete.label}"</strong>?
              {confirmDelete.kind === 'topic' && (
                <> This will also delete all child topics.</>
              )}
              {' '}This cannot be undone.
            </p>
            <div className="tr-confirm-actions">
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
