import { useState } from 'react';
import { BrainCircuit, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthGate() {
  const { signIn, signUp, isLoading } = useAuth();
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    const action = isSignupMode ? signUp : signIn;
    const result = await action(email, password);

    if (result) {
      setMessage(result);
    } else if (isSignupMode) {
      setMessage('Account created. Check your email if confirmation is enabled in Supabase.');
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="center-screen">
        <LoaderCircle className="spin" />
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card glass-card">
        <div className="brand-row">
          <div className="brand-icon">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1>LearnOS</h1>
            <p>Your personal learning HQ.</p>
          </div>
        </div>

        <div className="auth-hero">
          <div>
            <span className="pill">React + TypeScript + Supabase</span>
            <h2>Keep your projects, topics, and notes in one clean place.</h2>
            <p>
              This starter already includes a protected app shell, a simple auth flow,
              editable CRUD pages, and a calm dashboard layout.
            </p>
          </div>
          <div className="auth-illustration">
            <LockKeyhole size={28} />
          </div>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : isSignupMode ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {message ? <p className="form-message">{message}</p> : null}

        <button
          className="text-button"
          type="button"
          onClick={() => setIsSignupMode((current) => !current)}
        >
          {isSignupMode ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}
