import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../lib/usePersistentState.js';
import { getRecordingAudio, listRecordings, subscribeRecordings, updateRecordingLocation } from '../storage/recordings.js';
import GoogleKoreaMap from './GoogleKoreaMap.jsx';
import LocationPicker from './location/LocationPicker.jsx';

function validLocation(recording){const {latitude,longitude}=recording.location||{};return Number.isFinite(latitude)&&Number.isFinite(longitude)}
function haversine(a,b){const rad=value=>value*Math.PI/180;const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);const value=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))}
function elapsedLabel(date){const days=Math.max(1,Math.floor((Date.now()-new Date(date).getTime())/86400000));if(days<30)return`${days}일`;const months=Math.floor(days/30);if(months<12)return`${months}개월`;return`${Math.floor(months/12)}년`}
function durationLabel(seconds=0){return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`}
function revisitEnabled(){try{return JSON.parse(localStorage.getItem('soundcapsule:settings:alerts:v2')||'{}').revisit!==false}catch{return true}}

export default function MapHub({notify}){
  const [recordings,setRecordings]=useState([]),[ready,setReady]=useState(false);
  const [query,setQuery]=useState(''),[submittedSearch,setSubmittedSearch]=useState(''),[region,setRegion]=useState('전체'),[view,setView]=useState('map');
  const [selectedPlace,setSelectedPlace]=useState(null),[playing,setPlaying]=useState(null),[editing,setEditing]=useState(null);
  const [locationState,setLocationState]=useState({status:'idle',position:null}),[revisit,setRevisit]=useState(null),[radius,setRadius]=usePersistentState('settings:revisit-radius',1);
  const audio=useRef(null);
  const located=useMemo(()=>recordings.filter(validLocation).map(item=>({...item,region:item.location.country||item.region||'국가 미지정',city:item.location.city||item.city||item.location.name.split(/\s+/)[0]||'기타'})),[recordings]);
  const regions=useMemo(()=>['전체',...new Set(located.map(item=>item.region))],[located]);
  const filtered=useMemo(()=>located.filter(item=>{const text=`${item.title} ${item.location.name} ${item.region} ${item.city}`.toLowerCase();return(region==='전체'||item.region===region)&&text.includes(query.trim().toLowerCase())}),[located,region,query]);
  const places=useMemo(()=>{const groups=new Map();filtered.forEach(item=>{const key=`${item.location.latitude.toFixed(4)}:${item.location.longitude.toFixed(4)}`;if(!groups.has(key))groups.set(key,{key,name:item.location.name||'이름 없는 장소',latitude:item.location.latitude,longitude:item.location.longitude,region:item.region,city:item.city,recordings:[]});groups.get(key).recordings.push(item)});return[...groups.values()]},[filtered]);
  const selected=places.find(place=>place.key===selectedPlace)||null;

  useEffect(()=>{let alive=true;const load=()=>listRecordings().then(items=>{if(alive){setRecordings(items);setReady(true)}}).catch(()=>{if(alive)setReady(true)});load();const unsubscribe=subscribeRecordings(load);return()=>{alive=false;unsubscribe();audio.current?.stop?.()}},[]);
  useEffect(()=>{const params=new URLSearchParams(location.search),id=params.get('openRecording');if(!id||!located.length)return;const recording=located.find(item=>item.id===id);if(!recording)return;setRegion('전체');setQuery('');setView('map');setSelectedPlace(`${recording.location.latitude.toFixed(4)}:${recording.location.longitude.toFixed(4)}`);setRevisit({recording,distance:0,elapsed:elapsedLabel(recording.savedAt||recording.recordedAt)});if(params.get('autoplay')==='1')playRecording(recording);history.replaceState({},'',location.pathname)},[located]);
  useEffect(()=>{if(!located.length||!revisitEnabled()||!navigator.geolocation)return;let watchId;let cancelled=false;navigator.permissions?.query?.({name:'geolocation'}).then(permission=>{if(cancelled||permission.state!=='granted')return;watchId=navigator.geolocation.watchPosition(({coords})=>handlePosition({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy},false),()=>{}, {enableHighAccuracy:false,maximumAge:120000,timeout:15000})}).catch(()=>{});return()=>{cancelled=true;if(watchId!==undefined)navigator.geolocation.clearWatch(watchId)}},[located,radius]);

  async function playRecording(recording){
    audio.current?.stop?.();if(playing===recording.id){setPlaying(null);return}
    const blob=await getRecordingAudio(recording.id).catch(()=>null);if(!blob){notify('저장된 오디오 파일을 찾을 수 없어요');return}
    const url=URL.createObjectURL(blob),element=new Audio(url);const stop=()=>{element.pause();element.removeAttribute('src');element.load();URL.revokeObjectURL(url);setPlaying(null)};audio.current={stop};element.onended=stop;try{await element.play();setPlaying(recording.id)}catch{stop();notify('오디오 파일을 재생할 수 없어요')}
  }
  function handlePosition(current,prompt=true){
    const ranked=located.map(recording=>({recording,distance:haversine(current,recording.location)})).sort((a,b)=>a.distance-b.distance),nearest=ranked[0]||null;
    setLocationState({status:'ready',position:current,nearest});localStorage.setItem('soundcapsule:last-location-check',JSON.stringify({checkedAt:new Date().toISOString(),...current}));
    if(nearest&&nearest.distance<=radius){const result={...nearest,elapsed:elapsedLabel(nearest.recording.savedAt||nearest.recording.recordedAt)};setRevisit(result);const key=`soundcapsule:revisit:${nearest.recording.id}`;const last=Number(localStorage.getItem(key)||0);if(Date.now()-last>86400000){localStorage.setItem(key,String(Date.now()));showRevisitNotification(result)}}
    else{setRevisit(null);if(prompt)notify(nearest?`가장 가까운 기록까지 ${nearest.distance.toFixed(1)}km 남았어요`:'위치가 있는 기록이 아직 없어요','revisit')}
  }
  function checkCurrentLocation(){
    if(!navigator.geolocation){setLocationState({status:'error',message:'이 브라우저는 위치 기능을 지원하지 않아요.'});return}setLocationState(state=>({...state,status:'loading'}));
    navigator.geolocation.getCurrentPosition(({coords})=>handlePosition({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy}),error=>setLocationState({status:'error',message:error.code===1?'위치 권한이 필요해요. 브라우저 설정에서 허용해 주세요.':'현재 위치를 확인하지 못했어요.'}),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  async function showRevisitNotification(result){
    notify(`${result.elapsed} 전에 이곳을 방문했어요. 그날의 소리를 다시 들어볼까요?`,'revisit');if(!('Notification'in window)||Notification.permission!=='granted')return;
    const registration=await navigator.serviceWorker?.ready.catch(()=>null);registration?.showNotification('다시 만난 장소',{body:`${result.elapsed} 전 · ${result.recording.location.name}`,icon:'/favicon.svg',tag:`revisit-${result.recording.id}`,data:{url:`/?openRecording=${encodeURIComponent(result.recording.id)}&source=revisit&autoplay=1`,recordingId:result.recording.id}})
  }
  const previewRevisit=()=>{const recording=selected?.recordings[0]||located[0];if(!recording)return;const result={recording,distance:0,elapsed:elapsedLabel(recording.savedAt||recording.recordedAt)};setRevisit(result);showRevisitNotification(result)};
  const saveLocation=async locationValue=>{try{await updateRecordingLocation(editing.id,locationValue);setEditing(null);notify('녹음 위치를 수정했어요')}catch(error){notify(error.message||'위치를 수정하지 못했어요')}};
  const removeLocation=async recording=>{if(!confirm('이 녹음의 위치를 지도에서 제거할까요?'))return;try{await updateRecordingLocation(recording.id,{name:recording.location.name,latitude:null,longitude:null,country:'',city:''});setSelectedPlace(null);notify('지도에서 위치를 제거했어요')}catch(error){notify(error.message||'위치를 제거하지 못했어요')}};

  return <section className="map-page">
    <header className="map-topbar"><div><p>소리로 기억하는 장소</p><h1>나의 소리 지도</h1><span>{!ready?'기록을 불러오는 중…':located.length?`${located.length}개의 위치 기록 · ${regions.length-1}개 국가`:'위치를 추가한 녹음이 아직 없어요'}</span></div><div className="map-actions"><button className="location-button" onClick={checkCurrentLocation} disabled={locationState.status==='loading'}>{locationState.status==='loading'?'위치 확인 중…':'⌖ 현재 위치 확인'}</button><div className="view-switch"><button className={view==='map'?'active':''} onClick={()=>setView('map')}>세계 지도</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}>장소 목록</button></div></div></header>
    {revisit&&<div className="revisit-banner"><span className="revisit-icon">⌖</span><div><small>다시 만난 장소</small><strong>{revisit.elapsed} 전에 이곳을 방문했어요.</strong><p>{revisit.recording.location.name} · 그날의 소리를 다시 들어볼까요?</p></div><button onClick={()=>playRecording(revisit.recording)}>{playing===revisit.recording.id?'멈추기':'다시 듣기'}</button><button className="banner-close" onClick={()=>setRevisit(null)}>×</button></div>}
    {locationState.status==='error'&&<div className="map-error"><span>{locationState.message}</span><button onClick={checkCurrentLocation}>다시 시도</button></div>}
    <div className="map-toolbar"><form className="map-search" onSubmit={event=>{event.preventDefault();setSubmittedSearch(query.trim());setView('map')}}><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="장소, 도시, 녹음 제목 검색"/><button type="submit">이동</button>{query&&<button type="button" onClick={()=>{setQuery('');setSubmittedSearch('')}}>×</button>}</form><div className="region-chips">{regions.map(item=><button key={item} className={region===item?'active':''} onClick={()=>{setRegion(item);setSelectedPlace(null);setView('map')}}>{item}</button>)}</div></div>
    {view==='map'
      ? <div className="map-workspace google-map-workspace"><GoogleKoreaMap places={places} selectedPlace={selectedPlace} onSelect={place=>setSelectedPlace(place.key)} currentPosition={locationState.position} searchRequest={submittedSearch}/><PlacePanel place={selected} recordings={filtered} ready={ready} playing={playing} onPlay={playRecording} onSelect={place=>setSelectedPlace(place.key)} onPreviewRevisit={previewRevisit} onEdit={setEditing} onRemove={removeLocation}/></div>
      : <PlaceList places={places} selected={selected} onSelect={place=>setSelectedPlace(place.key)} playing={playing} onPlay={playRecording} onEdit={setEditing} onRemove={removeLocation}/>}
    <div className="revisit-settings"><div><strong>재방문 알림 거리</strong><span>웹사이트가 열려 있는 동안 가까워지면 알려드려요.</span></div><select value={radius} onChange={event=>setRadius(Number(event.target.value))}><option value=".5">500m 이내</option><option value="1">1km 이내</option><option value="3">3km 이내</option><option value="5">5km 이내</option></select><button className="secondary" onClick={previewRevisit} disabled={!located.length}>알림 미리보기</button></div>
    {editing&&<LocationPicker initial={editing.location} onCancel={()=>setEditing(null)} onConfirm={saveLocation}/>}
  </section>
}

function PlacePanel({place,recordings,ready,playing,onPlay,onSelect,onPreviewRevisit,onEdit,onRemove}){
  if(!place&&!recordings.length)return <aside className="place-panel empty-panel"><div className="panel-orbit">◎</div><h2>{ready?'아직 지도에 남긴 소리가 없어요':'장소 기록을 불러오는 중…'}</h2><p>{ready?'홈에서 녹음을 저장할 때 위치를 추가하면 지도 위에 마커가 나타납니다.':'잠시만 기다려 주세요.'}</p></aside>;
  if(!place)return <aside className="place-panel empty-panel"><div className="panel-orbit">◎</div><h2>장소를 선택해 주세요</h2><p>지도 위의 마커를 누르면 그곳에서 남긴 소리를 바로 들을 수 있어요.</p><div className="recent-places"><strong>최근 기록한 장소</strong>{recordings.slice(0,3).map(item=><button key={item.id} onClick={()=>onSelect({key:`${item.location.latitude.toFixed(4)}:${item.location.longitude.toFixed(4)}`})}><span>{item.city?.slice(0,1)||'⌖'}</span><div><b>{item.location.name}</b><small>{new Date(item.savedAt||item.recordedAt).toLocaleDateString('ko-KR')}</small></div></button>)}</div></aside>;
  return <aside className="place-panel"><header><span className="place-pin">⌖</span><div><small>{place.region} · {place.city}</small><h2>{place.name}</h2><p>기록 {place.recordings.length}개</p></div></header><div className="place-recordings">{place.recordings.map(item=><RecordingCard key={item.id} item={item} active={playing===item.id} onPlay={()=>onPlay(item)} onEdit={()=>onEdit(item)} onRemove={()=>onRemove(item)}/>)}</div><button className="revisit-preview" onClick={onPreviewRevisit}>이 장소의 재방문 알림 미리보기</button></aside>
}
function RecordingCard({item,active,onPlay,onEdit,onRemove}){return <article className={`map-recording-card ${active?'playing':''}`}><button onClick={onPlay}>{active?'Ⅱ':'▶'}</button><div><strong>{item.title}</strong><span>{new Date(item.savedAt||item.recordedAt).toLocaleDateString('ko-KR')} · {durationLabel(item.duration)}</span><i><em/></i>{item.memo&&<p>{item.memo}</p>}<div className="map-card-actions"><a href="#edit-location" onClick={event=>{event.preventDefault();onEdit()}}>위치 수정</a><a href="#remove-location" onClick={event=>{event.preventDefault();onRemove()}}>위치 제거</a></div></div></article>}
function PlaceList({places,selected,onSelect,playing,onPlay,onEdit,onRemove}){return <div className="place-list-view">{places.length?places.map(place=><article key={place.key} className={selected?.key===place.key?'selected':''}><button className="place-list-heading" onClick={()=>onSelect(place)}><span>⌖</span><div><small>{place.region} · {place.city}</small><strong>{place.name}</strong></div><b>{place.recordings.length}</b></button><div>{place.recordings.map(item=><RecordingCard key={item.id} item={item} active={playing===item.id} onPlay={()=>onPlay(item)} onEdit={()=>onEdit(item)} onRemove={()=>onRemove(item)}/>)}</div></article>):<div className="no-places">조건에 맞는 장소 기록이 없어요.</div>}</div>}
