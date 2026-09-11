import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { RecordStatus } from '@ams/shared';
import { api } from '../lib/api';
import { FlagReasons, StatusBadge } from '../components/StatusBadge';

const icon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function RecordDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-record', id],
    queryFn: () => api.adminRecord(id),
  });

  const [status, setStatus] = useState<RecordStatus>('ok');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setNote(data.manualNote ?? '');
    }
  }, [data]);

  const review = useMutation({
    mutationFn: () => api.reviewRecord(id, { status, note: note.trim() || undefined }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin-record', id], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-records'] });
    },
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data) return <p className="error">{(error as Error)?.message ?? 'Not found'}</p>;

  const driftSec = Math.round(
    (new Date(data.serverTimestamp).getTime() - new Date(data.deviceTimestamp).getTime()) / 1000,
  );

  return (
    <div className="stack">
      <Link to="/admin" className="link">
        ← All records
      </Link>
      <header className="row-between">
        <h1>
          {data.markType === 'check_in' ? 'Check In' : 'Check Out'} · {data.workerName}
        </h1>
        <StatusBadge status={data.status} reviewed={Boolean(data.reviewedAt)} />
      </header>

      <div className="detail-grid">
        <div className="card">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt="Stamped attendance" className="detail-photo" />
          ) : (
            <p className="muted">
              Image purged after the retention window — the text record is retained permanently.
            </p>
          )}
        </div>

        <div className="card map-card">
          <MapContainer
            center={[data.latitude, data.longitude]}
            zoom={16}
            className="detail-map"
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[data.latitude, data.longitude]} icon={icon} />
            {data.site && (
              <Circle
                center={[data.site.geofenceCenterLat, data.site.geofenceCenterLng]}
                radius={data.site.geofenceRadiusM}
                pathOptions={{ color: data.withinGeofence ? '#16a34a' : '#dc2626' }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      <div className="card stack">
        <Row label="Server timestamp" value={new Date(data.serverTimestamp).toLocaleString()} />
        <Row
          label="Device timestamp"
          value={`${new Date(data.deviceTimestamp).toLocaleString()} (drift ${driftSec}s)`}
        />
        <Row label="Coordinates" value={`${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`} />
        <Row label="GPS accuracy" value={`±${Math.round(data.gpsAccuracyM)} m`} />
        <Row label="Address (server geocode)" value={data.address ?? '—'} />
        <Row label="Site" value={data.siteName ?? '—'} />
        <Row label="Within geofence" value={data.withinGeofence ? 'Yes' : 'No'} />
        <Row label="Image status" value={data.imageStatus} />
        <FlagReasons reasons={data.flagReasons} />
      </div>

      <div className="card stack">
        <h2>Review</h2>
        {data.reviewedAt && (
          <p className="muted">
            Last reviewed by {data.reviewedByName ?? 'unknown'} on{' '}
            {new Date(data.reviewedAt).toLocaleString()}.
          </p>
        )}
        <label>
          Verified status
          <select value={status} onChange={(e) => setStatus(e.target.value as RecordStatus)}>
            <option value="ok">OK</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
        <label>
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Confirmed with site supervisor — worker was on the far scaffold."
          />
        </label>
        {review.isError && <p className="error">{(review.error as Error).message}</p>}
        {review.isSuccess && <p className="muted">Saved.</p>}
        <button className="primary" onClick={() => review.mutate()} disabled={review.isPending}>
          {review.isPending ? 'Saving…' : 'Save review'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between">
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
