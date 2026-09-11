export interface StampMeta {
  siteName: string;
  workerName: string;
  employeeCode: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  takenAt: Date;
}

function fmtCoord(value: number, positive: string, negative: string): string {
  const hemi = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(5)}°${hemi}`;
}

/**
 * Burn a GPS/identity stamp into the image pixels (spec §5.1). Because the text
 * becomes part of the picture it survives compression and cannot be stripped
 * like EXIF metadata.
 */
export function drawWatermark(canvas: HTMLCanvasElement, meta: StampMeta): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const lines = [
    `Site: ${meta.siteName}`,
    `Lat ${fmtCoord(meta.latitude, 'N', 'S')}  Lng ${fmtCoord(meta.longitude, 'E', 'W')}  (±${Math.round(meta.accuracyM)} m)`,
    meta.takenAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }),
    `Worker: ${meta.workerName} (${meta.employeeCode})`,
  ];

  const pad = Math.round(canvas.width * 0.02);
  const fontSize = Math.max(14, Math.round(canvas.width * 0.028));
  const lineHeight = Math.round(fontSize * 1.4);
  ctx.font = `${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textBaseline = 'top';

  const boxHeight = pad * 2 + lineHeight * lines.length;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, canvas.height - boxHeight + pad + i * lineHeight);
  });
}
