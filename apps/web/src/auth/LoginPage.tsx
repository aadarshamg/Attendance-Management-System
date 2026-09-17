import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(employeeCode.trim(), password);
      navigate(user.role === 'worker' ? '/' : '/admin', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card center-screen">
      <span className="eyebrow">Workforce operations</span>
      <h1>Welcome to TrackFlow</h1>
      <p className="muted">Sign in to manage attendance, sites, and your workday.</p>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Employee code
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="username"
            placeholder="e.g. TF-2048"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
