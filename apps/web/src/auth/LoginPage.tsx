import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="login-shell">
      <aside className="login-brand-panel">
        <div className="login-product-lockup">
          <img src="/agua-logo.png" alt="AGUA Engineers" className="login-hero-logo" />
        </div>
        <i className="login-ring login-ring-one" /><i className="login-ring login-ring-two" />
      </aside>
      <main className="login-form-panel">
        <div className="login-mobile-brand">
          <img src="/agua-logo-mark.png" alt="AGUA Engineers" />
        </div>
        <div className="login-form-wrap">
          <h1>Welcome back</h1>
          <form onSubmit={onSubmit} className="login-form">
            <label>
              Employee code
              <input
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="username"
                placeholder="Enter employee code"
                required
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {error && <p className="error login-error">{error}</p>}
            <button className="login-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Signing in…' : 'Sign in'}</span><span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
        <p className="login-help">Need access? Contact your administrator.</p>
      </main>
    </div>
  );
}
