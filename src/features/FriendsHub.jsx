import { useState } from 'react';
import { getFriendState, searchLocalUsers, requestFriend, respondToFriend, removeFriend, getFriendRecordings, setRecordingVisibility } from '../services/community.js';
import { getMonthlyPiano, subscribePianoProgress } from '../domain/piano/index.js';
import { useEffect } from 'react';
import { LocalNotice, QueryState, SharedRecordings, ShareForm, useAction, useCommunityQuery } from './community/shared.jsx';
import './community/community.css';
function FriendProfile({ friend }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; });
  const query = useCommunityQuery(async () => ({ recordings: await getFriendRecordings(friend.id), piano: await getMonthlyPiano(month, { userId: friend.id }) }), [friend.id, month]);
  useEffect(() => subscribePianoProgress(query.reload), []);
  return <section aria-label="친구 정보"><h2>{friend.name} <small>@{friend.id}</small></h2><label>피아노 조회 월<input aria-label="친구 피아노 조회 월" type="month" value={month} onChange={event => { if(event.target.value) setMonth(event.target.value); }}/></label><QueryState query={query}/>{query.data&&<><h3>월별 음표 · {query.data.piano.unlockedKeyCount ?? query.data.piano.weekdays.filter(day=>day.isUnlocked).length}/7 건반</h3><div className="community-progress">{query.data.piano.weekdays.map((day,index)=><div key={index}><span>{['월','화','수','목','금','토','일'][index]}</span><progress aria-label={`${day.label} 친구 음표 진행도`} max="4" value={day.filledSlots}/><small>{day.filledSlots}/4</small></div>)}</div><h3>친구 공개 녹음</h3><SharedRecordings recordings={query.data.recordings}/></>}</section>;
}
export default function FriendsHub() {
  const query = useCommunityQuery(getFriendState);
  const action = useAction(query.reload);
  const [search, setSearch] = useState(''), [submitted, setSubmitted] = useState(''), [selected, setSelected] = useState(null);
  const users = useCommunityQuery(() => searchLocalUsers(submitted), [submitted]);
  const friends = query.data?.friends || [];
  return <section className="friends page community-page"><header className="title"><div><p>소리로 이어지는 사이</p><h1>친구</h1></div></header><LocalNotice/><QueryState query={query}/>{action.error&&<p role="alert">{action.error}</p>}
    <div className="community-columns"><div className="community-panel"><h2>내 친구 · {friends.length}</h2>{!query.loading&&!friends.length&&<p>아직 친구가 없어요. 등록된 계정에 요청을 보내보세요.</p>}{friends.map(friend=><div className="community-row" key={friend.id}><button onClick={()=>setSelected(friend.id)}>{friend.name} · @{friend.id}</button><button disabled={action.busy} onClick={()=>{if(window.confirm('친구를 삭제할까요?')) action.run(()=>removeFriend(friend.id));}}>친구 삭제</button></div>)}
    <h3>받은 요청</h3>{!query.data?.incoming.length&&<p>받은 요청이 없어요.</p>}{query.data?.incoming.map(request=><div className="community-row" key={request.fromId}><span>{request.user.name} (@{request.fromId})</span><button disabled={action.busy} onClick={()=>action.run(()=>respondToFriend(request.fromId,true))}>수락</button><button disabled={action.busy} onClick={()=>action.run(()=>respondToFriend(request.fromId,false))}>거절</button></div>)}
    <h3>계정 찾기</h3><form className="community-form" onSubmit={event=>{event.preventDefault();setSubmitted(search);users.reload();}}><label>이름 또는 아이디<input value={search} onChange={event=>setSearch(event.target.value)}/></label><button>찾기</button></form><QueryState query={users}/>{users.data?.length===0&&<p>이 브라우저에 다른 등록 계정이 없어요.</p>}{users.data?.map(user=>{const pending=query.data?.outgoing.some(request=>request.toId===user.id);return <div className="community-row" key={user.id}><span>{user.name} (@{user.id})</span><button disabled={action.busy||pending||friends.some(friend=>friend.id===user.id)} onClick={()=>action.run(()=>requestFriend(user.id))}>{pending?'요청 보냄':'친구 요청'}</button></div>;})}</div>
    <div className="community-panel">{selected&&friends.some(friend=>friend.id===selected)?<FriendProfile key={selected} friend={friends.find(friend=>friend.id===selected)}/>:<p>친구를 선택하면 공개 녹음과 월별 음표를 볼 수 있어요.</p>}<h2>내 녹음 공개 범위</h2><ShareForm busy={action.busy} onShare={(id,privateOnly)=>action.run(()=>setRecordingVisibility(id,privateOnly?'private':'friends'))}/></div></div></section>;
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '../lib/usePersistentState.js';
import { getSharedRecordingAudio, listFriendRecordings } from '../storage/recordings.js';

const directory = [
  { id:'haru.wave',name:'하루',handle:'@haru.wave',color:'#dc9a79',place:'서울',bio:'도시의 작은 소리를 모아요.',mutual:3 },
  { id:'min.zip',name:'민지',handle:'@min.zip',color:'#77a593',place:'서울',bio:'여행과 바다, 친구들의 웃음소리.',mutual:5 },
  { id:'june.sound',name:'준',handle:'@june.sound',color:'#7995af',place:'부산',bio:'파도 소리를 가장 좋아해요.',mutual:2 },
  { id:'sora.day',name:'소라',handle:'@sora.day',color:'#9283aa',place:'제주',bio:'평범한 하루를 오래 기억하는 법.',mutual:4 },
  { id:'yeon.archive',name:'연우',handle:'@yeon.archive',color:'#c89a58',place:'파리',bio:'낯선 도시의 소리를 기록합니다.',mutual:2 },
  { id:'dami.loop',name:'다미',handle:'@dami.loop',color:'#c98284',place:'교토',bio:'비 오는 날과 오래된 카페.',mutual:1 },
];
const initialIncoming = directory.slice(4).map(person=>({...person,status:'incoming'}));

function Avatar({person,size='normal'}){return <span className={`hub-avatar ${size}`} style={{background:person.color||'#7995af'}}>{person.name[0]}</span>}
function Modal({children,onClose}){return <div className="backdrop" onMouseDown={onClose}><div className="modal hub-modal" onMouseDown={e=>e.stopPropagation()}>{children}</div></div>}

export default function FriendsHub({friends,setFriends,blocked,setBlocked,notify,currentUser}){
  const [query,setQuery]=useState('');
  const [incoming,setIncoming]=usePersistentState('friend-requests:incoming',initialIncoming);
  const [outgoing,setOutgoing]=usePersistentState('friend-requests:outgoing',[]);
  const [reports,setReports]=usePersistentState('reports',[]);
  const [preview,setPreview]=useState(null),[reporting,setReporting]=useState(null),[reason,setReason]=useState('스팸 또는 원치 않는 연락');
  const [loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
  const [sharedRecordings,setSharedRecordings]=useState([]),[sharedLoading,setSharedLoading]=useState(false),[sharedPlaying,setSharedPlaying]=useState(null);
  const sharedAudio=useRef(null);
  const online=navigator.onLine;
  const results=useMemo(()=>directory.filter(p=>!blocked.some(b=>b.id===p.id)&&`${p.name} ${p.handle}`.toLowerCase().includes(query.toLowerCase())),[query,blocked]);
  const refresh=()=>{setLoading(true);setFailed(false);setTimeout(()=>{setLoading(false);setFailed(!navigator.onLine)},550)};
  const send=p=>{setOutgoing(list=>[...list.filter(x=>x.id!==p.id),{...p,status:'pending',sentAt:new Date().toISOString()}]);notify(`${p.name} 님에게 친구 요청을 보냈어요`,'friend')};
  const accept=p=>{setIncoming(list=>list.filter(x=>x.id!==p.id));setFriends(list=>list.some(x=>x.id===p.id)?list:[...list,p]);notify(`${p.name} 님과 친구가 되었어요`,'friend')};
  const reject=p=>{setIncoming(list=>list.filter(x=>x.id!==p.id));notify('친구 요청을 거절했어요','friend')};
  const block=p=>{setFriends(list=>list.filter(x=>x.id!==p.id));setIncoming(list=>list.filter(x=>x.id!==p.id));setOutgoing(list=>list.filter(x=>x.id!==p.id));setBlocked(list=>list.some(x=>x.id===p.id)?list:[...list,p]);setPreview(null);notify(`${p.name} 님을 차단했어요`,'friend')};
  const report=()=>{setReports(list=>[...list,{id:crypto.randomUUID(),userId:reporting.id,reason,createdAt:new Date().toISOString(),status:'received'}]);setReporting(null);notify('신고가 접수됐어요','friend')};
  useEffect(()=>{let alive=true;sharedAudio.current?.stop?.();setSharedPlaying(null);if(!preview||!friends.some(friend=>friend.id===preview.id)){setSharedRecordings([]);return}setSharedLoading(true);listFriendRecordings([preview.id]).then(items=>{if(alive)setSharedRecordings(items)}).catch(()=>{if(alive)setSharedRecordings([])}).finally(()=>{if(alive)setSharedLoading(false)});return()=>{alive=false}},[preview,friends]);
  const playShared=async recording=>{sharedAudio.current?.stop?.();if(sharedPlaying===recording.id){setSharedPlaying(null);return}try{const blob=await getSharedRecordingAudio(recording.id,{userId:currentUser.id,friendIds:[preview.id]});if(!blob)throw new Error();const url=URL.createObjectURL(blob),audio=new Audio(url);const stop=()=>{audio.pause();URL.revokeObjectURL(url);setSharedPlaying(null)};sharedAudio.current={stop};audio.onended=stop;await audio.play();setSharedPlaying(recording.id)}catch{notify('공유된 녹음을 재생할 수 없어요','share')}};
  return <section className="page enhanced-page">
    <header className="title"><div><p>함께 듣는 순간</p><h1>친구</h1><span>친구를 찾고 서로의 소중한 소리를 나눠보세요. · 내 아이디 @{currentUser.id}</span></div><b>친구 {friends.length}명</b></header>
    {!online&&<div className="state-banner error"><div><strong>인터넷에 연결되지 않았어요</strong><span>저장된 친구 목록은 계속 볼 수 있어요.</span></div><button onClick={()=>location.reload()}>다시 시도</button></div>}
    <div className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="아이디 또는 이름으로 친구 찾기"/><button onClick={()=>{setQuery('');refresh()}}>↻</button></div>
    {loading?<div className="skeleton-list">{[1,2,3].map(x=><i key={x}/>)}</div>:failed?<div className="empty-action"><b>검색 결과를 불러오지 못했어요.</b><button className="secondary" onClick={refresh}>다시 시도</button></div>:query&&<HubPanel title="검색 결과" count={results.length}>{results.length?results.map(p=>{const isFriend=friends.some(x=>x.id===p.id),sent=outgoing.some(x=>x.id===p.id);return <Person key={p.id} person={p} onPreview={()=>setPreview(p)}><button className={isFriend||sent?'muted':'primary'} disabled={isFriend||sent} onClick={()=>send(p)}>{isFriend?'친구':sent?'요청 보냄':'친구 추가'}</button></Person>}):<Empty text="일치하는 사용자가 없어요."/>}</HubPanel>}
    {!query&&<>
      {incoming.length>0&&<HubPanel title="받은 요청" count={incoming.length}>{incoming.map(p=><Person key={p.id} person={p} meta={`함께 아는 친구 ${p.mutual}명`} onPreview={()=>setPreview(p)}><div className="hub-actions"><button className="danger-ghost" onClick={()=>reject(p)}>거절</button><button className="primary" onClick={()=>accept(p)}>수락</button></div></Person>)}</HubPanel>}
      {outgoing.length>0&&<HubPanel title="보낸 요청" count={outgoing.length}>{outgoing.map(p=><Person key={p.id} person={p} meta="상대방의 수락을 기다리는 중" onPreview={()=>setPreview(p)}><button className="secondary" onClick={()=>{setOutgoing(list=>list.filter(x=>x.id!==p.id));notify('친구 요청을 취소했어요','friend')}}>요청 취소</button></Person>)}</HubPanel>}
      <HubPanel title="내 친구">{friends.length?<div className="friend-grid">{friends.map(p=><article className="friend-card" key={p.id}><button className="avatar-button" onClick={()=>setPreview(directory.find(x=>x.id===p.id)||p)}><Avatar person={{...p,color:p.color?.startsWith?.('#')?p.color:'#7995af'}} size="large"/></button><strong>{p.name}</strong><span>{p.handle}</span><p>{p.status||'새로운 친구'}</p><div className="card-actions"><button onClick={()=>setReporting(p)}>신고</button><button onClick={()=>block(p)}>차단</button></div></article>)}</div>:<Empty text="아직 친구가 없어요. 아이디로 친구를 찾아보세요."/>}</HubPanel>
      {blocked.length>0&&<HubPanel title="차단한 사용자" count={blocked.length}>{blocked.map(p=><Person key={p.id} person={p} meta="요청과 메시지가 제한됩니다"><button className="secondary" onClick={()=>setBlocked(list=>list.filter(x=>x.id!==p.id))}>차단 해제</button></Person>)}</HubPanel>}
    </>}
    {preview&&<Modal onClose={()=>setPreview(null)}><header className="profile-preview"><Avatar person={preview} size="xlarge"/><div><h2>{preview.name}</h2><span>{preview.handle}</span></div><button onClick={()=>setPreview(null)}>×</button></header><p className="profile-bio">{preview.bio||'소리로 하루를 기록하고 있어요.'}</p><dl><div><dt>최근 기록</dt><dd>{preview.place||'서울'} · 3일 전</dd></div><div><dt>함께 아는 친구</dt><dd>{preview.mutual||0}명</dd></div></dl>{friends.some(friend=>friend.id===preview.id)&&<section className="friend-shared-sounds"><h3>친구 공개 소리</h3>{sharedLoading?<p>불러오는 중…</p>:sharedRecordings.length?sharedRecordings.map(recording=><button key={recording.id} type="button" onClick={()=>playShared(recording)}><span>{sharedPlaying===recording.id?'Ⅱ':'▶'}</span><div><strong>{recording.title}</strong><small>{new Date(recording.savedAt||recording.recordedAt).toLocaleDateString('ko-KR')}</small></div></button>):<p>공개한 소리가 아직 없어요.</p>}</section>}<div className="profile-actions"><button className="secondary" onClick={()=>setReporting(preview)}>신고</button><button className="danger" onClick={()=>block(preview)}>차단</button></div></Modal>}
    {reporting&&<Modal onClose={()=>setReporting(null)}><header className="modal-simple"><div><p>안전한 커뮤니티</p><h2>{reporting.name} 님 신고</h2></div><button onClick={()=>setReporting(null)}>×</button></header><label>신고 사유<select value={reason} onChange={e=>setReason(e.target.value)}><option>스팸 또는 원치 않는 연락</option><option>괴롭힘 또는 혐오 표현</option><option>부적절한 콘텐츠</option><option>다른 사람 사칭</option></select></label><p className="policy-note">신고 내용은 검토를 위해 저장되며 상대방에게 신고자 정보가 공개되지 않습니다.</p><button className="danger submit" onClick={report}>신고 제출</button></Modal>}
  </section>
}
