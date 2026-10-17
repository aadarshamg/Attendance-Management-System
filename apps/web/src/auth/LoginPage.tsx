import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizePhone, PIN_PATTERN } from '@ams/shared';
import { useAuth } from './AuthContext';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { toFriendlyError, type FriendlyError } from '../lib/friendlyError';
import { ProblemCard } from '../components/ProblemCard';

type Mode = 'worker' | 'staff';
const MODE_KEY = 'ams.loginMode';

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'staff' ? 'staff' : 'worker';
  } catch {
    return 'worker';
  }
}

export function LoginPage() {
  const { login, loginWithPin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setModeState] = useState<Mode>(readMode);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);

  function setMode(next: Mode) {
    setModeState(next);
    setProblem(null);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (mode === 'worker') {
      if (!normalizePhone(phone)) {
        setProblem({ icon: '📱', title: 'err.badPhone', fix: 'err.badPhone.fix' });
        return;
      }
      if (!PIN_PATTERN.test(pin)) {
        setProblem({ icon: '🔢', title: 'err.badPin', fix: 'err.badPin.fix' });
        return;
      }
    }
    setBusy(true);
    try {
      const user =
        mode === 'worker'
          ? await loginWithPin(phone, pin)
          : await login(employeeCode.trim(), password);
      navigate(user.role === 'worker' ? '/' : '/admin', { replace: true });
    } catch (err) {
      setProblem(toFriendlyError(err, mode === 'worker' ? 'pin' : 'password'));
      if (mode === 'worker') setPin('');
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
        <div className="login-topbar">
          <div className="login-mobile-brand">
            <img src="/agua-logo-mark.png" alt="AGUA Engineers" />
          </div>
          <LanguageToggle />
        </div>
        <div className="login-form-wrap">
          <h1>{t('login.title')}</h1>
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'worker'}
              className={mode === 'worker' ? 'active' : ''}
              onClick={() => setMode('worker')}
            >
              <span aria-hidden="true">👷</span> {t('login.workerTab')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'staff'}
              className={mode === 'staff' ? 'active' : ''}
              onClick={() => setMode('staff')}
            >
              <span aria-hidden="true">💼</span> {t('login.staffTab')}
            </button>
          </div>
          <form onSubmit={onSubmit} className="login-form">
            {mode === 'worker' ? (
              <>
                <label>
                  <span><span aria-hidden="true">📱</span> {t('login.phone')}</span>
                  <input
                    className="login-big-input"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, ''))}
                    placeholder={t('login.phonePlaceholder')}
                    maxLength={16}
                    required
                  />
                </label>
                <label>
                  <span><span aria-hidden="true">🔢</span> {t('login.pin')}</span>
                  <input
                    className="login-big-input pin-input"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    pattern="\d{4}"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {t('login.employeeCode')}
                  <input
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    autoCapitalize="characters"
                    autoComplete="username"
                    placeholder={t('login.employeeCodePlaceholder')}
                    required
                  />
                </label>
                <label>
                  {t('login.password')}
                  <span className="password-field">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder')}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? t('login.hide') : t('login.show')}
                    </button>
                  </span>
                </label>
              </>
            )}
            {problem && <ProblemCard problem={problem} />}
            <button className="login-submit" type="submit" disabled={busy}>
              <span>{busy ? t('login.busy') : t('login.submit')}</span><span aria-hidden="true">→</span>
            </button>
          </form>
        </div>
        {mode === 'worker' && <p className="login-help">{t('login.help')}</p>}
      </main>
    </div>
  );
}
