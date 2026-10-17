import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizePhone, PIN_PATTERN } from '@ams/shared';
import { useAuth } from './AuthContext';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { toFriendlyError, type FriendlyError } from '../lib/friendlyError';
import { ProblemCard } from '../components/ProblemCard';
import { Icon } from '../components/Icon';

/**
 * Two separate links: /login is phone + PIN for workers (they never see the staff form),
 * /staff is employee code + password for supervisors and admins.
 */
export function LoginPage({ variant }: { variant: 'worker' | 'staff' }) {
  const { login, loginWithPin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [problem, setProblem] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (variant === 'worker') {
      if (!normalizePhone(phone)) {
        setProblem({ icon: 'phone', title: 'err.badPhone', fix: 'err.badPhone.fix' });
        return;
      }
      if (!PIN_PATTERN.test(pin)) {
        setProblem({ icon: 'lock', title: 'err.badPin', fix: 'err.badPin.fix' });
        return;
      }
    }
    setBusy(true);
    try {
      const user =
        variant === 'worker'
          ? await loginWithPin(phone, pin)
          : await login(employeeCode.trim(), password);
      navigate(user.role === 'worker' ? '/' : '/admin', { replace: true });
    } catch (err) {
      setProblem(toFriendlyError(err, variant === 'worker' ? 'pin' : 'password'));
      if (variant === 'worker') setPin('');
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
          <span className="login-role">
            <Icon name={variant === 'worker' ? 'hardhat' : 'badge'} size={16} />
            {variant === 'worker' ? t('login.workerRole') : t('login.staffRole')}
          </span>
          <h1>{variant === 'worker' ? t('login.title') : t('login.staffTitle')}</h1>
          <p className="login-subtitle">
            {variant === 'worker' ? t('login.workerSubtitle') : t('login.staffSubtitle')}
          </p>
          <form onSubmit={onSubmit} className="login-form">
            {variant === 'worker' ? (
              <>
                <label className="field">
                  <span className="field-label">{t('login.phone')}</span>
                  <span className="field-control">
                    <Icon name="phone" className="field-icon" />
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
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">{t('login.pin')}</span>
                  <span className="field-control">
                    <Icon name="lock" className="field-icon" />
                    <input
                      className="login-big-input pin-input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      pattern="\d{4}"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="• • • •"
                      maxLength={4}
                      required
                    />
                  </span>
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span className="field-label">{t('login.employeeCode')}</span>
                  <span className="field-control">
                    <Icon name="user" className="field-icon" />
                    <input
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      // Login IDs can be emails: never let a phone keyboard capitalise them.
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      placeholder={t('login.employeeCodePlaceholder')}
                      required
                    />
                  </span>
                </label>
                <label className="field">
                  <span className="field-label">{t('login.password')}</span>
                  <span className="field-control">
                    <Icon name="lock" className="field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder')}
                      required
                    />
                    <button
                      type="button"
                      className="field-action"
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? t('login.hide') : t('login.show')}
                    </button>
                  </span>
                </label>
              </>
            )}
            {problem && <ProblemCard problem={problem} />}
            <button className="login-submit" type="submit" disabled={busy}>
              <span>{busy ? t('login.busy') : t('login.submit')}</span>
              <Icon name="arrowRight" size={18} />
            </button>
          </form>
        </div>
        <p className="login-help">{variant === 'worker' ? t('login.help') : t('login.staffHelp')}</p>
      </main>
    </div>
  );
}
