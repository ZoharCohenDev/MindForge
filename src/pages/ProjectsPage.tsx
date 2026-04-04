import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Github,
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  BookOpen,
  PlayCircle,
  User,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Flag,
} from 'lucide-react';
import {
  createProject,
  listProjects,
  updateProject,
  deleteProject,
  listMissions,
  createMission,
  updateMission,
  deleteMission,
} from '../lib/dataApi';
import type { Mission, Project, ProjectCategory, ProjectPriority } from '../types';

type ModalState = { type: 'add' } | { type: 'edit'; project: Project } | null;

const CATEGORY_CONFIG: Record<
  ProjectCategory,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  work:     { label: 'Work',     icon: <Briefcase size={11} />,  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  study:    { label: 'Study',    icon: <BookOpen size={11} />,   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  udemy:    { label: 'Udemy',    icon: <PlayCircle size={11} />, color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  personal: { label: 'Personal', icon: <User size={11} />,       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

const PRIORITY_CONFIG: Record<
  ProjectPriority,
  { label: string; color: string; bg: string }
> = {
  high:   { label: 'High',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  low:    { label: 'Low',    color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

function getPhase(status: string): 'current' | 'future' | 'previous' {
  if (status === 'done') return 'previous';
  if (status === 'in_progress' || status === 'learning') return 'current';
  return 'future';
}

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'personal' as ProjectCategory,
  status: 'not_started' as Project['status'],
  priority: 'medium' as ProjectPriority,
  github_url: '',
  colab_url: '',
  demo_url: '',
  tech_stack: '',
  deadline: '',
  lessons_learned: '',
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const refresh = async () => {
    const data = await listProjects();
    setProjects(data);
  };

  useEffect(() => { void refresh().catch(console.error); }, []);

  const set =
    (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setModal({ type: 'add' });
    setError(null);
  };

  const openEdit = (p: Project) => {
    setForm({
      name: p.name,
      description: p.description,
      category: p.category ?? 'personal',
      status: p.status,
      priority: p.priority ?? 'medium',
      github_url: p.github_url ?? '',
      colab_url: p.colab_url ?? '',
      demo_url: p.demo_url ?? '',
      tech_stack: p.tech_stack.join(', '),
      deadline: p.deadline ?? '',
      lessons_learned: p.lessons_learned ?? '',
    });
    setModal({ type: 'edit', project: p });
    setError(null);
  };

  const closeModal = () => { setModal(null); setError(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      const payload: Omit<Project, 'id' | 'user_id' | 'created_at'> = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        status: form.status,
        priority: form.priority,
        github_url: form.github_url.trim() || null,
        colab_url: form.colab_url.trim() || null,
        demo_url: form.demo_url.trim() || null,
        tech_stack: form.tech_stack.split(',').map(s => s.trim()).filter(Boolean),
        deadline: form.deadline.trim() || null,
        lessons_learned: form.lessons_learned.trim() || null,
      };
      if (modal?.type === 'add') await createProject(payload);
      else if (modal?.type === 'edit') await updateProject(modal.project.id, payload);
      closeModal();
      await refresh();
    } catch (err) {
      console.error(err);
      setError('Could not save project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    try { await deleteProject(id); await refresh(); }
    catch (err) { console.error(err); }
  };

  const current  = projects.filter(p => getPhase(p.status) === 'current');
  const future   = projects.filter(p => getPhase(p.status) === 'future');
  const previous = projects.filter(p => getPhase(p.status) === 'previous');

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="tr-page-bar">
        <div className="tr-page-bar-left">
          <h2>Projects</h2>
          <p>Track your work, Udemy courses, studies and personal builds</p>
        </div>
        <div className="tr-page-bar-right">
          <button
            className="primary-button"
            onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      <ProjectSection
        title="🚀 Current"
        subtitle="Active — in progress right now"
        accentColor="#6366f1"
        projects={current}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <ProjectSection
        title="🔭 Planned"
        subtitle="Future — what you want to build or study next"
        accentColor="#f97316"
        projects={future}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <ProjectSection
        title="✅ Previous"
        subtitle="Done — completed and archived"
        accentColor="#34d399"
        projects={previous}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {/* Add / Edit Modal */}
      {modal && (
        <div className="tr-backdrop" onClick={closeModal}>
          <div
            className="tr-modal"
            style={{ width: 'min(600px, 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="tr-modal-header">
              <div className="tr-modal-title-block">
                <strong>{modal.type === 'add' ? 'New Project' : 'Edit Project'}</strong>
              </div>
              <button className="tr-modal-close" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className="tr-modal-body tr-modal-form">
              <label>
                Project name *
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. LearnOS, ML Classifier"
                  autoFocus
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="What is this? What will you build or learn?"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Category
                  <select value={form.category} onChange={set('category')}>
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                    <option value="study">Study</option>
                    <option value="udemy">Udemy Course</option>
                  </select>
                </label>
                <label>
                  Phase
                  <select value={form.status} onChange={set('status')}>
                    <option value="not_started">Planned — not started</option>
                    <option value="learning">Planned — researching</option>
                    <option value="in_progress">Current — in progress</option>
                    <option value="done">Previous — done</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  Priority
                  <select value={form.priority} onChange={set('priority')}>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </label>
                <label>
                  Deadline
                  <input type="date" value={form.deadline} onChange={set('deadline')} />
                </label>
              </div>

              <label>
                Tech stack
                <input
                  type="text"
                  value={form.tech_stack}
                  onChange={set('tech_stack')}
                  placeholder="React, Python, TensorFlow (comma separated)"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  GitHub URL
                  <input
                    type="url"
                    value={form.github_url}
                    onChange={set('github_url')}
                    placeholder="https://github.com/..."
                  />
                </label>
                <label>
                  Demo / Live URL
                  <input
                    type="url"
                    value={form.demo_url}
                    onChange={set('demo_url')}
                    placeholder="https://..."
                  />
                </label>
              </div>

              <label>
                Google Colab URL
                <input
                  type="url"
                  value={form.colab_url}
                  onChange={set('colab_url')}
                  placeholder="https://colab.research.google.com/..."
                />
              </label>

              <label>
                Lessons learned / Notes
                <textarea
                  rows={3}
                  value={form.lessons_learned}
                  onChange={set('lessons_learned')}
                  placeholder="What did you learn? What would you do differently?"
                />
              </label>

              {error && (
                <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>
              )}
            </div>

            <div className="tr-modal-actions">
              <button className="secondary-button" onClick={closeModal}>Cancel</button>
              <button className="primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────────────────────── */

function ProjectSection({
  title,
  subtitle,
  accentColor,
  projects,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  accentColor: string;
  projects: Project[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section style={{ marginBottom: '4px' }}>
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 0',
          marginBottom: collapsed ? '0' : '12px',
          borderBottom: collapsed ? 'none' : `2px solid ${accentColor}22`,
        }}
      >
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--tk-text)' }}>
          {title}
        </span>
        <span
          style={{
            fontSize: '0.78rem',
            padding: '1px 8px',
            borderRadius: '99px',
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            fontWeight: 600,
          }}
        >
          {projects.length}
        </span>
        <span
          style={{
            fontSize: '0.82rem',
            color: 'var(--tk-text-muted)',
            marginLeft: '2px',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {subtitle}
        </span>
        {collapsed
          ? <ChevronDown size={15} style={{ color: 'var(--tk-text-muted)' }} />
          : <ChevronUp   size={15} style={{ color: 'var(--tk-text-muted)' }} />}
      </button>

      {!collapsed && (
        projects.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--tk-text-muted)', padding: '4px 0 16px' }}>
            No projects here yet — click <strong>New Project</strong> to add one.
          </p>
        ) : (
          <div className="card-grid" style={{ marginBottom: '8px' }}>
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )
      )}
    </section>
  );
}

/* ─── Card ────────────────────────────────────────────────────────────────── */

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
}) {
  const cat = CATEGORY_CONFIG[project.category ?? 'personal'];
  const pri = PRIORITY_CONFIG[project.priority ?? 'medium'];

  return (
    <article className="glass-card entity-card" style={{ position: 'relative' }}>
      {/* Edit / Delete */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
        <button
          type="button"
          onClick={() => onEdit(project)}
          style={{
            padding: '4px 6px',
            borderRadius: '5px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-surface-2)',
            cursor: 'pointer',
            color: 'var(--tk-text-muted)',
          }}
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(project.id)}
          style={{
            padding: '4px 6px',
            borderRadius: '5px',
            border: '1px solid var(--tk-border)',
            background: 'var(--tk-surface-2)',
            cursor: 'pointer',
            color: '#f87171',
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Name */}
      <div style={{ paddingRight: '64px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '0.97rem', fontWeight: 600 }}>
          {project.name}
        </h3>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: cat.bg,
              color: cat.color,
            }}
          >
            {cat.icon} {cat.label}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '0.73rem',
              fontWeight: 600,
              backgroundColor: pri.bg,
              color: pri.color,
            }}
          >
            {pri.label} priority
          </span>
          {project.deadline && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 8px',
                borderRadius: '99px',
                fontSize: '0.73rem',
                backgroundColor: 'rgba(99,102,241,0.1)',
                color: '#818cf8',
              }}
            >
              <Calendar size={10} /> {project.deadline}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p style={{ fontSize: '0.87rem', margin: 0, lineHeight: 1.55 }}>
          {project.description}
        </p>
      )}

      {/* Tech stack */}
      {project.tech_stack.length > 0 && (
        <div className="tag-row">
          {project.tech_stack.map(tag => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
      )}

      {/* Lessons learned */}
      {project.lessons_learned && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(52,211,153,0.07)',
            border: '1px solid rgba(52,211,153,0.18)',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: 'var(--tk-text-muted)',
          }}
        >
          <strong style={{ fontSize: '0.77rem', display: 'block', marginBottom: '3px', color: '#34d399' }}>
            💡 Lessons learned
          </strong>
          {project.lessons_learned}
        </div>
      )}

      {/* Links */}
      {(project.github_url || project.colab_url || project.demo_url) && (
        <div className="link-row">
          {project.github_url && (
            <a
              href={project.github_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.83rem' }}
            >
              <Github size={13} /> GitHub
            </a>
          )}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.83rem' }}
            >
              <ExternalLink size={13} /> Demo
            </a>
          )}
          {project.colab_url && (
            <a
              href={project.colab_url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.83rem' }}
            >
              <ExternalLink size={13} /> Colab
            </a>
          )}
        </div>
      )}

      {/* Missions */}
      <MissionsPanel projectId={project.id} />
    </article>
  );
}

/* ─── Missions Panel ──────────────────────────────────────────────────────── */

function MissionsPanel({ projectId }: { projectId: string }) {
  const [open, setOpen]         = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding]     = useState(false);

  // Lazy-load missions the first time the panel is opened
  useEffect(() => {
    if (!open || loaded) return;
    listMissions(projectId)
      .then(data => { setMissions(data); setLoaded(true); })
      .catch(console.error);
  }, [open, loaded, projectId]);

  const handleToggle = async (m: Mission) => {
    const next: Mission['status'] = m.status === 'done' ? 'todo' : 'done';
    setMissions(prev => prev.map(x => x.id === m.id ? { ...x, status: next } : x));
    try { await updateMission(m.id, next); }
    catch (e) {
      console.error(e);
      setMissions(prev => prev.map(x => x.id === m.id ? { ...x, status: m.status } : x));
    }
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    try {
      const m = await createMission(projectId, title);
      setMissions(prev => [...prev, m]);
      setNewTitle('');
    } catch (e) { console.error(e); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    setMissions(prev => prev.filter(x => x.id !== id));
    try { await deleteMission(id); }
    catch (e) { console.error(e); void listMissions(projectId).then(setMissions); }
  };

  const done  = missions.filter(m => m.status === 'done').length;
  const total = missions.length;

  return (
    <div className="ms-panel">
      {/* Toggle header */}
      <button
        type="button"
        className="ms-toggle"
        onClick={() => setOpen(v => !v)}
      >
        <Flag size={12} className="ms-toggle-icon" />
        <span className="ms-toggle-label">Missions</span>
        {total > 0 && (
          <span className="ms-badge">{done}/{total}</span>
        )}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Progress bar */}
      {open && total > 0 && (
        <div className="ms-progress-track">
          <div
            className="ms-progress-fill"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      )}

      {/* Missions list */}
      {open && (
        <div className="ms-body">
          {!loaded && <p className="ms-loading">Loading…</p>}

          {loaded && missions.length === 0 && (
            <p className="ms-empty">No missions yet — add your first one below.</p>
          )}

          {loaded && missions.map(m => (
            <div key={m.id} className={`ms-row ${m.status === 'done' ? 'ms-row--done' : ''}`}>
              <button
                type="button"
                className="ms-check"
                onClick={() => handleToggle(m)}
                title={m.status === 'done' ? 'Mark todo' : 'Mark done'}
              >
                {m.status === 'done'
                  ? <CheckCircle2 size={15} />
                  : <Circle size={15} />}
              </button>
              <span className="ms-title">{m.title}</span>
              <button
                type="button"
                className="ms-delete"
                onClick={() => handleDelete(m.id)}
                title="Delete mission"
              >
                <X size={11} />
              </button>
            </div>
          ))}

          {/* Add new mission */}
          <div className="ms-add-row">
            <input
              className="ms-input"
              type="text"
              placeholder="Add a mission…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
            />
            <button
              type="button"
              className="ms-add-btn"
              onClick={() => void handleAdd()}
              disabled={adding || !newTitle.trim()}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
