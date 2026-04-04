import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenCheck,
  BriefcaseBusiness,
  ExternalLink,
  FileText,
  Github,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { getDashboardCounts, getDashboardData } from '../lib/dataApi';
import type { Project } from '../types';

type TreeProgress = { done: number; total: number; pct: number };

// SVG ring progress chart — no library needed
function RingChart({ pct, size = 110, stroke = 10, label, sublabel, color }: {
  pct: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
  color: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  const cx = size / 2;

  return (
    <div className="db-ring-wrap">
      <svg width={size} height={size} className="db-ring-svg">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--tk-border)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cx - 4} textAnchor="middle" className="db-ring-pct" fill="var(--tk-text)">{pct}%</text>
        <text x={cx} y={cx + 14} textAnchor="middle" className="db-ring-sub" fill="var(--tk-text-muted)">done</text>
      </svg>
      <div className="db-ring-label">{label}</div>
      <div className="db-ring-sublabel">{sublabel}</div>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#34d399',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  in_progress: 'In progress',
  done: 'Done',
};

function ProjectCard({ p }: { p: Project }) {
  return (
    <div className="db-project-card glass-card">
      <div className="db-project-top">
        <span className="db-project-name">{p.name}</span>
        <span className="db-priority-dot" style={{ background: PRIORITY_COLOR[p.priority] ?? '#888' }} title={p.priority} />
      </div>
      {p.description && <p className="db-project-desc">{p.description}</p>}
      <div className="db-project-meta">
        <span className="db-status-chip db-status-chip--{p.status}">{STATUS_LABEL[p.status]}</span>
        {p.tech_stack?.length > 0 && (
          <div className="db-tech-list">
            {p.tech_stack.slice(0, 3).map(t => <span key={t} className="db-tech-tag">{t}</span>)}
            {p.tech_stack.length > 3 && <span className="db-tech-tag">+{p.tech_stack.length - 3}</span>}
          </div>
        )}
      </div>
      {(p.github_url || p.demo_url) && (
        <div className="db-project-links">
          {p.github_url && (
            <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="db-project-link">
              <Github size={12} /> Code
            </a>
          )}
          {p.demo_url && (
            <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="db-project-link">
              <ExternalLink size={12} /> Demo
            </a>
          )}
        </div>
      )}
      {p.deadline && (
        <div className="db-project-deadline">
          Due&nbsp;<strong>{new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ topics: 0, projects: 0, notes: 0 });
  const [ai, setAi] = useState<TreeProgress>({ done: 0, total: 0, pct: 0 });
  const [fs, setFs] = useState<TreeProgress>({ done: 0, total: 0, pct: 0 });
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [recentNotes, setRecentNotes] = useState<{ id: string; title: string; created_at: string }[]>([]);

  useEffect(() => {
    void getDashboardCounts().then(setCounts).catch(console.error);
    void getDashboardData().then(d => {
      setAi(d.ai);
      setFs(d.fs);
      setActiveProjects(d.activeProjects);
      setRecentNotes(d.recentNotes);
    }).catch(console.error);
  }, []);

  const overallPct = (ai.total + fs.total) > 0
    ? Math.round(((ai.done + fs.done) / (ai.total + fs.total)) * 100)
    : 0;

  return (
    <div className="page-stack">
      <div className="tr-page-bar">
        <div className="tr-page-bar-left">
          <h2>Dashboard</h2>
          <p>Your learning progress at a glance</p>
        </div>
      </div>

      {/* ── Stat bar ─────────────────────────────────────────── */}
      <section className="stats-grid">
        <article className="stat-card glass-card">
          <Sparkles size={20} />
          <strong>{counts.topics}</strong>
          <span>Topics in tree</span>
        </article>
        <article className="stat-card glass-card">
          <BriefcaseBusiness size={20} />
          <strong>{counts.projects}</strong>
          <span>Projects tracked</span>
        </article>
        <article className="stat-card glass-card">
          <BookOpenCheck size={20} />
          <strong>{counts.notes}</strong>
          <span>Explanations written</span>
        </article>
        <article className="stat-card glass-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/topics')}>
          <TrendingUp size={20} />
          <strong>{overallPct}%</strong>
          <span>Overall progress</span>
        </article>
      </section>

      {/* ── Progress rings ───────────────────────────────────── */}
      <section className="glass-card db-rings-section">
        <h3 className="db-section-title">Roadmap Progress</h3>
        <div className="db-rings-row">
          <RingChart pct={ai.pct}  label="AI Roadmap"         sublabel={`${ai.done} / ${ai.total} topics`}  color="#818cf8" size={120} stroke={11} />
          <RingChart pct={fs.pct}  label="Full Stack Roadmap" sublabel={`${fs.done} / ${fs.total} topics`}  color="#34d399" size={120} stroke={11} />
          <div className="db-overall-ring">
            <RingChart pct={overallPct} label="Overall" sublabel={`${ai.done + fs.done} / ${ai.total + fs.total}`} color="#f472b6" size={140} stroke={13} />
          </div>
        </div>

        {/* bar charts per tree */}
        <div className="db-bars">
          {[
            { label: '🤖 AI Tree',         done: ai.done,  total: ai.total,  pct: ai.pct,  color: '#818cf8' },
            { label: '🌐 Full Stack Tree',  done: fs.done,  total: fs.total,  pct: fs.pct,  color: '#34d399' },
          ].map(row => (
            <div key={row.label} className="db-bar-row">
              <span className="db-bar-label">{row.label}</span>
              <div className="db-bar-track">
                <div className="db-bar-fill" style={{ width: `${row.pct}%`, background: row.color }} />
              </div>
              <span className="db-bar-value">{row.pct}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Active projects + Recent notes ───────────────────── */}
      <div className="db-bottom-grid">

        {/* Active projects */}
        <section className="db-panel glass-card">
          <div className="db-panel-header">
            <h3 className="db-section-title">Active Projects</h3>
            <button type="button" className="db-panel-link" onClick={() => navigate('/projects')}>
              View all →
            </button>
          </div>
          {activeProjects.length === 0 ? (
            <p className="db-empty">No active projects yet. <button type="button" className="db-inline-link" onClick={() => navigate('/projects')}>Add one →</button></p>
          ) : (
            <div className="db-projects-list">
              {activeProjects.map(p => <ProjectCard key={p.id} p={p} />)}
            </div>
          )}
        </section>

        {/* Recent notes */}
        <section className="db-panel glass-card">
          <div className="db-panel-header">
            <h3 className="db-section-title">Recent Explanations</h3>
            <button type="button" className="db-panel-link" onClick={() => navigate('/topics')}>
              View tree →
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <p className="db-empty">No notes yet. Start writing explanations on the AI Tree page.</p>
          ) : (
            <ul className="db-notes-list">
              {recentNotes.map(n => (
                <li key={n.id} className="db-note-row">
                  <FileText size={13} className="db-note-icon" />
                  <span className="db-note-title">{n.title}</span>
                  <span className="db-note-date">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
