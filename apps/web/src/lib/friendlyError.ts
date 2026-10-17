import { ApiError } from './api';
import { DeviceError } from './camera';
import type { MessageKey } from './i18n';
import type { IconName } from '../components/Icon';

export interface FriendlyError {
  icon: IconName;
  title: MessageKey;
  fix: MessageKey;
}

const BY_DEVICE: Record<DeviceError['kind'], FriendlyError> = {
  camera_denied: { icon: 'camera', title: 'err.cameraDenied', fix: 'err.cameraDenied.fix' },
  camera_missing: { icon: 'camera', title: 'err.cameraMissing', fix: 'err.cameraMissing.fix' },
  camera_busy: { icon: 'camera', title: 'err.cameraBusy', fix: 'err.cameraBusy.fix' },
  location_denied: { icon: 'pin', title: 'err.locationDenied', fix: 'err.locationDenied.fix' },
  location_weak: { icon: 'pin', title: 'err.locationWeak', fix: 'err.locationWeak.fix' },
};

const SERVER: FriendlyError = { icon: 'alert', title: 'err.server', fix: 'err.server.fix' };

/**
 * Turn any error from the worker flow into a plain-language problem + what to do,
 * instead of showing the technical message.
 */
export function toFriendlyError(e: unknown, context: 'pin' | 'password' | 'mark'): FriendlyError {
  if (e instanceof DeviceError) return BY_DEVICE[e.kind];
  // fetch() rejects with a TypeError when the phone has no connection.
  if (e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { icon: 'wifiOff', title: 'err.network', fix: 'err.network.fix' };
  }
  if (e instanceof ApiError) {
    if (e.code === 'PIN_LOCKED') return { icon: 'lock', title: 'err.locked', fix: 'err.locked.fix' };
    if (e.status === 429) return { icon: 'hourglass', title: 'err.slowDown', fix: 'err.slowDown.fix' };
    if (e.status === 401 && context === 'pin') {
      return { icon: 'key', title: 'err.wrongPin', fix: 'err.wrongPin.fix' };
    }
    if (e.status === 401 && context === 'password') {
      return { icon: 'key', title: 'err.wrongPassword', fix: 'err.wrongPassword.fix' };
    }
    if (e.status === 413 || (e.status === 400 && context === 'mark')) {
      return { icon: 'image', title: 'err.photoTooBig', fix: 'err.photoTooBig.fix' };
    }
  }
  return SERVER;
}
