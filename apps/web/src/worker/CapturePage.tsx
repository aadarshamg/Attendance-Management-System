import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { MarkType } from '@ams/shared';
import { getGpsFix, grabFrame, startCamera, type CameraHandle, type GpsFix } from '../lib/camera';
import { compressStamped, downscale, type CompressResult } from '../lib/compress';
import { drawWatermark } from '../lib/watermark';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { LanguageToggle, useI18n } from '../lib/i18n';
import { toFriendlyError, type FriendlyError } from '../lib/friendlyError';
import { ProblemCard } from '../components/ProblemCard';

type Phase = 'starting' | 'camera' | 'processing' | 'preview' | 'submitting' | 'no-camera';

export function CapturePage() {
  const [params] = useSearchParams();
  const markType: MarkType = params.get('type') === 'check_out' ? 'check_out' : 'check_in';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useI18n();

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [problem, setProblem] = useState<FriendlyError | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [fix, setFix] = useState<GpsFix | null>(null);

  const openCamera = useCallback(() => {
    let cancelled = false;
    setPhase('starting');
    setProblem(null);
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
        setPhase('camera');
      })
      .catch((e) => {
        if (cancelled) return;
        setProblem(toFriendlyError(e, 'mark'));
        setPhase('no-camera');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = openCamera();
    return () => {
      cancel();
      cameraRef.current?.stop();
    };
  }, [openCamera]);

  async function onCapture() {
    if (!videoRef.current || !user) return;
    setPhase('processing');
    setProblem(null);
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
      setProblem(toFriendlyError(e, 'mark'));
      setPhase('camera');
    }
  }

  function retake() {
    if (result) URL.revokeObjectURL(result.previewUrl);
    setResult(null);
    setFix(null);
    openCamera();
  }

  async function submit() {
    if (!result || !fix) return;
    setPhase('submitting');
    setProblem(null);
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
      // The home button flips between start/end from this list, so it must not be stale.
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['myPhoto'] });
      navigate('/confirmation', { state: marked, replace: true });
    } catch (e) {
      setProblem(toFriendlyError(e, 'mark'));
      setPhase('preview');
    }
  }

  const isIn = markType === 'check_in';
  const showVideo = phase === 'starting' || phase === 'camera' || phase === 'processing';

  return (
    <div className="worker-page">
      <header className="worker-topbar">
        <button className="back-button" onClick={() => navigate('/')}>
          ← {t('capture.back')}
        </button>
        <LanguageToggle />
      </header>

      <h1 className={`capture-title ${isIn ? 'is-in' : 'is-out'}`}>
        <span aria-hidden="true">{isIn ? '🏗️' : '🏠'}</span>{' '}
        {isIn ? t('capture.startTitle') : t('capture.endTitle')}
      </h1>

      {problem && (
        <ProblemCard
          problem={problem}
          onRetry={
            phase === 'no-camera' ? openCamera : phase === 'camera' ? onCapture : phase === 'preview' ? submit : undefined
          }
        />
      )}

      {phase !== 'no-camera' && (
        <div className="camera-frame">
          {showVideo ? (
            <video ref={videoRef} playsInline muted className="camera-view" />
          ) : (
            result && <img src={result.previewUrl} alt="" className="camera-view" />
          )}
        </div>
      )}

      {showVideo && (
        <>
          <p className="capture-hint">{t('capture.hint')}</p>
          <button
            className="shutter-button"
            onClick={onCapture}
            disabled={phase !== 'camera'}
          >
            <span aria-hidden="true">📷</span>{' '}
            {phase === 'processing' ? t('capture.working') : t('capture.takePhoto')}
          </button>
        </>
      )}

      {(phase === 'preview' || phase === 'submitting') && (
        <div className="preview-actions">
          <button onClick={retake} disabled={phase === 'submitting'}>
            <span aria-hidden="true">↺</span> {t('capture.retake')}
          </button>
          <button className="confirm-button" onClick={submit} disabled={phase === 'submitting'}>
            <span aria-hidden="true">✅</span>{' '}
            {phase === 'submitting' ? t('capture.saving') : t('capture.submit')}
          </button>
        </div>
      )}
    </div>
  );
}
