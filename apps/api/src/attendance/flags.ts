import type { FlagReason, RecordStatus } from '@ams/shared';

export interface FlagInput {
  hasAssignedSite: boolean;
  withinGeofence: boolean;
  gpsAccuracyM: number;
  accuracyThresholdM: number;
  driftSeconds: number;
  driftThresholdSeconds: number;
}

/** Pure: derive flag reasons + overall status from the validated inputs. */
export function computeFlags(input: FlagInput): { status: RecordStatus; flagReasons: FlagReason[] } {
  const flagReasons: FlagReason[] = [];

  if (!input.hasAssignedSite) {
    flagReasons.push('no_assigned_site');
  } else if (!input.withinGeofence) {
    flagReasons.push('outside_geofence');
  }

  if (input.gpsAccuracyM > input.accuracyThresholdM) {
    flagReasons.push('low_gps_accuracy');
  }

  if (Number.isFinite(input.driftSeconds) && input.driftSeconds > input.driftThresholdSeconds) {
    flagReasons.push('device_time_drift');
  }

  return { status: flagReasons.length > 0 ? 'flagged' : 'ok', flagReasons };
}
