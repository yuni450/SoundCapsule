import { useEffect, useRef, useState } from 'react';
import { subscribeCommunity } from '../../services/community.js';
import { getRecordingAudio, listRecordings, subscribeRecordings } from '../../storage/recordings.js';
import AudioPlayer from '../home/AudioPlayer.jsx';
export function useCommunityQuery(load, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(value => value + 1);
  useEffect(() => subscribeCommunity(reload), []);
  useEffect(() => subscribeRecordings(reload), []);
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: '' });
    Promise.resolve().then(load).then(data => { if (alive) setState({ loading: false, data, error: '' }); }, error => { if (alive) setState({ loading: false, data: null, error: error.message }); });
    return () => { alive = false; };
  }, [...deps, revision]);
  return { ...state, reload };
}
export function useAction(reload) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async task => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await task(); reload(); } catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return { run, busy, error };
}
export function QueryState({ query }) {
  return query.loading ? <p role="status">불러오는 중…</p> : query.error ? <div role="alert"><p>{query.error}</p><button onClick={query.reload}>다시 시도</button></div> : null;
}
export function LocalNotice() {
  return <p className="community-notice">이 브라우저에 등록된 계정 사이에서만 사용할 수 있어요. 서버 인증·다른 기기와의 공유·실시간 원격 연결은 지원하지 않습니다.</p>;
}
function SharedAudio({ recording }) {
  const query = useCommunityQuery(() => getRecordingAudio(recording.id), [recording.id, recording.updatedAt]);
  return <article className="community-record"><strong>{recording.title}</strong><p>{new Date(recording.recordedAt).toLocaleString()} · {recording.location?.name || '장소 없음'}</p><p>{recording.memo}</p><QueryState query={query}/>{query.data && <AudioPlayer blob={query.data} label={`${recording.title} 재생`}/>}</article>;
}
export function SharedRecordings({ recordings }) {
  return recordings.length ? <div>{recordings.map(recording => <SharedAudio key={recording.id} recording={recording}/>)}</div> : <p>공유된 녹음이 없어요.</p>;
}
export function ShareForm({ onShare, busy, group = false }) {
  const own = useCommunityQuery(listRecordings);
  const [id, setId] = useState('');
  return <form className="community-form" onSubmit={event => { event.preventDefault(); if (id) onShare(id); }}><label>내 녹음 선택<select value={id} onChange={event => setId(event.target.value)}><option value="">녹음을 선택하세요</option>{own.data?.map(recording => <option key={recording.id} value={recording.id}>{recording.title} ({recording.visibility})</option>)}</select></label><button disabled={busy || !id}>{group ? '이 그룹에 공유' : '친구에게 공유'}</button><button type="button" disabled={busy || !id} onClick={() => onShare(id, true)}>나만 보기로 변경</button><QueryState query={own}/><small>공개 범위를 바꾸며, 녹음 파일은 복제하지 않아요.</small></form>;
}
