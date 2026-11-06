import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../lib/usePersistentState.js';
import GoogleKoreaMap from './GoogleKoreaMap.jsx';

const now = new Date().toISOString();
const seedRecordings = [
  { id:'map-1',userId:'demo',title:'협재의 느린 파도',audioUrl:'demo://waves',recordedAt:'2026-08-14T07:20:00.000Z',duration:102,location:{name:'제주 협재해수욕장',latitude:33.3947,longitude:126.2397},photoUrls:[],memo:'바람이 잔잔했던 오후',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'대한민국',city:'제주',mood:'waves' },
  { id:'map-2',userId:'demo',title:'성수동 빗소리',audioUrl:'demo://rain',recordedAt:'2025-11-06T05:10:00.000Z',duration:48,location:{name:'서울 성수동',latitude:37.5446,longitude:127.0558},photoUrls:[],memo:'카페 창가에 떨어지는 비',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'대한민국',city:'서울',mood:'rain' },
  { id:'map-3',userId:'demo',title:'한강의 늦은 오후',audioUrl:'demo://river',recordedAt:'2026-10-28T08:40:00.000Z',duration:133,location:{name:'서울 여의도 한강공원',latitude:37.5285,longitude:126.9348},photoUrls:[],memo:'자전거 벨과 강바람',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'대한민국',city:'서울',mood:'river' },
  { id:'map-4',userId:'demo',title:'해운대의 여름밤',audioUrl:'demo://night',recordedAt:'2026-07-22T12:30:00.000Z',duration:89,location:{name:'부산 해운대',latitude:35.1587,longitude:129.1604},photoUrls:[],memo:'멀리서 들리던 버스킹',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'대한민국',city:'부산',mood:'night' },
  { id:'map-5',userId:'demo',title:'교토 골목의 아침',audioUrl:'demo://birds',recordedAt:'2026-04-03T22:15:00.000Z',duration:76,location:{name:'일본 교토 기온',latitude:35.0037,longitude:135.7788},photoUrls:[],memo:'자전거와 참새 소리',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'일본',city:'교토',mood:'birds' },
  { id:'map-6',userId:'demo',title:'센강변의 저녁',audioUrl:'demo://city',recordedAt:'2025-09-18T17:05:00.000Z',duration:118,location:{name:'프랑스 파리 센강',latitude:48.8584,longitude:2.2945},photoUrls:[],memo:'강 위로 지나가던 유람선',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'프랑스',city:'파리',mood:'city' },
  { id:'map-7',userId:'demo',title:'브루클린의 새벽',audioUrl:'demo://city',recordedAt:'2024-12-21T10:42:00.000Z',duration:95,location:{name:'미국 뉴욕 브루클린',latitude:40.6782,longitude:-73.9442},photoUrls:[],memo:'첫 지하철이 지나가던 시간',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'미국',city:'뉴욕',mood:'city' },
  { id:'map-8',userId:'demo',title:'본다이의 아침 파도',audioUrl:'demo://waves',recordedAt:'2024-03-09T20:12:00.000Z',duration:141,location:{name:'호주 시드니 본다이',latitude:-33.8915,longitude:151.2767},photoUrls:[],memo:'서퍼들이 바다로 들어가던 아침',visibility:'private',groupId:null,createdAt:now,updatedAt:now,region:'호주',city:'시드니',mood:'waves' },
];

function validLocation(recording){const {latitude,longitude}=recording.location||{};return Number.isFinite(latitude)&&Number.isFinite(longitude)}
function haversine(a,b){const rad=value=>value*Math.PI/180;const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);const value=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value))}
function elapsedLabel(date){const days=Math.max(1,Math.floor((Date.now()-new Date(date).getTime())/86400000));if(days<30)return`${days}일`;const months=Math.floor(days/30);if(months<12)return`${months}개월`;const years=Math.floor(months/12);return`${years}년`}
function durationLabel(seconds=0){return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`}

export default function MapHub({notify}){
  const [allRecordings]=usePersistentState('recordings',seedRecordings);
  const recordings=useMemo(()=>allRecordings.filter(validLocation),[allRecordings]);
  const koreaRecordings=useMemo(()=>recordings.filter(item=>item.region==='대한민국'),[recordings]);
  const [query,setQuery]=useState(''),[region,setRegion]=useState('전체'),[view,setView]=useState('map'),[selectedPlace,setSelectedPlace]=useState(null),[playing,setPlaying]=useState(null);
  const [locationState,setLocationState]=useState({status:'idle',position:null,nearest:null}),[revisit,setRevisit]=useState(null),[radius,setRadius]=usePersistentState('settings:revisit-radius',1);
  const audio=useRef(null);
  const regions=useMemo(()=>['전체',...new Set(koreaRecordings.map(item=>item.city||'기타'))],[koreaRecordings]);
  const filtered=useMemo(()=>koreaRecordings.filter(item=>{const text=`${item.title} ${item.location.name} ${item.city||''}`.toLowerCase();return(region==='전체'||item.city===region)&&text.includes(query.toLowerCase())}),[koreaRecordings,region,query]);
  const places=useMemo(()=>{const groups=new Map();filtered.forEach(item=>{const key=`${item.location.latitude.toFixed(3)}:${item.location.longitude.toFixed(3)}`;if(!groups.has(key))groups.set(key,{key,name:item.location.name,latitude:item.location.latitude,longitude:item.location.longitude,region:item.region,city:item.city,recordings:[]});groups.get(key).recordings.push(item)});return[...groups.values()]},[filtered]);
  const selected=places.find(place=>place.key===selectedPlace)||null;

  useEffect(()=>()=>{audio.current?.stop?.()},[]);
  useEffect(()=>{navigator.permissions?.query?.({name:'geolocation'}).then(result=>{if(result.state==='granted')checkCurrentLocation(false)}).catch(()=>{})},[]);

  const focusPlace=place=>setSelectedPlace(place.key);

  async function playRecording(recording){
    audio.current?.stop?.();
    if(playing===recording.id){setPlaying(null);return}
    if(recording.audioUrl&&!recording.audioUrl.startsWith('demo://')){const element=new Audio(recording.audioUrl);audio.current={stop:()=>{element.pause();element.currentTime=0}};element.onended=()=>setPlaying(null);await element.play().catch(()=>notify('오디오 파일을 재생할 수 없어요'));setPlaying(recording.id);return}
    const context=new AudioContext();const gain=context.createGain();gain.gain.value=.035;gain.connect(context.destination);const oscillator=context.createOscillator();oscillator.type=recording.mood==='rain'?'sawtooth':'sine';oscillator.frequency.value=recording.mood==='waves'?174:recording.mood==='birds'?620:220;oscillator.connect(gain);oscillator.start();const timer=setTimeout(()=>{oscillator.stop();context.close();setPlaying(null)},6000);audio.current={stop:()=>{clearTimeout(timer);try{oscillator.stop()}catch{}context.close();setPlaying(null)}};setPlaying(recording.id)
  }

  function checkCurrentLocation(prompt=true){
    if(!navigator.geolocation){setLocationState({status:'error',message:'이 브라우저는 위치 기능을 지원하지 않아요.'});return}
    setLocationState(state=>({...state,status:'loading'}));
    navigator.geolocation.getCurrentPosition(position=>{
      const current={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};
      const ranked=koreaRecordings.map(item=>({recording:item,distance:haversine(current,item.location)})).sort((a,b)=>a.distance-b.distance);const nearest=ranked[0]||null;
      setLocationState({status:'ready',position:current,nearest});localStorage.setItem('soundcapsule:last-location-check',JSON.stringify({checkedAt:new Date().toISOString(),...current}));
      if(nearest&&nearest.distance<=radius){const result={...nearest,elapsed:elapsedLabel(nearest.recording.recordedAt)};setRevisit(result);showRevisitNotification(result)}else{setRevisit(null);if(prompt)notify(nearest?`가장 가까운 기록까지 ${nearest.distance.toFixed(1)}km 남았어요`:'위치가 있는 기록이 아직 없어요','revisit')}
    },error=>setLocationState({status:'error',message:error.code===1?'위치 권한이 필요해요. 브라우저 설정에서 허용해 주세요.':'현재 위치를 확인하지 못했어요.'}),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }

  async function showRevisitNotification(result){
    notify(`${result.elapsed} 전에 이곳을 방문했어요. 그날의 소리를 다시 들어볼까요?`,'revisit');
    if(!('Notification'in window)||Notification.permission!=='granted')return;
    const registration=await navigator.serviceWorker?.ready.catch(()=>null);registration?.showNotification('다시 만난 장소',{body:`${result.elapsed} 전 · ${result.recording.location.name}`,icon:'/favicon.svg',tag:`revisit-${result.recording.id}`,data:{url:'/'}})
  }

  const previewRevisit=()=>{const recording=selected?.recordings[0]||koreaRecordings[0];if(!recording)return;const result={recording,distance:0,elapsed:elapsedLabel(recording.recordedAt)};setRevisit(result);showRevisitNotification(result)};

  return <section className="map-page">
    <header className="map-topbar"><div><p>소리로 기억하는 장소</p><h1>나의 소리 지도</h1><span>{koreaRecordings.length}개의 국내 기록 · {new Set(koreaRecordings.map(item=>item.city)).size}개 지역</span></div><div className="map-actions"><button className="location-button" onClick={()=>checkCurrentLocation(true)} disabled={locationState.status==='loading'}>{locationState.status==='loading'?'위치 확인 중…':'⌖ 현재 위치 확인'}</button><div className="view-switch"><button className={view==='map'?'active':''} onClick={()=>setView('map')}>대한민국 지도</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}>장소 목록</button></div></div></header>
    {revisit&&<div className="revisit-banner"><span className="revisit-icon">⌖</span><div><small>다시 만난 장소</small><strong>{revisit.elapsed} 전에 이곳을 방문했어요.</strong><p>{revisit.recording.location.name} · 그날의 소리를 다시 들어볼까요?</p></div><button onClick={()=>playRecording(revisit.recording)}>{playing===revisit.recording.id?'멈추기':'다시 듣기'}</button><button className="banner-close" onClick={()=>setRevisit(null)}>×</button></div>}
    {locationState.status==='error'&&<div className="map-error"><span>{locationState.message}</span><button onClick={()=>checkCurrentLocation(true)}>다시 시도</button></div>}
    <div className="map-toolbar"><div className="map-search"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="장소, 도시, 녹음 제목 검색"/>{query&&<button onClick={()=>setQuery('')}>×</button>}</div><div className="region-chips">{regions.map(item=><button key={item} className={region===item?'active':''} onClick={()=>{setRegion(item);setSelectedPlace(null);setView('map')}}>{item}</button>)}</div></div>
    {view==='map'?<div className="map-workspace google-map-workspace"><GoogleKoreaMap places={places} selectedPlace={selectedPlace} onSelect={focusPlace} currentPosition={locationState.position}/><PlacePanel place={selected} recordings={filtered} playing={playing} onPlay={playRecording} onSelect={focusPlace} onPreviewRevisit={previewRevisit}/></div>:<PlaceList places={places} selected={selected} onSelect={focusPlace} playing={playing} onPlay={playRecording}/>} 
    <div className="revisit-settings"><div><strong>재방문 알림 거리</strong><span>기록한 장소에 가까워지면 알려드려요.</span></div><select value={radius} onChange={event=>setRadius(Number(event.target.value))}><option value=".5">500m 이내</option><option value="1">1km 이내</option><option value="3">3km 이내</option><option value="5">5km 이내</option></select><button className="secondary" onClick={previewRevisit}>알림 미리보기</button></div>
  </section>
}

function PlacePanel({place,recordings,playing,onPlay,onSelect,onPreviewRevisit}){
  if(!place)return <aside className="place-panel empty-panel"><div className="panel-orbit">◎</div><h2>장소를 선택해 주세요</h2><p>지도 위의 마커를 누르면 그곳에서 남긴 소리를 바로 들을 수 있어요.</p><div className="recent-places"><strong>최근 기록한 장소</strong>{recordings.slice(0,3).map(item=><button key={item.id} onClick={()=>onSelect({key:`${item.location.latitude.toFixed(3)}:${item.location.longitude.toFixed(3)}`,name:item.location.name,latitude:item.location.latitude,longitude:item.location.longitude,recordings:[item]})}><span>{item.city?.slice(0,1)||'⌖'}</span><div><b>{item.location.name}</b><small>{new Date(item.recordedAt).toLocaleDateString('ko-KR')}</small></div></button>)}</div></aside>;
  return <aside className="place-panel"><header><span className="place-pin">⌖</span><div><small>{place.region} · {place.city}</small><h2>{place.name}</h2><p>기록 {place.recordings.length}개</p></div></header><div className="place-recordings">{place.recordings.map(item=><RecordingCard key={item.id} item={item} active={playing===item.id} onPlay={()=>onPlay(item)}/>)}</div><button className="revisit-preview" onClick={onPreviewRevisit}>이 장소의 재방문 알림 미리보기</button></aside>
}
function RecordingCard({item,active,onPlay}){return <article className={`map-recording-card ${active?'playing':''}`}><button onClick={onPlay}>{active?'Ⅱ':'▶'}</button><div><strong>{item.title}</strong><span>{new Date(item.recordedAt).toLocaleDateString('ko-KR')} · {durationLabel(item.duration)}</span><i><em/></i>{item.memo&&<p>{item.memo}</p>}</div></article>}
function PlaceList({places,selected,onSelect,playing,onPlay}){return <div className="place-list-view">{places.length?places.map(place=><article key={place.key} className={selected?.key===place.key?'selected':''}><button className="place-list-heading" onClick={()=>onSelect(place)}><span>⌖</span><div><small>{place.region} · {place.city}</small><strong>{place.name}</strong></div><b>{place.recordings.length}</b></button><div>{place.recordings.map(item=><RecordingCard key={item.id} item={item} active={playing===item.id} onPlay={()=>onPlay(item)}/>)}</div></article>):<div className="no-places">조건에 맞는 장소 기록이 없어요.</div>}</div>}
