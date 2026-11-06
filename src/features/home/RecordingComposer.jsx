import { useEffect, useRef, useState } from 'react';
import { saveRecording } from '../../storage/recordings.js';
import { readStored } from '../../lib/usePersistentState.js';
import LocationPicker from '../location/LocationPicker.jsx';
import { reverseGeocode } from '../googleMapsLoader.js';
import { useAudioRecorder } from './useAudioRecorder.js';
import AudioPlayer from './AudioPlayer.jsx';
import { formatDuration } from './formatDuration.js';
import './home.css';

// DEMO ONLY: 시연이 끝나면 demoBackdate 상태와 sc-demo-date 블록, demoSavedAt 전달을 함께 제거합니다.
function toLocalDateTimeInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function RecordingComposer({ compact = false, canStart, startDisabled = false, onActivityChange, onSaved,groups=[] }) {
  const recorder = useAudioRecorder({ canStart });
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [includeLocation, setIncludeLocation] = useState(false);
  const [coordinates, setCoordinates] = useState({ latitude: '', longitude: '' });
  const [locationStatus, setLocationStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationDetails,setLocationDetails]=useState({country:'',city:''});
  const [pickerOpen,setPickerOpen]=useState(false);
  const initialSound=readStored('settings:sound:v2',{});
  const [visibility,setVisibility]=useState(()=>['private','friends','group'].includes(initialSound.visibility)?initialSound.visibility:'private');
  const [groupId,setGroupId]=useState(()=>String(initialSound.defaultGroupId||groups[0]?.id||''));
  const [memo, setMemo] = useState('');
  const [demoBackdate,setDemoBackdate]=useState(false);
  const [demoDateTime,setDemoDateTime]=useState(()=>toLocalDateTimeInput(new Date(Date.now()-7*24*60*60*1000)));
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
      const latitude = includeLocation ? Number(coordinates.latitude) : null;
      const longitude = includeLocation ? Number(coordinates.longitude) : null;
      if (includeLocation && (!coordinates.latitude.trim() || !coordinates.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180)) {
        setSaveError('지도에 표시할 위치를 확인해 주세요.');
        return;
      }
      if(visibility==='group'&&!groupId){setSaveError('공개할 그룹을 선택해 주세요.');return}
      let demoSavedAt=null;
      if(demoBackdate){
        const selected=new Date(demoDateTime);
        if(!demoDateTime||Number.isNaN(selected.getTime())){setSaveError('시연용 기록 날짜와 시간을 확인해 주세요.');return}
        if(selected.getTime()>Date.now()){setSaveError('시연용 기록은 현재보다 과거 시각만 선택할 수 있어요.');return}
        demoSavedAt=selected.toISOString();
      }
      const saved = await saveRecording({ ...recorder.draft, recordedAt:demoSavedAt||recorder.draft.recordedAt, demoSavedAt, title, locationName, latitude, longitude, country:locationDetails.country,city:locationDetails.city,memo,visibility,groupId:visibility==='group'?groupId:null });
      recorder.reset();
      setTitle(''); setLocationName(''); setMemo(''); setIncludeLocation(false); setCoordinates({ latitude:'',longitude:'' }); setLocationDetails({country:'',city:''});setLocationStatus('');setDemoBackdate(false);
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

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('이 브라우저는 위치 기능을 지원하지 않아요.'); return; }
    setLocating(true); setLocationStatus('현재 위치를 확인하고 있어요…');
    navigator.geolocation.getCurrentPosition(async({ coords }) => {
      setCoordinates({ latitude:coords.latitude.toFixed(6), longitude:coords.longitude.toFixed(6) });
      try{const place=await reverseGeocode(coords.latitude,coords.longitude);setLocationName(current=>current.trim()?current:place.address);setLocationDetails({country:place.country,city:place.city});setLocationStatus(`현재 위치를 추가했어요 · 장소명·국가·도시 확인 완료 · 정확도 약 ${Math.round(coords.accuracy)}m`)}catch{setLocationStatus(`현재 위치를 추가했어요 · 장소명은 직접 입력해 주세요 · 정확도 약 ${Math.round(coords.accuracy)}m`)}
      setLocating(false);
    }, (error) => {
      setLocationStatus(error.code === 1 ? '위치 권한을 허용해 주세요.' : '현재 위치를 확인하지 못했어요.');
      setLocating(false);
    }, { enableHighAccuracy:true,timeout:10000,maximumAge:60000 });
  };
  const resolveCoordinates=async()=>{const latitude=Number(coordinates.latitude),longitude=Number(coordinates.longitude);setLocating(true);setLocationStatus('좌표의 장소명을 찾고 있어요…');try{const place=await reverseGeocode(latitude,longitude);setLocationName(place.address);setLocationDetails({country:place.country,city:place.city});setLocationStatus('좌표에서 장소명·국가·도시를 찾았어요.')}catch(error){setLocationStatus(error.message)}finally{setLocating(false)}};

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
                <div className="sc-demo-date">
                  <label className="sc-location-toggle"><input type="checkbox" checked={demoBackdate} onChange={(event)=>setDemoBackdate(event.target.checked)}/><span>시연용 과거 날짜 지정</span><em>DEMO</em></label>
                  {demoBackdate&&<><label htmlFor="recording-demo-date">기록 날짜와 시간 <span>시연 종료 후 삭제 예정</span></label><input id="recording-demo-date" type="datetime-local" value={demoDateTime} max={toLocalDateTimeInput(new Date())} onChange={event=>setDemoDateTime(event.target.value)} required/><p>선택한 날짜가 캘린더와 음표 진행도에 반영돼요.</p></>}
                </div>
                <label htmlFor="recording-place">장소 <span>선택</span></label>
                <input id="recording-place" value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="이 소리를 만난 곳" maxLength={200} />
                <label className="sc-location-toggle"><input type="checkbox" checked={includeLocation} onChange={(event)=>{setIncludeLocation(event.target.checked);setLocationStatus('')}}/><span>지도에 위치 표시</span></label>
                {includeLocation&&<div className="sc-location-box">
                  <div className="sc-location-actions"><button className="sc-secondary" type="button" onClick={()=>setPickerOpen(true)}>지도에서 선택</button><button className="sc-secondary" type="button" onClick={useCurrentLocation} disabled={locating}>{locating?'위치 확인 중…':'현재 위치 사용'}</button><button className="sc-secondary" type="button" onClick={resolveCoordinates} disabled={locating||!coordinates.latitude||!coordinates.longitude}>좌표로 장소 찾기</button></div>
                  <div className="sc-coordinate-grid"><label htmlFor="recording-latitude">위도<input id="recording-latitude" inputMode="decimal" value={coordinates.latitude} onChange={(event)=>setCoordinates({...coordinates,latitude:event.target.value})} placeholder="37.5665"/></label><label htmlFor="recording-longitude">경도<input id="recording-longitude" inputMode="decimal" value={coordinates.longitude} onChange={(event)=>setCoordinates({...coordinates,longitude:event.target.value})} placeholder="126.9780"/></label></div>
                  {locationStatus&&<p className="sc-location-status" role="status">{locationStatus}</p>}
                </div>}
                <label htmlFor="recording-visibility">공개 범위</label><select id="recording-visibility" value={visibility} onChange={event=>setVisibility(event.target.value)}><option value="private">나만 보기</option><option value="friends">친구에게 공개</option><option value="group">그룹 공개</option></select>
                {visibility==='group'&&<><label htmlFor="recording-group">공개할 그룹</label><select id="recording-group" value={groupId} onChange={event=>setGroupId(event.target.value)} required><option value="">그룹 선택</option>{groups.map(group=><option key={group.id} value={String(group.id)}>{group.name}</option>)}</select></>}
                <label htmlFor="recording-memo">메모 <span>선택</span></label>
                <textarea id="recording-memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 순간의 기분을 남겨보세요" maxLength={500} rows={3} />
                <div className="sc-actions"><button className="sc-secondary" type="button" onClick={retry} disabled={startDisabled}>다시 녹음하기</button><button className="sc-primary" type="submit">{saving ? '저장 중…' : '소리 저장하기'}</button></div>
              </fieldset>
              {saveError && <p className="sc-error" role="alert">{saveError}</p>}
            </form>
          )}
        </section>
        {pickerOpen&&<LocationPicker initial={{name:locationName,latitude:coordinates.latitude===''?null:Number(coordinates.latitude),longitude:coordinates.longitude===''?null:Number(coordinates.longitude),...locationDetails}} onCancel={()=>setPickerOpen(false)} onConfirm={location=>{setLocationName(location.name);setCoordinates({latitude:String(location.latitude),longitude:String(location.longitude)});setLocationDetails({country:location.country,city:location.city});setIncludeLocation(true);setLocationStatus('지도에서 위치를 선택했어요.');setPickerOpen(false)}}/>}
  </div>;
}
