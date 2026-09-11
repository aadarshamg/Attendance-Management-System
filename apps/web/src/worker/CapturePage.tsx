import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { MarkType } from '@ams/shared';
import { getGpsFix, grabFrame, startCamera, type CameraHandle, type GpsFix } from '../lib/camera';
import { compressStamped, downscale, type CompressResult } from '../lib/compress';
import { drawWatermark } from '../lib/watermark';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

type Phase = 'camera' | 'processing' | 'preview' | 'submitting';

export function CapturePage() {
  const [params] = useSearchParams();
  const markType: MarkType = params.get('type') === 'check_out' ? 'check_out' : 'check_in';
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);

  useEffect(() => {
    let cancelled = false;
    startCamera('user')
      .then((handle) => {
        if (cancelled) {
          handle.stop();
          return;
        }
        cameraRef.current = handle;
        if (videoRef.current) {
          videoRef.current.srcObject = handle.stream;
          void videoRef.current.play();
        }
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
      cameraRef.current?.stop();
    };
  }, []);

  async function onCapture() {
    if (!videoRef.current || !user) return;
    setPhase('processing');
    setError(null);
    try {
      const frame = grabFrame(videoRef.current);
      const gps = await getGpsFix();
      setFix(gps);

      const scaled = downscale(frame);
      drawWatermark(scaled, {
        siteName: user.assignedSiteName ?? 'Unassigned site',
        workerName: user.name,
        employeeCode: user.employeeCode,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyM: gps.accuracyM,
        takenAt: new Date(),
      });

      const compressed = await compressStamped(scaled, gps);
      setResult(compressed);
      setPhase('preview');
      cameraRef.current?.stop();
    } catch (e) {
      setError((e as Error).message);
      setPhase('camera');
    }
  }

  function retake() {
    if (result) URL.revokeObjectURL(result.previewUrl);
    setResult(null);
    setFix(null);
    setPhase('camera');
    startCamera('user').then((handle) => {
      cameraRef.current = handle;
      if (videoRef.current) {
        videoRef.current.srcObject = handle.stream;
        void videoRef.current.play();
      }
    });
  }

  async function submit() {
    if (!result || !fix) return;
    setPhase('submitting');
    setError(null);
    try {
      const form = new FormData();
      const ext = result.mime === 'image/webp' ? 'webp' : 'jpg';
      form.append('image', result.blob, `mark.${ext}`);
      form.append('markType', markType);
      form.append('latitude', String(fix.latitude));
      form.append('longitude', String(fix.longitude));
      form.append('gpsAccuracyM', String(fix.accuracyM));
      form.append('deviceTimestamp', new Date().toISOString());
      const marked = await api.mark(form);
      navigate('/confirmation', { state: marked, replace: true });
    } catch (e) {
      setError((e as Error).message);
      setPhase('preview');
    }
  }

  return (
    <div className="stack page">
      <header className="row-between">
        <h1>{markType === 'check_in' ? 'Check In' : 'Check Out'}</h1>
        <button className="link" onClick={() => navigate('/')}>
          Cancel
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="camera-frame">
        {phase !== 'preview' && phase !== 'submitting' ? (
          <video ref={videoRef} playsInline muted className="camera-view" />
        ) : (
          result && <img src={result.previewUrl} alt="Captured attendance" className="camera-view" />
        )}
      </div>

      {(phase === 'camera' || phase === 'processing') && (
        <button className="big primary" onClick={onCapture} disabled={phase === 'processing'}>
          {phase === 'processing' ? 'Reading GPS & stamping…' : 'Capture photo'}
        </button>
      )}

      {phase === 'preview' && result && fix && (
        <div className="stack">
          <p className="muted">
            {Math.round(result.bytes / 1024)} KB · ±{Math.round(fix.accuracyM)} m accuracy
          </p>
          <div className="row gap">
            <button onClick={retake}>Retake</button>
            <button className="primary" onClick={submit}>
              Submit attendance
            </button>
          </div>
        </div>
      )}

      {phase === 'submitting' && <p className="muted">Uploading…</p>}
    </div>
  );
}
