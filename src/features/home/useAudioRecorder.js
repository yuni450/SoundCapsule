import { useEffect, useRef, useState } from 'react';

// 종료 API 자체가 실패하더라도 트랙/이벤트/타이머는 반드시 정리합니다.
function disposeSession(active) {
  clearInterval(active.timer);
  if (active.recorder) {
    active.recorder.ondataavailable = null;
    active.recorder.onerror = null;
    active.recorder.onstop = null;
    try {
      if (active.recorder.state !== 'inactive') active.recorder.stop();
    } catch { /* 마이크 트랙 정리를 계속 진행합니다. */ }
  }
  active.stream?.getTracks().forEach((track) => {
    track.onended = null;
    track.stop();
  });
  active.chunks = [];
}

export function microphoneError(error) {
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error?.name)) {
    return '마이크 사용을 허용해 주세요. 브라우저의 사이트 권한 설정에서 변경할 수 있어요.';
  }
  if (error?.name === 'NotFoundError') return '사용할 수 있는 마이크를 찾지 못했어요.';
  if (error?.name === 'NotReadableError') return '마이크에 접근할 수 없어요. 다른 앱에서 사용 중인지 확인해 주세요.';
  return '녹음을 진행하지 못했어요. 마이크 연결을 확인하고 다시 시도해 주세요.';
}

export function useAudioRecorder({ canStart } = {}) {
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const session = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = session.current;
      session.current = null;
      if (active) disposeSession(active);
    };
  }, []);

  const stop = () => {
    const active = session.current;
    if (!active?.recorder || active.recorder.state !== 'recording') return;
    active.duration = (performance.now() - active.started) / 1000;
    clearInterval(active.timer);
    setElapsed(active.duration);
    setStatus('stopping');
    try {
      active.recorder.stop();
    } catch (cause) {
      active.fail(cause);
    }
    active.stream.getTracks().forEach((track) => track.stop());
  };

  const start = async () => {
    if (session.current) return;
    setError('');
    if (canStart && !canStart()) {
      setError('오늘 날짜에서만 새로운 녹음을 시작할 수 있어요.');
      return;
    }
    if (!globalThis.isSecureContext) {
      setError('마이크 녹음은 HTTPS 또는 localhost 주소에서 사용할 수 있어요.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setError('이 브라우저는 녹음을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어 주세요.');
      return;
    }
    const active = { chunks: [], stream: null, recorder: null, timer: null };
    session.current = active;
    setStatus('requesting');
    const isCurrent = () => mounted.current && session.current === active;
    active.fail = (cause) => {
      if (!isCurrent()) return;
      session.current = null;
      disposeSession(active);
      setStatus('idle');
      setError(microphoneError(cause));
    };
    try {
      active.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isCurrent()) {
        active.stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // 마이크 권한을 기다리는 사이 자정이 지났을 수 있으므로 다시 확인합니다.
      if (canStart && !canStart()) {
        active.stream.getTracks().forEach((track) => track.stop());
        session.current = null;
        setStatus('idle');
        setError('날짜가 바뀌었어요. 오늘 날짜를 선택하고 녹음해 주세요.');
        return;
      }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      active.recorder = mimeType
        ? new MediaRecorder(active.stream, { mimeType }) : new MediaRecorder(active.stream);
      active.recorder.ondataavailable = ({ data }) => {
        if (data.size) active.chunks.push(data);
      };
      active.recorder.onerror = (event) => active.fail(event.error);
      active.recorder.onstop = () => {
        clearInterval(active.timer);
        active.stream.getTracks().forEach((track) => track.stop());
        if (!isCurrent()) return;
        session.current = null;
        const duration = active.duration ?? (performance.now() - active.started) / 1000;
        const blob = new Blob(active.chunks, { type: active.recorder.mimeType || active.chunks[0]?.type });
        if (!blob.size) {
          setStatus('idle');
          setError('녹음된 소리가 없어요. 다시 녹음해 주세요.');
          return;
        }
        setDraft({ blob, recordedAt: active.recordedAt, duration });
        setElapsed(duration);
        setStatus('ready');
      };
      active.stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (isCurrent()) {
            setError('마이크 연결이 끊겨 녹음을 종료했어요. 저장 전 소리를 확인해 주세요.');
            stop();
          }
        };
      });
      active.started = performance.now();
      active.recordedAt = new Date().toISOString();
      active.recorder.start(1000);
      setDraft(null);
      setElapsed(0);
      setStatus('recording');
      active.timer = setInterval(() => {
        if (isCurrent()) setElapsed((performance.now() - active.started) / 1000);
      }, 250);
    } catch (cause) {
      active.fail(cause);
    }
  };

  const reset = () => {
    if (session.current) return;
    setDraft(null);
    setElapsed(0);
    setError('');
    setStatus('idle');
  };

  const cancelRequest = () => {
    if (session.current?.recorder) return;
    session.current = null; // 늦게 도착한 권한 결과는 start에서 트랙을 닫습니다.
    setStatus('idle');
  };

  return { status, elapsed, draft, error, start, stop, reset, cancelRequest };
}
