import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

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
      {/* ── Left panel ── */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <img src={logo} alt="MindForge" className="brand-logo--auth" />
          <h1 className="auth-tagline">
            Where curiosity<br /><span>becomes mastery.</span>
          </h1>
          <p className="auth-subtitle">
            Your personal learning OS — organize projects, master topics, track progress, and run code in one focused place.
          </p>
          <ul className="auth-features">
            <li>Visual knowledge trees with AI-generated roadmaps</li>
            <li>Run Python & JS code blocks directly in your notes</li>
            <li>Track projects, missions and deadlines in one view</li>
            <li>Paste screenshots and images straight into your notes</li>
          </ul>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-right-inner">
          <h2 className="auth-right-title">{isSignupMode ? 'Create account' : 'Welcome back'}</h2>
          <p className="auth-right-sub">{isSignupMode ? 'Start building your second brain.' : 'Sign in to continue learning.'}</p>

          <form className="auth-form" onSubmit={onSubmit}>
            <label>
              Email
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Working…' : isSignupMode ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {message && <p className="form-message">{message}</p>}

          <button
            className="text-button"
            type="button"
            style={{ marginTop: '1rem', display: 'block', width: '100%', textAlign: 'center' }}
            onClick={() => setIsSignupMode(v => !v)}
          >
            {isSignupMode ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
