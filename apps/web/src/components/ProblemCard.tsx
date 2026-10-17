import { useI18n } from '../lib/i18n';
import type { FriendlyError } from '../lib/friendlyError';
import { Icon } from './Icon';

/** What went wrong, in plain words, and what the worker should do about it. */
export function ProblemCard({
  problem,
  onRetry,
  retryLabel,
}: {
  problem: FriendlyError;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="problem-card" role="alert">
      <span className="problem-icon">
        <Icon name={problem.icon} size={22} />
      </span>
      <div className="stack-tight">
        <strong>{t(problem.title)}</strong>
        <span>{t(problem.fix)}</span>
        {onRetry && (
          <button type="button" className="problem-retry" onClick={onRetry}>
            <Icon name="retry" size={18} /> {retryLabel ?? t('capture.tryAgain')}
          </button>
        )}
      </div>
    </div>
  );
}
