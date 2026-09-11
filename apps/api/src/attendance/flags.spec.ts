import { computeFlags } from './flags';

const base = {
  hasAssignedSite: true,
  withinGeofence: true,
  gpsAccuracyM: 10,
  accuracyThresholdM: 100,
  driftSeconds: 5,
  driftThresholdSeconds: 300,
};

describe('computeFlags', () => {
  it('is ok inside the geofence with good accuracy and clock', () => {
    expect(computeFlags(base)).toEqual({ status: 'ok', flagReasons: [] });
  });

  it('flags a mark outside the geofence', () => {
    const r = computeFlags({ ...base, withinGeofence: false });
    expect(r.status).toBe('flagged');
    expect(r.flagReasons).toContain('outside_geofence');
  });

  it('flags poor GPS accuracy', () => {
    const r = computeFlags({ ...base, gpsAccuracyM: 150 });
    expect(r.flagReasons).toContain('low_gps_accuracy');
  });

  it('flags device clock drift beyond the threshold', () => {
    const r = computeFlags({ ...base, driftSeconds: 3600 });
    expect(r.flagReasons).toContain('device_time_drift');
  });

  it('flags no_assigned_site instead of outside_geofence when unassigned', () => {
    const r = computeFlags({ ...base, hasAssignedSite: false, withinGeofence: false });
    expect(r.flagReasons).toEqual(['no_assigned_site']);
  });

  it('can stack multiple reasons', () => {
    const r = computeFlags({
      ...base,
      withinGeofence: false,
      gpsAccuracyM: 500,
      driftSeconds: 999,
    });
    expect(r.flagReasons.sort()).toEqual(
      ['device_time_drift', 'low_gps_accuracy', 'outside_geofence'].sort(),
    );
  });
});
