import { useI18n } from '../lib/i18n';
import type { FriendlyError } from '../lib/friendlyError';

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
      <span className="problem-icon" aria-hidden="true">{problem.icon}</span>
      <div className="stack-tight">
        <strong>{t(problem.title)}</strong>
        <span>{t(problem.fix)}</span>
        {onRetry && (
          <button type="button" className="problem-retry" onClick={onRetry}>
            ↻ {retryLabel ?? t('capture.tryAgain')}
          </button>
        )}
      </div>
    </div>
  );
}
