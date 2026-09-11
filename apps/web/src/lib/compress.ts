import imageCompression from 'browser-image-compression';
import piexif from 'piexifjs';

const MAX_EDGE = 1280;
const TARGET_MB = 0.25;

export interface CompressResult {
  blob: Blob;
  mime: 'image/webp' | 'image/jpeg';
  bytes: number;
  previewUrl: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Downscale the longest edge, keeping the already-drawn watermark. */
export function downscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const longest = Math.max(source.width, source.height);
  if (longest <= MAX_EDGE) return source;
  const scale = MAX_EDGE / longest;
  const out = document.createElement('canvas');
  out.width = Math.round(source.width * scale);
  out.height = Math.round(source.height * scale);
  out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/**
 * Encode the stamped canvas to a small file. WebP preferred; JPEG fallback also
 * gets EXIF GPS tags written (spec §5.2 — a convenience layer only).
 */
export async function compressStamped(
  canvas: HTMLCanvasElement,
  gps: { latitude: number; longitude: number },
): Promise<CompressResult> {
  const webp = await canvasToBlob(canvas, 'image/webp', 0.7);
  if (webp && webp.type === 'image/webp') {
    const file = new File([webp], 'mark.webp', { type: 'image/webp' });
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_MB,
      maxWidthOrHeight: MAX_EDGE,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.7,
    });
    return {
      blob: compressed,
      mime: 'image/webp',
      bytes: compressed.size,
      previewUrl: URL.createObjectURL(compressed),
    };
  }

  // JPEG fallback (older Safari).
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.7);
  if (!jpeg) throw new Error('Could not encode the photo.');
  let file = new File([jpeg], 'mark.jpg', { type: 'image/jpeg' });
  file = await imageCompression(file, {
    maxSizeMB: TARGET_MB,
    maxWidthOrHeight: MAX_EDGE,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.7,
  });
  const withExif = await addGpsExif(file, gps);
  return {
    blob: withExif,
    mime: 'image/jpeg',
    bytes: withExif.size,
    previewUrl: URL.createObjectURL(withExif),
  };
}

function toDms(value: number): [[number, number], [number, number], [number, number]] {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 100);
  return [
    [deg, 1],
    [min, 1],
    [sec, 100],
  ];
}

async function addGpsExif(
  file: File,
  gps: { latitude: number; longitude: number },
): Promise<File> {
  try {
    const dataUrl = await imageCompression.getDataUrlFromFile(file);
    const gpsIfd: Record<number, unknown> = {
      [piexif.GPSIFD.GPSLatitudeRef]: gps.latitude >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLatitude]: toDms(gps.latitude),
      [piexif.GPSIFD.GPSLongitudeRef]: gps.longitude >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLongitude]: toDms(gps.longitude),
    };
    const exifStr = piexif.dump({ GPS: gpsIfd });
    const inserted = piexif.insert(exifStr, dataUrl);
    const res = await fetch(inserted);
    const blob = await res.blob();
    return new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    return file; // EXIF is best-effort; never block the mark.
  }
}
