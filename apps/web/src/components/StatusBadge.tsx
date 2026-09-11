import type { RecordStatus } from '@ams/shared';

export function StatusBadge({
  status,
  reviewed = false,
}: {
  status: RecordStatus;
  reviewed?: boolean;
}) {
  return (
    <span className={`badge ${status === 'ok' ? 'badge-ok' : 'badge-flagged'}`}>
      {status === 'ok' ? 'OK' : 'Flagged'}
      {reviewed ? ' · reviewed' : ''}
    </span>
  );
}

const REASON_LABELS: Record<string, string> = {
  outside_geofence: 'Outside site geofence',
  low_gps_accuracy: 'Low GPS accuracy',
  device_time_drift: 'Device clock mismatch',
  no_assigned_site: 'No assigned site',
};

export function FlagReasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="flag-list">
      {reasons.map((r) => (
        <li key={r}>{REASON_LABELS[r] ?? r}</li>
      ))}
    </ul>
  );
}
