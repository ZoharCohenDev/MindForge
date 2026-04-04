import { Check, Loader2, Circle, SkipForward } from 'lucide-react';
import type { StepState, StepStatus } from '../lib/useTreeGeneration';

interface Props {
  steps: StepState[];
  role: string;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <div className="gp-icon gp-icon--done"><Check size={14} /></div>;
    case 'in-progress':
      return <div className="gp-icon gp-icon--active"><Loader2 size={14} className="spin" /></div>;
    case 'skipped':
      return <div className="gp-icon gp-icon--skipped"><SkipForward size={12} /></div>;
    default:
      return <div className="gp-icon gp-icon--pending"><Circle size={14} /></div>;
  }
}

export function GenerationProgress({ steps, role }: Props) {
  const completed = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="gp-root">
      <div className="gp-header">
        <div className="gp-header-text">
          <h3 className="gp-title">Building your learning tree</h3>
          <p className="gp-subtitle">
            Crafting a personalised roadmap for <strong>{role}</strong>
          </p>
        </div>
        <span className="gp-pct">{pct}%</span>
      </div>

      <div className="gp-bar-track">
        <div className="gp-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <ol className="gp-steps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`gp-step gp-step--${step.status}`}
          >
            <StepIcon status={step.status} />
            <div className="gp-step-text">
              <span className="gp-step-title">{step.title}</span>
              <span className="gp-step-desc">{step.description}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
