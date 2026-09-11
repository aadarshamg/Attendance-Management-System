import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { SiteSummary } from '@ams/shared';
import { api } from '../lib/api';

const icon = new Icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface FormState {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  isActive: boolean;
}

const BLANK: FormState = {
  name: '',
  address: '',
  lat: 28.6139,
  lng: 77.209,
  radius: 150,
  isActive: true,
};

function ClickToSetCenter({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function SitesPage() {
  const queryClient = useQueryClient();
  const sites = useQuery({ queryKey: ['sites'], queryFn: api.sites });
  const [form, setForm] = useState<FormState | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sites'] });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const input = {
        name: f.name,
        address: f.address,
        geofenceCenterLat: f.lat,
        geofenceCenterLng: f.lng,
        geofenceRadiusM: f.radius,
        isActive: f.isActive,
      };
      return f.id ? api.updateSite(f.id, input) : api.createSite(input);
    },
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.deactivateSite(id),
    onSuccess: invalidate,
  });

  const startEdit = (s: SiteSummary) =>
    setForm({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.geofenceCenterLat,
      lng: s.geofenceCenterLng,
      radius: s.geofenceRadiusM,
      isActive: s.isActive,
    });

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Sites &amp; geofences</h1>
        <button className="primary" onClick={() => setForm({ ...BLANK })}>
          Add site
        </button>
      </div>

      {form && <SiteForm form={form} setForm={setForm} save={save} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>Center</th>
              <th>Radius</th>
              <th>Workers</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(sites.data ?? []).map((s) => (
              <tr key={s.id} className={s.isActive ? '' : 'dim'}>
                <td>{s.name}</td>
                <td>{s.address}</td>
                <td>
                  {s.geofenceCenterLat.toFixed(4)}, {s.geofenceCenterLng.toFixed(4)}
                </td>
                <td>{s.geofenceRadiusM} m</td>
                <td>{s.workerCount ?? '—'}</td>
                <td>{s.isActive ? 'yes' : 'no'}</td>
                <td className="row gap">
                  <button className="link" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  {s.isActive && (
                    <button className="link" onClick={() => deactivate.mutate(s.id)}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deactivate.isError && <p className="error">{(deactivate.error as Error).message}</p>}
    </div>
  );
}

function SiteForm({
  form,
  setForm,
  save,
}: {
  form: FormState;
  setForm: (f: FormState | null) => void;
  save: { mutate: (f: FormState) => void; isPending: boolean; isError: boolean; error: unknown };
}) {
  const [center, setCenter] = useState<[number, number]>([form.lat, form.lng]);
  useEffect(() => setCenter([form.lat, form.lng]), [form.lat, form.lng]);

  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(form);
      }}
    >
      <div className="filters">
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Address
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
        </label>
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
          />
        </label>
        <label>
          Radius (m)
          <input
            type="number"
            min={1}
            max={10000}
            value={form.radius}
            onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })}
          />
        </label>
      </div>

      <p className="muted">Click the map to set the geofence center.</p>
      <MapContainer center={center} zoom={15} className="detail-map" scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToSetCenter onPick={(lat, lng) => setForm({ ...form, lat, lng })} />
        <Marker position={[form.lat, form.lng]} icon={icon} />
        <Circle center={[form.lat, form.lng]} radius={form.radius} />
      </MapContainer>

      <div className="row gap">
        <button type="submit" className="primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setForm(null)}>
          Cancel
        </button>
      </div>
      {save.isError && <p className="error">{(save.error as Error).message}</p>}
    </form>
  );
}
