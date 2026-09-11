export interface CameraHandle {
  stream: MediaStream;
  stop: () => void;
}

/** Live camera only — there is no file-input fallback, so a gallery photo cannot be submitted. */
export async function startCamera(facingMode: 'user' | 'environment' = 'user'): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This device/browser does not support camera capture.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
  return {
    stream,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  };
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: number;
}

export async function getGpsFix(): Promise<GpsFix> {
  if (!navigator.geolocation) {
    throw new Error('This device/browser does not provide location.');
  }
  return new Promise<GpsFix>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => reject(new Error(geolocationMessage(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function geolocationMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Attendance needs your GPS location — enable it and try again.';
    case err.POSITION_UNAVAILABLE:
      return 'Location unavailable. Move to open sky and try again.';
    case err.TIMEOUT:
      return 'Getting a GPS fix took too long. Try again.';
    default:
      return 'Could not read your location.';
  }
}

/** Draw the current video frame onto a fresh canvas at the video's native resolution. */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
