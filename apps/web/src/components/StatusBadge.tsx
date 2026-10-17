import { useI18n } from '../lib/i18n';
import { Icon } from './Icon';

/** Worker-facing confirmation that a mark was saved. */
export function StatusIcon() {
  const { t } = useI18n();
  return (
    <span className="status-icon is-ok">
      <Icon name="checkCircle" size={16} /> {t('status.ok')}
    </span>
  );
}
