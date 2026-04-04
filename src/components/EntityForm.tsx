import { useEffect, useState } from 'react';
import type { AppStatus } from '../types';

const statuses: AppStatus[] = ['not_started', 'learning', 'in_progress', 'done'];

type Props = {
  title: string;
  fields: Array<{
    name: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'textarea' | 'url';
  }>;
  initialValues?: Record<string, string>;
  showStatus?: boolean;
  initialStatus?: AppStatus;
  submitLabel: string;
  onSubmit: (payload: Record<string, string> & { status?: AppStatus }) => Promise<void>;
};

export function EntityForm({
  title,
  fields,
  initialValues,
  showStatus,
  initialStatus = 'not_started',
  submitLabel,
  onSubmit
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValues(initialValues ?? {});
    setStatus(initialStatus);
  }, [initialStatus, initialValues]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    await onSubmit(showStatus ? { ...values, status } : values);
    setIsSaving(false);
    setValues({});
    setStatus('not_started');
  };

  return (
    <form className="entity-form glass-card" onSubmit={handleSubmit}>
      <div className="entity-form-title-row">
        <h3>{title}</h3>
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : submitLabel}
        </button>
      </div>

      <div className="entity-form-grid">
        {fields.map((field) => (
          <label key={field.name} className={field.type === 'textarea' ? 'full-width' : ''}>
            {field.label}
            {field.type === 'textarea' ? (
              <textarea
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value
                  }))
                }
                rows={5}
              />
            ) : (
              <input
                type={field.type ?? 'text'}
                value={values[field.name] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value
                  }))
                }
              />
            )}
          </label>
        ))}

        {showStatus ? (
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as AppStatus)}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </form>
  );
}
