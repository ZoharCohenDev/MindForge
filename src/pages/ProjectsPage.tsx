import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink, Github, Plus, Pencil, Trash2, Briefcase, BookOpen,
  PlayCircle, User, Calendar, X, CheckCircle2, Circle, Flag, ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  createProject, listProjects, updateProject, deleteProject,
  listMissions, createMission, updateMission, deleteMission,
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
  { label: string; color: string; dot: string }
> = {
  high:   { label: 'High',   color: '#f87171', dot: '#f87171' },
  medium: { label: 'Medium', color: '#fbbf24', dot: '#fbbf24' },
  low:    { label: 'Low',    color: '#9ca3af', dot: '#9ca3af' },
};

const PHASE_CONFIG = {
  current:  { label: '🚀 Current',  color: '#0099CC' },
  future:   { label: '🔭 Planned',  color: '#f97316' },
  previous: { label: '✅ Previous', color: '#34d399' },
} as const;

type Phase = keyof typeof PHASE_CONFIG;

function getPhase(status: string): Phase {
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

/* ─── Main page ────────────────────────────────────────────────────────────────────────── */

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [filter,   setFilter]   = useState<Phase | 'all'>('all');
  const [modal,    setModal]    = useState<ModalState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [form,     setForm]     = useState(EMPTY_FORM);

  const refresh = async () => {
    const data = await listProjects();
    setProjects(data);
    if (selected) {
      const updated = data.find(p => p.id === selected.id);
      setSelected(updated ?? null);
    }
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
    try {
      await deleteProject(id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (err) { console.error(err); }
  };

  const grouped: Record<Phase, Project[]> = {
    current:  projects.filter(p => getPhase(p.status) === 'current'),
    future:   projects.filter(p => getPhase(p.status) === 'future'),
    previous: projects.filter(p => getPhase(p.status) === 'previous'),
  };

  const visible = filter === 'all' ? projects : grouped[filter];

  return (
    <div className="pj-page">

      {/* Page header */}
      <div className="pj-page-header">
        <div className="pj-page-title">
          <Briefcase size={20} style={{ color: '#0099CC' }} />
          <h1 className="pj-page-h1">Projects</h1>
          <span className="pj-total-pill">{projects.length}</span>
        </div>
        <button className="primary-button" onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Filter tabs */}
      <div className="pj-filters">
        {(['all', 'current', 'future', 'previous'] as Array<Phase | 'all'>).map(f => (
          <button
            key={f}
            className={`pj-filter-tab${filter === f ? ' pj-filter-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : PHASE_CONFIG[f].label}
            <span className="pj-filter-count">
              {f === 'all' ? projects.length : grouped[f].length}
            </span>
          </button>
        ))}
      </div>

      {/* Card grid */}
      {visible.length === 0 ? (
        <div className="pj-grid-empty">
          <Briefcase size={40} />
          <p>No projects here yet</p>
          <button className="primary-button" onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add one
          </button>
        </div>
      ) : (
        <div className="pj-grid">
          {visible.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={selected?.id === p.id}
              onClick={() => setSelected(prev => prev?.id === p.id ? null : p)}
            />
          ))}
        </div>
      )}

      {/* Right drawer via portal */}
      {selected && createPortal(
        <>
          <div className="pj-drawer-backdrop" onClick={() => setSelected(null)} />
          <div className="pj-drawer">
            <ProjectDetail
              key={selected.id}
              project={selected}
              onEdit={openEdit}
              onDelete={handleDelete}
              onClose={() => setSelected(null)}
            />
          </div>
        </>,
        document.body
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="tr-backdrop" onClick={closeModal}>
          <div className="tr-modal tr-modal--project" onClick={e => e.stopPropagation()}>
            <div className="tr-modal-header">
              <div className="tr-modal-icon"><Briefcase size={15} /></div>
              <div className="tr-modal-title-block">
                <strong>{modal.type === 'add' ? 'New Project' : 'Edit Project'}</strong>
                <p className="tr-modal-parent">
                  {modal.type === 'add'
                    ? 'Fill in the details below'
                    : `Editing "${modal.project.name}"`}
                </p>
              </div>
              <button className="tr-modal-close" onClick={closeModal} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="tr-modal-body tr-modal-form">
              <label>
                Project name *
                <input type="text" value={form.name} onChange={set('name')}
                  placeholder="e.g. MindForge, ML Classifier" autoFocus />
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description} onChange={set('description')}
                  placeholder="What is this? What will you build or learn?" />
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
                <input type="text" value={form.tech_stack} onChange={set('tech_stack')}
                  placeholder="React, Python, TensorFlow (comma separated)" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  GitHub URL
                  <input type="url" value={form.github_url} onChange={set('github_url')} placeholder="https://github.com/..." />
                </label>
                <label>
                  Demo / Live URL
                  <input type="url" value={form.demo_url} onChange={set('demo_url')} placeholder="https://..." />
                </label>
              </div>
              <label>
                Google Colab URL
                <input type="url" value={form.colab_url} onChange={set('colab_url')} placeholder="https://colab.research.google.com/..." />
              </label>
              <label>
                Lessons learned / Notes
                <textarea rows={3} value={form.lessons_learned} onChange={set('lessons_learned')}
                  placeholder="What did you learn? What would you do differently?" />
              </label>
              {error && <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>}
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

/* ─── Project card ──────────────────────────────────────────────────────────────────── */

function ProjectCard({
  project, isActive, onClick,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  const cat      = CATEGORY_CONFIG[project.category ?? 'personal'];
  const pri      = PRIORITY_CONFIG[project.priority ?? 'medium'];
  const phase    = getPhase(project.status);
  const phaseCfg = PHASE_CONFIG[phase];

  return (
    <button
      className={`pj-card${isActive ? ' pj-card--active' : ''}`}
      style={{ '--cat-color': cat.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="pj-card-priority" style={{ background: pri.dot }} title={`${pri.label} priority`} />
      <div className="pj-card-name">{project.name}</div>
      <div className="pj-card-meta">
        <span className="pj-card-phase" style={{ color: phaseCfg.color, background: `${phaseCfg.color}18` }}>
          {phaseCfg.label}
        </span>
        <span className="pj-card-cat" style={{ color: cat.color, background: cat.bg }}>
          {cat.icon}&nbsp;{cat.label}
        </span>
      </div>
      {project.description && (
        <p className="pj-card-desc">{project.description}</p>
      )}
      {project.tech_stack.length > 0 && (
        <div className="pj-card-tags">
          {project.tech_stack.slice(0, 4).map(t => (
            <span key={t} className="pj-card-tag">{t}</span>
          ))}
          {project.tech_stack.length > 4 && (
            <span className="pj-card-tag pj-card-tag--more">+{project.tech_stack.length - 4}</span>
          )}
        </div>
      )}
      <div className="pj-card-footer">
        <div className="pj-card-icons">
          {project.github_url  && <Github size={13} />}
          {project.demo_url    && <ExternalLink size={13} />}
          {project.colab_url   && <ExternalLink size={13} />}
        </div>
        {project.deadline && (
          <span className="pj-card-deadline">
            <Calendar size={11} />&nbsp;{project.deadline}
          </span>
        )}
      </div>
    </button>
  );
}

/* ─── Detail drawer ──────────────────────────────────────────────────────────────────── */

function ProjectDetail({
  project, onEdit, onDelete, onClose,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const cat      = CATEGORY_CONFIG[project.category ?? 'personal'];
  const pri      = PRIORITY_CONFIG[project.priority ?? 'medium'];
  const phase    = getPhase(project.status);
  const phaseCfg = PHASE_CONFIG[phase];

  return (
    <div className="pj-detail-inner">

      {/* Top bar */}
      <div className="pj-drawer-topbar">
        <div className="pj-detail-phase" style={{
          color: phaseCfg.color,
          borderColor: `${phaseCfg.color}30`,
          background: `${phaseCfg.color}10`,
        }}>
          {phaseCfg.label}
        </div>
        <div className="pj-drawer-topbar-right">
          <button className="secondary-button"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            onClick={() => onEdit(project)}>
            <Pencil size={13} /> Edit
          </button>
          <button className="pj-delete-btn" onClick={() => onDelete(project.id)}>
            <Trash2 size={13} />
          </button>
          <button className="pj-drawer-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Name + badges */}
      <h2 className="pj-detail-name">{project.name}</h2>
      <div className="pj-detail-badges">
        <span className="pj-badge" style={{ color: cat.color, background: cat.bg }}>
          {cat.icon}&nbsp;{cat.label}
        </span>
        <span className="pj-badge" style={{ color: pri.color, background: `${pri.dot}18` }}>
          <span className="pj-badge-dot" style={{ background: pri.dot }} />
          {pri.label} priority
        </span>
        {project.deadline && (
          <span className="pj-badge" style={{ color: '#818cf8', background: 'rgba(129,140,248,0.1)' }}>
            <Calendar size={10} />&nbsp;{project.deadline}
          </span>
        )}
      </div>

      <div className="pj-detail-body">
        {project.description && (
          <section className="pj-section">
            <h3 className="pj-section-title">Description</h3>
            <p className="pj-description">{project.description}</p>
          </section>
        )}
        {project.tech_stack.length > 0 && (
          <section className="pj-section">
            <h3 className="pj-section-title">Tech Stack</h3>
            <div className="tag-row">
              {project.tech_stack.map(tag => (
                <span key={tag} className="tag-chip">{tag}</span>
              ))}
            </div>
          </section>
        )}
        {(project.github_url || project.demo_url || project.colab_url) && (
          <section className="pj-section">
            <h3 className="pj-section-title">Links</h3>
            <div className="pj-links">
              {project.github_url && (
                <a href={project.github_url} target="_blank" rel="noreferrer" className="pj-link">
                  <Github size={14} /> GitHub
                </a>
              )}
              {project.demo_url && (
                <a href={project.demo_url} target="_blank" rel="noreferrer" className="pj-link">
                  <ExternalLink size={14} /> Demo
                </a>
              )}
              {project.colab_url && (
                <a href={project.colab_url} target="_blank" rel="noreferrer" className="pj-link">
                  <ExternalLink size={14} /> Colab
                </a>
              )}
            </div>
          </section>
        )}
        <section className="pj-section">
          <MissionsPanel projectId={project.id} alwaysOpen />
        </section>
        {project.lessons_learned && (
          <section className="pj-section pj-lessons">
            <h3 className="pj-section-title" style={{ color: '#34d399' }}>💡 Lessons Learned</h3>
            <p className="pj-description">{project.lessons_learned}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/* ─── Missions Panel ──────────────────────────────────────────────────────────────────── */

function MissionsPanel({
  projectId,
  alwaysOpen = false,
}: {
  projectId: string;
  alwaysOpen?: boolean;
}) {
  const [open,     setOpen]     = useState(alwaysOpen);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loaded,   setLoaded]   = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding,   setAdding]   = useState(false);

  useEffect(() => {
    setMissions([]);
    setLoaded(false);
    if (alwaysOpen) setOpen(true);
  }, [projectId, alwaysOpen]);

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
      {alwaysOpen ? (
        <div className="pj-missions-header">
          <Flag size={14} style={{ color: '#0099CC', flexShrink: 0 }} />
          <h3 className="pj-section-title" style={{ margin: 0 }}>Missions</h3>
          {total > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--tk-text-muted)', marginLeft: 'auto' }}>
              {done} / {total} done
            </span>
          )}
        </div>
      ) : (
        <button type="button" className="ms-toggle" onClick={() => setOpen(v => !v)}>
          <Flag size={12} className="ms-toggle-icon" />
          <span className="ms-toggle-label">Missions</span>
          {total > 0 && <span className="ms-badge">{done}/{total}</span>}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
      {open && total > 0 && (
        <div className="ms-progress-track">
          <div className="ms-progress-fill" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      )}
      {open && (
        <div className="ms-body">
          {!loaded && <p className="ms-loading">Loading…</p>}
          {loaded && missions.length === 0 && (
            <p className="ms-empty">No missions yet — add your first one below.</p>
          )}
          {loaded && missions.map(m => (
            <div key={m.id} className={`ms-row ${m.status === 'done' ? 'ms-row--done' : ''}`}>
              <button type="button" className="ms-check" onClick={() => handleToggle(m)}>
                {m.status === 'done' ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
              <span className="ms-title">{m.title}</span>
              <button type="button" className="ms-delete" onClick={() => handleDelete(m.id)}>
                <X size={11} />
              </button>
            </div>
          ))}
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
