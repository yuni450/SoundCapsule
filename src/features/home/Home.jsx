import { useEffect, useRef, useState } from 'react';
import { deleteRecording, getRecordingAudio, listRecordings, subscribeRecordings } from '../../storage/recordings.js';
import RecordingComposer from './RecordingComposer.jsx';
import { formatDuration } from './formatDuration.js';
import AudioPlayer from './AudioPlayer.jsx';
import RecordingMenu from './RecordingMenu.jsx';
import { downloadAudio } from './downloadAudio.js';
import './home.css';

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
        <time dateTime={recording.savedAt || recording.recordedAt}>저장 {new Date(recording.savedAt || recording.recordedAt).toLocaleString('ko-KR')}</time>
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

export default function Home({ onActivityChange,groups=[] }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let alive = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      setLoading(true); setListError('');
      try {
        const records = await listRecordings();
        if (alive && current === request) setRecords(records);
      } catch {
        if (alive && current === request) setListError('저장한 기록을 불러오지 못했어요. 저장소 접근을 허용하고 다시 시도해 주세요.');
      } finally { if (alive && current === request) setLoading(false); }
    };
    refreshRef.current = refresh;
    refresh();
    const unsubscribe = subscribeRecordings(refresh);
    return () => { alive = false; request++; unsubscribe(); };
  }, []);
  const removeRecording = async (id) => {
    await deleteRecording(id);
    setRecords((previous) => previous.filter((recording) => recording.id !== id));
    setNotice('녹음을 삭제했어요.');
  };
  return <div className="sc-home">
    <header className="sc-header"><a href="#home" className="sc-brand">SoundCapsule<span aria-hidden="true"> ✳</span></a><span className="sc-header-note">나의 소리 일기</span></header>
    <main id="home" className="sc-main">
      <RecordingComposer onActivityChange={onActivityChange} groups={groups} />
        <section className="sc-library" aria-labelledby="library-title">
          <div className="sc-section-heading"><h2 id="library-title">담아둔 소리</h2><span>{records.length}개의 순간</span></div>
          <p className="sc-storage-note">이 기기의 현재 브라우저에 나만 볼 수 있도록 저장돼요.<br />브라우저 데이터를 지우면 녹음도 삭제됩니다.</p>
          {notice && <p role="status" className="sc-success">{notice}</p>}
          {loading && <p role="status">소리를 불러오는 중…</p>}
          {listError && <div role="alert" className="sc-error">{listError} <button className="sc-text-button" onClick={() => refreshRef.current()} type="button">다시 불러오기</button></div>}
          {!loading && !listError && records.length === 0 && <div className="sc-empty"><span aria-hidden="true">♪</span><p>아직 담아둔 소리가 없어요.</p><p>첫 번째 순간을 녹음해 보세요.</p></div>}
          <ul className="sc-record-list">{records.map((recording) => <SavedRecording key={recording.id} recording={recording} onDelete={removeRecording} />)}</ul>
        </section>
    </main>
    <footer className="sc-footer">작은 소리로 남기는, 나의 하루.</footer>
  </div>;
}
