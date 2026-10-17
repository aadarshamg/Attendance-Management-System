import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { api } from '../lib/api';

/** Matches the server's IMAGE_RETENTION_DAYS default; only used to word the missing-photo note. */
const PHOTO_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const icon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function RecordDetailPage() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-record', id],
    queryFn: () => api.adminRecord(id),
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data) return <p className="error">{(error as Error)?.message ?? 'Not found'}</p>;

  const driftSec = Math.round(
    (new Date(data.serverTimestamp).getTime() - new Date(data.deviceTimestamp).getTime()) / 1000,
  );

  return (
    <div className="stack">
      <Link to="/admin" className="link">
        Back to attendance
      </Link>
      <header className="row-between">
        <h1>
          {data.workerName} · {data.markType === 'check_in' ? 'In' : 'Out'}{' '}
          {new Date(data.serverTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </h1>
      </header>

      <div className="detail-grid">
        <div className="card">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt="Stamped attendance" className="detail-photo" />
          ) : (
            <p className="muted">
              {Date.now() - new Date(data.serverTimestamp).getTime() > PHOTO_RETENTION_MS
                ? 'Photo deleted after 90 days. The attendance record is kept permanently.'
                : 'Photo was not saved: the upload to photo storage failed when this attendance was marked. The attendance record itself is saved.'}
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
        <Row label="Address (server geocode)" value={data.address ?? '-'} />
        <Row label="Site" value={data.siteName ?? '-'} />
        <Row label="At the site" value={data.withinGeofence ? 'Yes' : 'No, outside the site area'} />
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
