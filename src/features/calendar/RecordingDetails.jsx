import { useEffect, useRef, useState } from 'react';
import AudioPlayer from '../home/AudioPlayer.jsx';
import { addRecordingPhotos, cancelRecordingShare, deleteRecordingPhoto, getRecordingAudio, getRecordingPhoto, updateRecordingLocation, updateRecordingMemo, updateRecordingSharing } from '../../storage/recordings.js';
import LocationPicker from '../location/LocationPicker.jsx';

function Photo({ url, busy, onDelete }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let objectUrl;
    setSource(''); setError('');
    if (/^https?:\/\//.test(url)) { setSource(url); return; }
    getRecordingPhoto(url).then((blob) => {
      if (!alive) return;
      if (!blob) throw new Error();
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (alive) setError('사진을 불러오지 못했어요.'); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <li className="sc-cal-photo">
    {source && !error ? <a href={source} target="_blank" rel="noreferrer" aria-label="첨부 사진 크게 보기"><img src={source} alt="녹음에 첨부한 사진" onError={() => setError('이 사진 형식은 미리 보기를 지원하지 않아요.')} /></a>
      : <p role={error ? 'alert' : 'status'}>{error || '사진을 불러오는 중…'}</p>}
    <button type="button" disabled={busy} onClick={onDelete}>사진 삭제</button>
  </li>;
}

export default function RecordingDetails({ recording, onActivityChange,groups=[] }) {
  const [memo, setMemo] = useState(recording.memo);
  const [dirty, setDirty] = useState(false);
  const [blob, setBlob] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [sharing,setSharing]=useState({visibility:recording.visibility,groupId:recording.groupId||''});
  const lock = useRef(false);
  const mounted = useRef(true);
  const fileInput = useRef(null);
  const memoSource = useRef(recording.memo);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const changed = memoSource.current !== recording.memo;
    memoSource.current = recording.memo;
    // 저장 직후 dirty만 바뀐 경우에는 재조회 전의 오래된 props로 덮어쓰지 않습니다.
    if (changed && !dirty) setMemo(recording.memo);
  }, [recording.memo, dirty]);
  useEffect(()=>setSharing({visibility:recording.visibility,groupId:recording.groupId||''}),[recording.visibility,recording.groupId]);
  useEffect(() => {
    onActivityChange(recording.id, { dirty, busy });
  }, [recording.id, dirty, busy, onActivityChange]);
  useEffect(() => () => onActivityChange(recording.id, null), [recording.id, onActivityChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const change = async (action, message, memoSaved = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const updated = await action();
      if (mounted.current) {
        if (memoSaved) { setMemo(updated.memo); setDirty(false); }
        setNotice(message);
      }
    } catch (cause) {
      if (mounted.current) setError(cause.name === 'QuotaExceededError'
        ? '저장 공간이 부족해요. 공간을 확보하고 다시 시도해 주세요.'
        : (cause.message || '변경 사항을 저장하지 못했어요. 다시 시도해 주세요.'));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const loadAudio = async () => {
    setLoadingAudio(true); setError('');
    try {
      const audio = await getRecordingAudio(recording.id);
      if (!audio) throw new Error();
      if (mounted.current) setBlob(audio);
    } catch {
      if (mounted.current) setError('녹음을 불러오지 못했어요. 다시 시도해 주세요.');
    } finally { if (mounted.current) setLoadingAudio(false); }
  };
  return <li className="sc-cal-record">
    <div className="sc-cal-record-heading"><h3>{recording.title}</h3><time dateTime={recording.savedAt || recording.recordedAt}>{new Date(recording.savedAt || recording.recordedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div>
    <div className="sc-cal-location-row">
      <p className="sc-cal-muted">{recording.location.name || '장소 이름 없음'}{Number.isFinite(recording.location.latitude) ? ` · 지도 위치 저장됨` : ' · 지도 위치 없음'}</p>
      <div><button className="sc-cal-text" type="button" disabled={busy} onClick={() => setLocationPickerOpen(true)}>위치 {Number.isFinite(recording.location.latitude) ? '수정' : '추가'}</button>{Number.isFinite(recording.location.latitude) && <button className="sc-cal-text" type="button" disabled={busy} onClick={() => { if (window.confirm('이 녹음의 지도 위치를 제거할까요?')) change(() => updateRecordingLocation(recording.id, { name: recording.location.name, latitude: null, longitude: null, country: '', city: '' }), '지도 위치를 제거했어요.'); }}>위치 제거</button>}</div>
    </div>
    {blob ? <AudioPlayer blob={blob} label={`${recording.title} 재생`} />
      : <button className="sc-cal-text" type="button" disabled={loadingAudio} onClick={loadAudio}>{loadingAudio ? '불러오는 중…' : '녹음 듣기'}</button>}
    <form onSubmit={(event) => { event.preventDefault(); change(() => updateRecordingMemo(recording.id, memo), '메모를 저장했어요.', true); }}>
      <label htmlFor={`memo-${recording.id}`}>이 순간의 메모</label>
      <textarea id={`memo-${recording.id}`} value={memo} maxLength={500} rows={3} disabled={busy} onChange={(event) => { setMemo(event.target.value); setDirty(true); setNotice(''); }} placeholder="이날의 기억을 남겨보세요" />
      <div className="sc-cal-memo-actions"><span>{memo.length}/500{dirty ? ' · 저장 전' : ''}</span><button type="submit" disabled={busy || !dirty}>메모 저장</button></div>
    </form>
    <section className="sc-cal-sharing"><h4>공유 관리</h4><div><select aria-label={`${recording.title} 공개 범위`} value={sharing.visibility} disabled={busy} onChange={event=>setSharing({...sharing,visibility:event.target.value})}><option value="private">나만 보기</option><option value="friends">친구 공개</option><option value="group">그룹 공개</option></select>{sharing.visibility==='group'&&<select aria-label={`${recording.title} 공개 그룹`} value={sharing.groupId} disabled={busy} onChange={event=>setSharing({...sharing,groupId:event.target.value})}><option value="">그룹 선택</option>{groups.map(group=><option key={group.id} value={String(group.id)}>{group.name}</option>)}</select>}<button type="button" disabled={busy||sharing.visibility==='group'&&!sharing.groupId} onClick={()=>change(()=>updateRecordingSharing(recording.id,sharing),'공개 범위를 변경했어요.')}>변경 저장</button>{recording.visibility!=='private'&&<button type="button" disabled={busy} onClick={()=>change(()=>cancelRecordingShare(recording.id),'공유를 취소했어요.')}>공유 취소</button>}</div><p className="sc-cal-muted">현재 상태 · {recording.visibility==='private'?'나만 보기':recording.visibility==='friends'?'친구 공개':`그룹 공개 (${groups.find(group=>String(group.id)===recording.groupId)?.name||recording.groupId})`}</p></section>
    <div className="sc-cal-photos-heading"><h4>함께 담은 사진</h4><button className="sc-cal-text" type="button" disabled={busy} onClick={() => fileInput.current.click()}>사진 추가</button></div>
    <input ref={fileInput} className="sc-cal-file" type="file" accept="image/*" multiple aria-label={`${recording.title} 사진 선택`} disabled={busy} onChange={(event) => {
      const files = [...event.target.files]; event.target.value = '';
      if (files.length) change(() => addRecordingPhotos(recording.id, files), '사진을 저장했어요.');
    }} />
    <p className="sc-cal-muted">사진당 10MB 이하 · 사진을 누르면 크게 볼 수 있어요.</p>
    {recording.photoUrls.length ? <ul className="sc-cal-photos">{recording.photoUrls.map((url) => <Photo key={url} url={url} busy={busy} onDelete={() => {
      if (window.confirm('이 사진을 삭제하시겠습니까?')) change(() => deleteRecordingPhoto(recording.id, url), '사진을 삭제했어요.');
    }} />)}</ul> : <p className="sc-cal-muted">아직 첨부한 사진이 없어요.</p>}
    {busy && <p role="status">저장 중…</p>}
    {notice && <p role="status" className="sc-cal-notice">{notice}</p>}
    {error && <p role="alert" className="sc-cal-error">{error}</p>}
    {locationPickerOpen && <LocationPicker initial={recording.location} onCancel={() => setLocationPickerOpen(false)} onConfirm={(location) => { setLocationPickerOpen(false); change(() => updateRecordingLocation(recording.id, location), '위치를 저장했어요.'); }} />}
  </li>;
}
