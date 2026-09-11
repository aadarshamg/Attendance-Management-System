import { haversineMeters } from './geofence.service';

describe('haversineMeters', () => {
  it('is ~0 for identical points', () => {
    expect(haversineMeters(28.6274, 77.3716, 28.6274, 77.3716)).toBeCloseTo(0, 5);
  });

  it('matches a known short distance within 1%', () => {
    // ~111.32 m per 0.001 deg of latitude near the equator.
    const d = haversineMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(113);
  });

  it('flags a point well outside a 150 m radius', () => {
    const d = haversineMeters(28.6274, 77.3716, 28.63, 77.38);
    expect(d).toBeGreaterThan(150);
  });
});
