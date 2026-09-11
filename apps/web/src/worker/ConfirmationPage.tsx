import { Link, Navigate, useLocation } from 'react-router-dom';
import type { MarkResponse } from '@ams/shared';
import { FlagReasons, StatusBadge } from '../components/StatusBadge';

export function ConfirmationPage() {
  const location = useLocation();
  const mark = location.state as MarkResponse | null;
  if (!mark) return <Navigate to="/" replace />;

  return (
    <div className="stack page">
      <h1>{mark.markType === 'check_in' ? 'Checked in' : 'Checked out'}</h1>
      <div className="card stack">
        <div className="row-between">
          <strong>Recorded (server time)</strong>
          <StatusBadge status={mark.status} />
        </div>
        <div>{new Date(mark.serverTimestamp).toLocaleString()}</div>
        <div className="muted">{mark.address ?? 'Address could not be resolved.'}</div>
        <div className="muted">
          {mark.latitude.toFixed(5)}, {mark.longitude.toFixed(5)} · ±{Math.round(mark.gpsAccuracyM)} m ·{' '}
          {mark.withinGeofence ? 'inside geofence' : 'outside geofence'}
        </div>
        <FlagReasons reasons={mark.flagReasons} />
      </div>
      <Link to="/" className="link">
        ← Back to home
      </Link>
    </div>
  );
}
