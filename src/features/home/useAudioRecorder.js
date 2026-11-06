import { useEffect, useRef, useState } from 'react';
import { readStored } from '../../lib/usePersistentState.js';
import { playRecordingCue } from '../../lib/sounds.js';

const defaults={quality:'high',format:'webm',noiseReduction:true,micGain:75,startEndSound:true,maxDuration:30,keepOriginal:true};
import { isSavableRecordingDuration, MIN_RECORDING_MESSAGE } from '../../lib/recordingPolicy.js';

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
  if(active.sourceStream&&active.sourceStream!==active.stream)active.sourceStream.getTracks().forEach(track=>track.stop());
  active.audioContext?.close?.().catch?.(()=>{});
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
    if(active.settings?.startEndSound)playRecordingCue('stop');
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
    const active = { chunks: [], stream: null, sourceStream:null, recorder: null, timer: null,settings:{...defaults,...readStored('settings:sound:v2',{})} };
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
      active.sourceStream = await navigator.mediaDevices.getUserMedia({ audio:{noiseSuppression:Boolean(active.settings.noiseReduction),echoCancellation:Boolean(active.settings.noiseReduction),autoGainControl:true} });
      active.stream=active.sourceStream;
      if (!isCurrent()) {
        active.sourceStream.getTracks().forEach((track) => track.stop());
        return;
      }
      // 마이크 권한을 기다리는 사이 자정이 지났을 수 있으므로 다시 확인합니다.
      if (canStart && !canStart()) {
        active.sourceStream.getTracks().forEach((track) => track.stop());
        session.current = null;
        setStatus('idle');
        setError('날짜가 바뀌었어요. 오늘 날짜를 선택하고 녹음해 주세요.');
        return;
      }
      const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(AudioContext&&Number(active.settings.micGain)!==100){try{active.audioContext=new AudioContext();const source=active.audioContext.createMediaStreamSource(active.sourceStream),gain=active.audioContext.createGain(),destination=active.audioContext.createMediaStreamDestination();gain.gain.value=Math.max(.1,Math.min(2,Number(active.settings.micGain||100)/100));source.connect(gain);gain.connect(destination);active.stream=destination.stream}catch{active.stream=active.sourceStream}}
      const desired=active.settings.format==='mp4'?['audio/mp4','audio/webm;codecs=opus','audio/webm']:active.settings.format==='wav'?['audio/wav','audio/webm;codecs=opus','audio/webm']:['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
      const mimeType = desired
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const audioBitsPerSecond=active.settings.quality==='standard'?96000:active.settings.quality==='lossless'?320000:192000;
      active.recorder = mimeType
        ? new MediaRecorder(active.stream, { mimeType,audioBitsPerSecond }) : new MediaRecorder(active.stream,{audioBitsPerSecond});
      active.recorder.ondataavailable = ({ data }) => {
        if (data.size) active.chunks.push(data);
      };
      active.recorder.onerror = (event) => active.fail(event.error);
      active.recorder.onstop = () => {
        clearInterval(active.timer);
        active.stream.getTracks().forEach((track) => track.stop());
        if(active.sourceStream!==active.stream)active.sourceStream.getTracks().forEach(track=>track.stop());
        if (!isCurrent()) return;
        session.current = null;
        const duration = active.duration ?? (performance.now() - active.started) / 1000;
        if (!isSavableRecordingDuration(duration)) {
          setDraft(null);
          setElapsed(duration);
          setStatus('idle');
          setError(MIN_RECORDING_MESSAGE);
          return;
        }
        const blob = new Blob(active.chunks, { type: active.recorder.mimeType || active.chunks[0]?.type });
        if (!blob.size) {
          setStatus('idle');
          setError('녹음된 소리가 없어요. 다시 녹음해 주세요.');
          return;
        }
        setDraft({ blob, originalBlob:active.settings.keepOriginal?blob:null, recordedAt: active.recordedAt, duration,recordingSettings:active.settings });
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
      if(active.settings.startEndSound)playRecordingCue('start');
      setDraft(null);
      setElapsed(0);
      setStatus('recording');
      active.timer = setInterval(() => {
        if (isCurrent()){const value=(performance.now()-active.started)/1000;setElapsed(value);if(value>=Number(active.settings.maxDuration||30)*60)stop()}
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
