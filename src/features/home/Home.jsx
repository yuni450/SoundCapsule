import { useEffect, useRef, useState } from 'react';
import { deleteRecording, getRecordingAudio, listRecordings, saveRecording } from '../../storage/recordings.js';
import { useAudioRecorder } from './useAudioRecorder.js';
import AudioPlayer from './AudioPlayer.jsx';
import RecordingMenu from './RecordingMenu.jsx';
import { downloadAudio } from './downloadAudio.js';
import './home.css';

export function formatDuration(seconds) {
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

function SavedRecording({ recording, onDelete }) {
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadLock = useRef(false);
  const deleteLock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const audio = await getRecordingAudio(recording.id);
      if (!audio) throw new Error('녹음 파일을 찾을 수 없어요.');
      if (alive.current) setBlob(audio);
    } catch {
      if (alive.current) setError('녹음을 불러오지 못했어요. 다시 시도해 주세요.');
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  const remove = async () => {
    if (deleteLock.current || downloadLock.current || !window.confirm('이 녹음을 삭제하시겠습니까?')) return;
    deleteLock.current = true;
    setDeleting(true);
    setError('');
    try {
      await onDelete(recording.id);
    } catch {
      if (alive.current) setError('녹음을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      deleteLock.current = false;
      if (alive.current) setDeleting(false);
    }
  };
  const download = async () => {
    if (downloadLock.current || deleteLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    setError('');
    try {
      const audio = await getRecordingAudio(recording.id);
      if (!audio?.size) throw new Error('녹음 파일을 찾을 수 없어요.');
      if (alive.current) downloadAudio(audio, recording.title);
    } catch {
      if (alive.current) setError('녹음을 다운로드하지 못했어요. 다시 시도해 주세요.');
    } finally {
      downloadLock.current = false;
      if (alive.current) setDownloading(false);
    }
  };
  return (
    <li className="sc-saved-card">
      <div className="sc-record-heading">
        <h3>{recording.title}</h3><span>{formatDuration(recording.duration)}</span>
        <RecordingMenu title={recording.title} busy={deleting || downloading} onDownload={download} onDelete={remove} />
      </div>
      <p className="sc-meta">
        <time dateTime={recording.recordedAt}>{new Date(recording.recordedAt).toLocaleString('ko-KR')}</time>
        {recording.location.name && ` · ${recording.location.name}`}
      </p>
      {recording.memo && <p className="sc-memo">{recording.memo}</p>}
      {blob ? <AudioPlayer blob={blob} label={`${recording.title} 재생`} /> : (
        <button className="sc-text-button" type="button" onClick={load} disabled={loading || deleting}>
          {loading ? '불러오는 중…' : '녹음 듣기 →'}
        </button>
      )}
      {(deleting || downloading) && <p role="status" className="sc-meta">{deleting ? '삭제 중…' : '다운로드 준비 중…'}</p>}
      {error && <p role="alert" className="sc-error">{error}</p>}
    </li>
  );
}

export default function Home() {
  const recorder = useAudioRecorder();
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [memo, setMemo] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const titleRef = useRef(null);
  const isRecording = recorder.status === 'recording';

  const refresh = async () => {
    setLoading(true);
    setListError('');
    try {
      setRecords(await listRecordings());
    } catch {
      setListError('저장한 기록을 불러오지 못했어요. 저장소 접근을 허용하고 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);
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
      setRecords((previous) => [saved, ...previous]);
      recorder.reset();
      setTitle(''); setLocationName(''); setMemo('');
      setNotice('이 브라우저에 소중한 소리를 저장했어요.');
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
  const removeRecording = async (id) => {
    await deleteRecording(id);
    setRecords((previous) => previous.filter((recording) => recording.id !== id));
    setNotice('녹음을 삭제했어요.');
  };
  const retry = () => {
    if (!window.confirm('현재 녹음을 지우고 다시 녹음할까요? 입력한 제목과 메모는 유지됩니다.')) return;
    recorder.reset(); begin();
  };
  const stateText = {
    idle: '오늘의 소리를 담아볼까요?', requesting: '마이크 사용을 허용해 주세요',
    recording: '지금, 소리를 담고 있어요', stopping: '소리를 정리하고 있어요', ready: '어떤 순간을 담았나요?',
  }[recorder.status];

  return (
    <div className="sc-home">
      <header className="sc-header"><a href="#home" className="sc-brand">SoundCapsule<span aria-hidden="true"> ✳</span></a><span className="sc-header-note">나의 소리 일기</span></header>
      <main id="home" className="sc-main">
        <section className="sc-recorder" aria-labelledby="recorder-title">
          <p className="sc-eyebrow">A LITTLE SOUND, A LASTING MEMORY</p>
          <h1 id="recorder-title">지나가는 순간을,<br />소리로 간직해요.</h1>
          <p className="sc-intro">빗소리, 웃음소리, 익숙한 골목의 소리.<br />오늘의 작은 순간이 내일의 추억이 됩니다.</p>
          <div className={`sc-recorder-well ${isRecording ? 'is-recording' : ''}`}>
            <p className="sc-state" role="status">{stateText}</p>
            <div className="sc-orbit">
              <button className={`sc-record-button ${isRecording ? 'is-recording' : ''}`} type="button"
                aria-label={isRecording ? '녹음 종료' : '녹음 시작'}
                disabled={recorder.status !== 'idle' && !isRecording}
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
              <p className="sc-meta">{new Date(recorder.draft.recordedAt).toLocaleString('ko-KR')}</p>
              <fieldset disabled={saving}>
                <label htmlFor="recording-title">제목 <span className="sc-required">필수</span></label>
                <input ref={titleRef} id="recording-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="어떤 소리인가요?" required maxLength={100} />
                <label htmlFor="recording-place">장소 <span>선택</span></label>
                <input id="recording-place" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="이 소리를 만난 곳" maxLength={200} />
                <label htmlFor="recording-memo">메모 <span>선택</span></label>
                <textarea id="recording-memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 순간의 기분을 남겨보세요" maxLength={500} rows={3} />
                <div className="sc-actions"><button className="sc-secondary" type="button" onClick={retry}>다시 녹음하기</button><button className="sc-primary" type="submit">{saving ? '저장 중…' : '소리 저장하기'}</button></div>
              </fieldset>
              {saveError && <p className="sc-error" role="alert">{saveError}</p>}
            </form>
          )}
        </section>
        <section className="sc-library" aria-labelledby="library-title">
          <div className="sc-section-heading"><h2 id="library-title">담아둔 소리</h2><span>{records.length}개의 순간</span></div>
          <p className="sc-storage-note">이 기기의 현재 브라우저에 나만 볼 수 있도록 저장돼요.<br />브라우저 데이터를 지우면 녹음도 삭제됩니다.</p>
          {loading && <p role="status">소리를 불러오는 중…</p>}
          {listError && <div role="alert" className="sc-error">{listError} <button className="sc-text-button" onClick={refresh} type="button">다시 불러오기</button></div>}
          {!loading && !listError && records.length === 0 && <div className="sc-empty"><span aria-hidden="true">♪</span><p>아직 담아둔 소리가 없어요.</p><p>첫 번째 순간을 녹음해 보세요.</p></div>}
          <ul className="sc-record-list">{records.map((recording) => <SavedRecording key={recording.id} recording={recording} onDelete={removeRecording} />)}</ul>
        </section>
      </main>
      <footer className="sc-footer">작은 소리로 남기는, 나의 하루.</footer>
    </div>
  );
}
