import { ApiError } from './api';
import { DeviceError } from './camera';
import type { MessageKey } from './i18n';

export interface FriendlyError {
  icon: string;
  title: MessageKey;
  fix: MessageKey;
}

const BY_DEVICE: Record<DeviceError['kind'], FriendlyError> = {
  camera_denied: { icon: '📷', title: 'err.cameraDenied', fix: 'err.cameraDenied.fix' },
  camera_missing: { icon: '📷', title: 'err.cameraMissing', fix: 'err.cameraMissing.fix' },
  camera_busy: { icon: '📷', title: 'err.cameraBusy', fix: 'err.cameraBusy.fix' },
  location_denied: { icon: '📍', title: 'err.locationDenied', fix: 'err.locationDenied.fix' },
  location_weak: { icon: '📍', title: 'err.locationWeak', fix: 'err.locationWeak.fix' },
};

const SERVER: FriendlyError = { icon: '⚠️', title: 'err.server', fix: 'err.server.fix' };

/**
 * Turn any error from the worker flow into a plain-language problem + what to do,
 * instead of showing the technical message.
 */
export function toFriendlyError(e: unknown, context: 'pin' | 'password' | 'mark'): FriendlyError {
  if (e instanceof DeviceError) return BY_DEVICE[e.kind];
  // fetch() rejects with a TypeError when the phone has no connection.
  if (e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { icon: '📶', title: 'err.network', fix: 'err.network.fix' };
  }
  if (e instanceof ApiError) {
    if (e.code === 'PIN_LOCKED') return { icon: '🔒', title: 'err.locked', fix: 'err.locked.fix' };
    if (e.status === 429) return { icon: '⏳', title: 'err.slowDown', fix: 'err.slowDown.fix' };
    if (e.status === 401 && context === 'pin') {
      return { icon: '🔑', title: 'err.wrongPin', fix: 'err.wrongPin.fix' };
    }
    if (e.status === 401 && context === 'password') {
      return { icon: '🔑', title: 'err.wrongPassword', fix: 'err.wrongPassword.fix' };
    }
    if (e.status === 413 || (e.status === 400 && context === 'mark')) {
      return { icon: '🖼️', title: 'err.photoTooBig', fix: 'err.photoTooBig.fix' };
    }
  }
  return SERVER;
}
