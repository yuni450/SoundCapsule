import { useEffect, useRef, useState } from 'react';
import { saveRecording } from '../../storage/recordings.js';
import { useAudioRecorder } from './useAudioRecorder.js';
import AudioPlayer from './AudioPlayer.jsx';
import { formatDuration } from './formatDuration.js';
import './home.css';

// 날짜/시간 입력은 제공하지 않습니다. recordedAt은 녹음 훅의 실제 시작 시각만 사용합니다.
export default function RecordingComposer({ compact = false, canStart, startDisabled = false, onActivityChange, onSaved }) {
  const recorder = useAudioRecorder({ canStart });
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [memo, setMemo] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const titleRef = useRef(null);
  const isRecording = recorder.status === 'recording';
  useEffect(() => {
    onActivityChange?.({
      hasUnsaved: Boolean(recorder.draft) || ['recording', 'requesting', 'stopping'].includes(recorder.status),
      busy: saving,
    });
  }, [recorder.draft, recorder.status, saving, onActivityChange]);

  useEffect(() => () => onActivityChange?.({ hasUnsaved: false, busy: false }), [onActivityChange]);
  useEffect(() => {
    if (recorder.status === 'ready') titleRef.current?.focus();
  }, [recorder.status]);
  useEffect(() => {
    if (!recorder.draft && !isRecording && recorder.status !== 'requesting') return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recorder.draft, isRecording, recorder.status]);

  const save = async (event) => {
    event.preventDefault();
    if (saveLock.current || !recorder.draft) return;
    if (!title.trim()) {
      setSaveError('이 소리에 붙일 제목을 입력해 주세요.');
      titleRef.current?.focus();
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveRecording({ ...recorder.draft, title, locationName, memo });
      recorder.reset();
      setTitle(''); setLocationName(''); setMemo('');
      setNotice('이 브라우저에 소중한 소리를 저장했어요.');
      onSaved?.(saved);
    } catch (error) {
      setSaveError(error.name === 'QuotaExceededError'
        ? '저장 공간이 부족해요. 브라우저 저장 공간을 확보한 뒤 다시 저장해 주세요.'
        : '저장하지 못했어요. 녹음은 남아 있으니 저장소 접근 설정을 확인하고 다시 시도해 주세요.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const begin = () => { setNotice(''); setSaveError(''); recorder.start(); };
  const retry = () => {
    if (startDisabled || (canStart && !canStart())) return;
    if (!window.confirm('현재 녹음을 지우고 다시 녹음할까요? 입력한 제목과 메모는 유지됩니다.')) return;
    recorder.reset(); begin();
  };
  const stateText = {
    idle: '오늘의 소리를 담아볼까요?', requesting: '마이크 사용을 허용해 주세요',
    recording: '지금, 소리를 담고 있어요', stopping: '소리를 정리하고 있어요', ready: '어떤 순간을 담았나요?',
  }[recorder.status];
  return <div className={compact ? 'sc-home sc-inline-recorder' : 'sc-composer'}>
        <section className="sc-recorder" aria-labelledby="recorder-title">
          {compact ? <><h3 id="recorder-title" className="sc-composer-title">지금의 소리를 담아보세요</h3><p className="sc-intro">날짜와 시간은 녹음 시작 순간으로 자동 기록돼요.</p></> : <>
          <p className="sc-eyebrow">A LITTLE SOUND, A LASTING MEMORY</p>
          <h1 id="recorder-title">지나가는 순간을,<br />소리로 간직해요.</h1>
          <p className="sc-intro">빗소리, 웃음소리, 익숙한 골목의 소리.<br />오늘의 작은 순간이 내일의 추억이 됩니다.</p>
          </>}
          <div className={`sc-recorder-well ${isRecording ? 'is-recording' : ''}`}>
            <p className="sc-state" role="status">{stateText}</p>
            <div className="sc-orbit">
              <button className={`sc-record-button ${isRecording ? 'is-recording' : ''}`} type="button"
                aria-label={isRecording ? '녹음 종료' : '녹음 시작'}
                disabled={(!isRecording && startDisabled) || (recorder.status !== 'idle' && !isRecording)}
                onClick={isRecording ? recorder.stop : begin}>
                {isRecording ? <span className="sc-stop-icon" /> : (
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="11" y="3" width="10" height="17" rx="5" /><path d="M7 15a9 9 0 0 0 18 0M16 24v5m-5 0h10" /></svg>
                )}
              </button>
            </div>
            <div className="sc-timer" aria-label={`경과 시간 ${formatDuration(recorder.elapsed)}`}>{formatDuration(recorder.elapsed)}</div>
            <p className="sc-hint">{isRecording ? '버튼을 누르면 녹음이 끝나요' : '당신만의 작은 소리 보관함'}</p>
            {recorder.status === 'requesting' && <button className="sc-text-button" type="button" onClick={recorder.cancelRequest}>권한 요청 대기 취소</button>}
          </div>
          {recorder.error && <p role="alert" className="sc-error">{recorder.error}</p>}
          {notice && <p role="status" className="sc-success">{notice}</p>}
          {recorder.draft && (
            <form className="sc-draft" onSubmit={save}>
              <div className="sc-section-heading"><h2>방금 담은 소리</h2><span>{formatDuration(recorder.draft.duration)}</span></div>
              <AudioPlayer blob={recorder.draft.blob} label="방금 녹음한 소리 미리 듣기" />
              <p className="sc-meta">녹음 시작 · <time dateTime={recorder.draft.recordedAt}>{new Date(recorder.draft.recordedAt).toLocaleString('ko-KR')}</time></p>
              <fieldset disabled={saving}>
                <label htmlFor="recording-title">제목 <span className="sc-required">필수</span></label>
                <input ref={titleRef} id="recording-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="어떤 소리인가요?" required maxLength={100} />
                <label htmlFor="recording-place">장소 <span>선택</span></label>
                <input id="recording-place" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="이 소리를 만난 곳" maxLength={200} />
                <label htmlFor="recording-memo">메모 <span>선택</span></label>
                <textarea id="recording-memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 순간의 기분을 남겨보세요" maxLength={500} rows={3} />
                <div className="sc-actions"><button className="sc-secondary" type="button" onClick={retry} disabled={startDisabled}>다시 녹음하기</button><button className="sc-primary" type="submit">{saving ? '저장 중…' : '소리 저장하기'}</button></div>
              </fieldset>
              {saveError && <p className="sc-error" role="alert">{saveError}</p>}
            </form>
          )}
        </section>
  </div>;
}
