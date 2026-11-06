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
}
