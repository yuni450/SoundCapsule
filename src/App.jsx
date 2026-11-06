import { useState } from 'react';
import Home from './features/home/Home.jsx';
import Calendar from './features/calendar/Calendar.jsx';
import './app.css';

export default function App() {
  const [page, setPage] = useState('home');
  const [homeActivity, setHomeActivity] = useState({ hasUnsaved: false, busy: false });
  const [calendarActivity, setCalendarActivity] = useState({ hasUnsaved: false, busy: false });
  const activity = page === 'home' ? homeActivity : calendarActivity;
  const navigate = (next) => {
    if (next === page || activity.busy) return;
    if (activity.hasUnsaved && !window.confirm('저장하지 않은 녹음이나 메모가 있어요. 화면을 이동하면 사라집니다. 이동할까요?')) return;
    setHomeActivity({ hasUnsaved: false, busy: false });
    setCalendarActivity({ hasUnsaved: false, busy: false });
    setPage(next);
  };
  return <div className="sc-app">
    {page === 'home' ? <Home onActivityChange={setHomeActivity} /> : <Calendar onActivityChange={setCalendarActivity} />}
    <nav className="sc-app-nav" aria-label="주요 화면">
      <button type="button" aria-current={page === 'home' ? 'page' : undefined} onClick={() => navigate('home')} disabled={activity.busy}>홈 · 녹음</button>
      <button type="button" aria-current={page === 'calendar' ? 'page' : undefined} onClick={() => navigate('calendar')} disabled={activity.busy}>캘린더</button>
    </nav>
  </div>;
import { useEffect, useMemo, useRef, useState } from 'react';
import AuthScreen from './AuthScreen.jsx';
import { usePersistentState } from './lib/usePersistentState.js';
import FriendsHub from './features/FriendsHub.jsx';
import GroupsHub from './features/GroupsHub.jsx';
import SettingsHub from './features/SettingsHub.jsx';
import MapHub from './features/MapHub.jsx';

const baseFriends = [
  { id: 'haru.wave', name: '하루', handle: '@haru.wave', color: 'peach', status: '방금 새로운 소리를 남겼어요' },
  { id: 'min.zip', name: '민지', handle: '@min.zip', color: 'mint', status: '서울 · 2시간 전' },
  { id: 'june.sound', name: '준', handle: '@june.sound', color: 'blue', status: '부산 · 어제' },
  { id: 'sora.day', name: '소라', handle: '@sora.day', color: 'violet', status: '제주 · 3일 전' },
];
const candidates = [...baseFriends,
  { id: 'yeon.archive', name: '연우', handle: '@yeon.archive', color: 'amber', status: '파리 · 5일 전' },
  { id: 'dami.loop', name: '다미', handle: '@dami.loop', color: 'rose', status: '교토 · 1주 전' },
];
const baseGroups = [
  { id: 1, name: '여름 바다 여행', emoji: '🌊', members: ['하루', '민지', '준', '나'], preview: '민지: 파도 소리 올렸어!', time: '오후 2:18' },
  { id: 2, name: '우리들의 주말', emoji: '☀️', members: ['소라', '하루', '나'], preview: '소라: 다음 주에도 만나요', time: '어제' },
];
const recordings = [
  { title: '비 오는 창가', place: '서울 · 집', date: '2026. 11. 2', duration: '00:48' },
  { title: '한강의 늦은 오후', place: '서울 · 여의도', date: '2026. 10. 28', duration: '02:13' },
  { title: '협재 해변의 오후', place: '제주 · 협재', date: '2026. 8. 14', duration: '01:42' },
];
const baseMessages = {
  1: [
    { id: 1, sender: '민지', text: '그날 바다 소리 정리하다가 우리 생각났어 🌊', time: '오후 2:16' },
    { id: 2, sender: '민지', recording: recordings[2], time: '오후 2:18' },
    { id: 3, sender: '나', text: '파도 소리 들으니까 바로 그날로 돌아간 것 같아.', time: '오후 2:21', mine: true },
  ],
  2: [{ id: 1, sender: '소라', text: '지난 주말 공원에서 녹음한 새소리야.', time: '어제' }],
};
const nav = [{ id: 'map', label: '지도', icon: 'map' }, { id: 'friends', label: '친구', icon: 'people' }, { id: 'groups', label: '그룹', icon: 'chat' }, { id: 'settings', label: '설정', icon: 'settings' }];

function Icon({ name, size = 20 }) {
  const p = {
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2a8 8 0 0 1-3 1v3H7v-3a8 8 0 0 1-2-1l-2 2-4-4 2-2a8 8 0 0 1-1-3h-3V7h3a8 8 0 0 1 1-2l-2-2 4-4 2 2a8 8 0 0 1 2-1v-3h5v3a8 8 0 0 1 3 1l2-2 4 4-2 2a8 8 0 0 1 1 2h3v5h-3a8 8 0 0 1-1 3z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, plus: <path d="M12 5v14M5 12h14"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>,
    audio: <><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
    play: <path d="m9 7 8 5-8 5z" fill="currentColor"/>, pause: <><path d="M9 7v10M15 7v10"/></>,
    check: <path d="m5 12 4 4L19 6"/>, back: <path d="m15 18-6-6 6-6"/>,
    camera: <><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3"/></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></>,
    map: <><path d="M3 6.5 8.5 3l7 3.5L21 3v14.5L15.5 21l-7-3.5L3 21z"/><path d="M8.5 3v14.5M15.5 6.5V21"/></>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p[name]}</svg>;
}
function Avatar({ person, size = 'md' }) { const name = typeof person === 'string' ? person : person.name; return <span className={`avatar ${size} ${typeof person === 'string' ? 'blue' : person.color}`}>{name[0]}</span>; }
function Toast({ text }) { return text && <div className="toast"><Icon name="check" size={17}/>{text}</div>; }
function Empty({ children }) { return <div className="empty"><b>♪</b><span>{children}</span></div>; }

function AudioCard({ item }) {
  const [playing, setPlaying] = useState(false), [progress, setProgress] = useState(35);
  useEffect(() => { if (!playing) return; const id = setInterval(() => setProgress(v => { if (v > 95) { setPlaying(false); return 0; } return v + 3; }), 300); return () => clearInterval(id); }, [playing]);
  return <div className="audio-card"><button onClick={() => setPlaying(!playing)} aria-label={playing ? '정지' : '재생'}><Icon name={playing ? 'pause' : 'play'} size={17}/></button><div><strong>{item.title}</strong><span>{item.place} · {item.date}</span><i><em style={{ width: `${progress}%` }}/></i></div><small>{item.duration}</small></div>;
}

function Friends({ friends, setFriends, blocked, setBlocked, notify }) {
  const [query, setQuery] = useState(''), [requests, setRequests] = useState(candidates.slice(4)), [sent, setSent] = useState([]);
  const results = useMemo(() => query ? candidates.filter(x => !blocked.some(b => b.id === x.id) && `${x.name}${x.handle}`.toLowerCase().includes(query.toLowerCase())) : [], [query, blocked]);
  const accept = p => { setFriends(x => x.some(f => f.id === p.id) ? x : [...x, p]); setRequests(x => x.filter(r => r.id !== p.id)); notify(`${p.name} 님과 친구가 되었어요`); };
  return <section className="page"><Title eyebrow="함께 듣는 순간" title="친구" text="친구를 찾고 서로의 소중한 소리를 나눠보세요." badge={`친구 ${friends.length}명`}/>
    <div className="search"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="아이디 또는 이름으로 친구 찾기"/>{query && <button onClick={() => setQuery('')}>×</button>}</div>
    {query ? <Panel title="검색 결과" count={results.length}>{results.length ? results.map(p => <Person key={p.id} person={p} meta={p.handle}><button className={friends.some(f => f.id === p.id) || sent.includes(p.id) ? 'muted' : 'primary'} disabled={friends.some(f => f.id === p.id) || sent.includes(p.id)} onClick={() => { setSent(x => [...x, p.id]); notify('친구 요청을 보냈어요'); }}>{friends.some(f => f.id === p.id) ? '친구' : sent.includes(p.id) ? '요청 보냄' : '친구 추가'}</button></Person>) : <Empty>일치하는 사용자를 찾지 못했어요.</Empty>}</Panel> : <>
      {requests.length > 0 && <Panel title="받은 친구 요청" count={requests.length}>{requests.map(p => <Person key={p.id} person={p} meta="함께 아는 친구가 있어요"><span className="actions"><button className="ghost" onClick={() => setRequests(x => x.filter(r => r.id !== p.id))}>나중에</button><button className="primary" onClick={() => accept(p)}>수락</button></span></Person>)}</Panel>}
      <Panel title="내 친구"><div className="friend-grid">{friends.map(p => <article className="friend-card" key={p.id}><Avatar person={p} size="lg"/><strong>{p.name}</strong><span>{p.handle}</span><p>{p.status || '새로운 친구'}</p><button className="block-button" onClick={() => { setFriends(x => x.filter(f => f.id !== p.id)); setBlocked(x => [...x, p]); notify(`${p.name} 님을 차단했어요`); }}>차단</button></article>)}</div></Panel>
      {blocked.length > 0 && <Panel title="차단한 사용자" count={blocked.length}>{blocked.map(p => <Person key={p.id} person={p} meta="검색·친구 요청·메시지가 제한돼요"><button className="secondary" onClick={() => { setBlocked(x => x.filter(b => b.id !== p.id)); notify('차단을 해제했어요'); }}>차단 해제</button></Person>)}</Panel>}
    </>}
  </section>;
}
function Title({ eyebrow, title, text, badge }) { return <header className="title"><div><p>{eyebrow}</p><h1>{title}</h1><span>{text}</span></div>{badge && <b>{badge}</b>}</header>; }
function Panel({ title, count, children }) { return <section className="panel"><header><h2>{title}</h2>{count !== undefined && <b>{count}</b>}</header>{children}</section>; }
function Person({ person, meta, children }) { return <div className="person"><Avatar person={person}/><div><strong>{person.name}</strong><span>{meta}</span></div>{children}</div>; }

function Groups({ groups, setGroups, friends, notify }) {
  const [selected, setSelected] = useState(groups[0]?.id ?? null), [messages, setMessages] = usePersistentState('messages', baseMessages), [text, setText] = useState(''), [create, setCreate] = useState(false), [share, setShare] = useState(false);
  const channel = useRef(null);
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined;
    channel.current = new BroadcastChannel('soundcapsule-messages');
    channel.current.onmessage = (event) => {
      if (event.data?.type === 'messages') { setMessages(event.data.value); notify('다른 창에서 새 메시지가 도착했어요'); }
    };
    return () => channel.current?.close();
  }, [setMessages]);
  const [draft, setDraft] = useState({ name: '', emoji: '🎧', members: [] }); const group = groups.find(x => x.id === selected);
  const addMessage = data => setMessages(current => {
    const next = { ...current, [selected]: [...(current[selected] || []), { id: crypto.randomUUID?.() || Date.now(), sender: '나', time: '방금', mine: true, ...data }] };
    channel.current?.postMessage({ type: 'messages', value: next });
    return next;
  });
  const send = () => { if (!text.trim()) return; addMessage({ text: text.trim() }); setText(''); };
  const makeGroup = () => { if (!draft.name.trim()) return; const id = Date.now(); setGroups(x => [...x, { id, name: draft.name, emoji: draft.emoji, members: [...draft.members, '나'], preview: '새 그룹이 만들어졌어요', time: '방금' }]); setMessages(x => ({ ...x, [id]: [] })); setSelected(id); setCreate(false); setDraft({ name: '', emoji: '🎧', members: [] }); notify('새 그룹을 만들었어요'); };
  return <section className="groups">
    <aside className={group ? 'chosen' : ''}><header><Title eyebrow="우리만의 소리함" title="그룹"/><button className="round" onClick={() => setCreate(true)}><Icon name="plus"/></button></header>{groups.map(g => <button className={selected === g.id ? 'group active' : 'group'} key={g.id} onClick={() => setSelected(g.id)}><i>{g.emoji}</i><span><strong>{g.name}</strong><small>{g.preview}</small></span><em>{g.time}</em></button>)}</aside>
    {group && <main className="chat"><header><button className="back" onClick={() => setSelected(null)}><Icon name="back"/></button><i>{group.emoji}</i><div><strong>{group.name}</strong><span>멤버 {group.members.length}명 · 녹음 공유 가능</span></div></header><div className="date">2026년 11월 6일</div><div className="messages">{(messages[selected] || []).length ? (messages[selected] || []).map(m => <div className={m.mine ? 'message mine' : 'message'} key={m.id}>{!m.mine && <Avatar person={m.sender} size="sm"/>}<div>{!m.mine && <small>{m.sender}</small>}<article>{m.recording ? <AudioCard item={m.recording}/> : m.text}</article><time>{m.time}</time></div></div>) : <Empty>첫 메시지나 소리를 공유해보세요.</Empty>}</div>
      <footer><button onClick={() => setShare(!share)}><Icon name="audio"/></button><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="메시지를 입력하세요"/><button className="send" onClick={send} disabled={!text.trim()}><Icon name="send"/></button>{share && <div className="share"><strong>내 소리 공유</strong>{recordings.map(r => <button key={r.title} onClick={() => { addMessage({ recording: r }); setShare(false); notify('그룹에 소리를 공유했어요'); }}><Icon name="audio"/><span>{r.title}<small>{r.place} · {r.duration}</small></span><Icon name="plus" size={15}/></button>)}</div>}</footer>
    </main>}
    {create && <div className="backdrop" onMouseDown={() => setCreate(false)}><div className="modal" onMouseDown={e => e.stopPropagation()}><header><div><p>새로운 소리 모임</p><h2>그룹 만들기</h2></div><button onClick={() => setCreate(false)}>×</button></header><label>그룹 이름<input autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="예: 가을 제주 여행"/></label><label>그룹 아이콘<div className="emojis">{['🎧','🌊','☀️','🌿','✈️','☕'].map(e => <button className={draft.emoji === e ? 'on' : ''} key={e} onClick={() => setDraft({ ...draft, emoji: e })}>{e}</button>)}</div></label><label>친구 초대 <small>{draft.members.length}명 선택</small><div className="invite">{friends.map(f => <button key={f.id} onClick={() => setDraft({ ...draft, members: draft.members.includes(f.name) ? draft.members.filter(n => n !== f.name) : [...draft.members, f.name] })}><Avatar person={f} size="sm"/><span>{f.name}<small>{f.handle}</small></span><i className={draft.members.includes(f.name) ? 'on' : ''}>{draft.members.includes(f.name) && <Icon name="check" size={13}/>}</i></button>)}</div></label><button className="primary submit" onClick={makeGroup} disabled={!draft.name.trim()}>그룹 만들기</button></div></div>}
  </section>;
}

const settingsNav = [{ id:'profile',label:'프로필',icon:'people'},{id:'sound',label:'소리 및 녹음',icon:'mic'},{id:'alerts',label:'알림',icon:'bell'},{id:'permissions',label:'앱 권한',icon:'lock'},{id:'connections',label:'연동 서비스',icon:'link'}];
function Toggle({ value, set, label }) { return <button className={value ? 'toggle on' : 'toggle'} onClick={() => set(!value)} role="switch" aria-checked={value} aria-label={label}><i/></button>; }
function Row({ title, text, value, set, children }) { return <div className="setting-row"><div><strong>{title}</strong><span>{text}</span></div>{children || <Toggle value={value} set={set} label={title}/>}</div>; }
function Settings({ notify, currentUser, onLogout }) {
  const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';
  const [tab,setTab]=useState('profile'), [profile,setProfile]=usePersistentState(`profile:${currentUser.id}`,{name:currentUser.name,id:currentUser.id,bio:'평범한 하루의 소리를 모으고 있어요.'});
  const [sound,setSound]=usePersistentState('settings:sound',{noise:true,start:false,background:true}), [alerts,setAlerts]=usePersistentState('settings:alerts',{friend:true,group:true,message:true,memory:true,revisit:false}), [perm,setPerm]=usePersistentState('settings:permissions',{mic:false,photo:false,location:false,alert:notificationPermission==='granted'});
  const requestPermission = async (key, next) => {
    if (!next) { setPerm(current => ({ ...current, [key]: false })); return; }
    try {
      if (key === 'mic') { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); }
      if (key === 'location') await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }));
      if (key === 'alert') { if (!('Notification' in window)) throw new Error('unsupported'); const result = await Notification.requestPermission(); if (result !== 'granted') throw new Error('denied'); }
      if (key === 'photo' && 'showOpenFilePicker' in window) await window.showOpenFilePicker({ multiple: false, types: [{ description: '사진', accept: { 'image/*': ['.png','.jpg','.jpeg','.webp'] } }] });
      setPerm(current => ({ ...current, [key]: true })); notify('기기 권한을 확인했어요');
    } catch { setPerm(current => ({ ...current, [key]: false })); notify('권한이 허용되지 않았어요'); }
  };
  return <section className="settings page"><Title eyebrow="나에게 맞는 기록" title="설정" text="계정과 녹음 환경을 원하는 방식으로 관리하세요."/><div className="settings-layout"><nav>{settingsNav.map(x => <button className={tab===x.id?'active':''} onClick={()=>setTab(x.id)} key={x.id}><Icon name={x.icon} size={18}/>{x.label}</button>)}<button className="logout" onClick={onLogout}>로그아웃</button></nav><div className="settings-panel">
    {tab==='profile'&&<><SettingTitle title="프로필" text="친구에게 보이는 내 정보를 관리해요."/><div className="photo"><Avatar person={{name:profile.name,color:'coral'}} size="xl"/><button className="secondary"><Icon name="camera" size={16}/>사진 변경</button></div><div className="form-grid"><label>이름<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>아이디<input value={profile.id} onChange={e=>setProfile({...profile,id:e.target.value})}/></label></div><label>소개<textarea maxLength="80" value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})}/></label><div className="save"><button className="primary" onClick={()=>notify('프로필을 저장했어요')}>변경사항 저장</button></div></>}
    {tab==='sound'&&<><SettingTitle title="소리 및 녹음" text="내 기록에 맞는 녹음 방식을 선택해요."/><Row title="녹음 음질" text="음질이 높을수록 더 많은 저장 공간을 사용해요."><select><option>표준</option><option>높음</option><option>최고</option></select></Row><Row title="자동 노이즈 감소" text="주변의 일정한 소음을 부드럽게 줄여요." value={sound.noise} set={v=>setSound({...sound,noise:v})}/><Row title="녹음 시작·종료음" text="녹음을 시작하거나 마칠 때 소리를 재생해요." value={sound.start} set={v=>setSound({...sound,start:v})}/><Row title="백그라운드 녹음" text="다른 화면을 사용해도 녹음을 계속해요." value={sound.background} set={v=>setSound({...sound,background:v})}/><div className="storage"><span>사용 중인 저장 공간</span><b>2.4 GB / 10 GB</b><i><em/></i></div></>}
    {tab==='alerts'&&<><SettingTitle title="알림" text="놓치고 싶지 않은 순간만 알려드릴게요."/><div className="permission-banner"><div><strong>브라우저 알림</strong><span>{notificationPermission==='granted'?'이 기기에서 알림을 받을 수 있어요.':'새 메시지와 추억 알림을 받으려면 권한이 필요해요.'}</span></div><button className="secondary" onClick={()=>requestPermission('alert',true)}>{notificationPermission==='granted'?'허용됨':'알림 켜기'}</button></div>{[['friend','친구 요청','새로운 친구 요청을 받으면 알려드려요.'],['group','그룹 초대','그룹에 초대되면 알려드려요.'],['message','새 메시지','친구와 그룹의 새 메시지를 알려드려요.'],['memory','오늘의 지난 소리','같은 날짜의 기록을 다시 들려드려요.'],['revisit','장소 재방문','기록을 남긴 장소에 다시 가면 알려드려요.']].map(([k,t,d])=><Row key={k} title={t} text={d} value={alerts[k]} set={v=>setAlerts({...alerts,[k]:v})}/>)}</>}
    {tab==='permissions'&&<><SettingTitle title="앱 권한" text="버튼을 켜면 브라우저가 실제 기기 권한을 요청해요."/>{[['mic','마이크','새로운 소리를 녹음할 때 사용해요.'],['photo','사진','녹음에 추억 사진을 첨부할 때 사용해요.'],['location','위치','녹음한 장소를 지도에 기록할 때 사용해요.'],['alert','알림','친구 요청과 지난 추억을 알려드려요.']].map(([k,t,d])=><Row key={k} title={t} text={d} value={perm[k]} set={v=>requestPermission(k,v)}/>)}</>}
    {tab==='connections'&&<><SettingTitle title="연동 서비스" text="다른 앱의 추억을 소리 기록과 함께 보관해요."/><Connection emoji="🖼️" name="사진 앱" text="사진을 녹음 기록에 첨부" initial/><Connection emoji="📝" name="메모 앱" text="작성한 메모를 기록으로 가져오기"/><Connection emoji="🎵" name="음악 앱" text="그날 들었던 음악 정보 연결"/></>}
  </div></div></section>;
}
function SettingTitle({title,text}){return <header className="setting-title"><h2>{title}</h2><p>{text}</p></header>;} function Connection({emoji,name,text,initial=false}){const [on,setOn]=useState(initial);return <div className="connection"><i>{emoji}</i><div><strong>{name}</strong><span>{text}</span></div><button className={on?'muted':'secondary'} onClick={()=>setOn(!on)}>{on?'연결됨':'연결하기'}</button></div>;}

export default function App() {
  const [page,setPage]=useState('friends'),[friends,setFriends]=usePersistentState('friends',baseFriends),[blocked,setBlocked]=usePersistentState('blocked',[]),[groups,setGroups]=usePersistentState('groups',baseGroups),[users,setUsers]=usePersistentState('users',[]),[session,setSession]=usePersistentState('session',null),[toast,setToast]=useState('');
  const timer = useRef(null);
  const notify=(text,type='message')=>{const saved=localStorage.getItem('soundcapsule:settings:alerts:v2');let settings=null;try{settings=saved?JSON.parse(saved):null}catch{}const enabled=settings?.[type]!==false;const inApp=settings?.channels?.inApp!==false;if(inApp&&enabled){setToast(text);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),2500)}if(!enabled||settings?.channels?.push===false||!('Notification'in window)||Notification.permission!=='granted'||!document.hidden)return;const quiet=settings?.quiet;if(quiet?.enabled){const now=new Date().toTimeString().slice(0,5);const blocked=quiet.start<quiet.end?now>=quiet.start&&now<quiet.end:now>=quiet.start||now<quiet.end;if(blocked)return}navigator.serviceWorker?.ready.then(registration=>registration.showNotification('SoundCapsule',{body:text,icon:'/favicon.svg',tag:`soundcapsule-${type}`})).catch(()=>new Notification('SoundCapsule',{body:text}));if(settings?.vibration)navigator.vibrate?.(80)};
  if (!session) return <AuthScreen users={users} setUsers={setUsers} onLogin={(user)=>setSession({id:user.id,name:user.name,role:user.role,loginAt:new Date().toISOString()})}/>;
  return <div className="shell"><aside className="sidebar"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><nav>{nav.map(x=><button className={page===x.id?'active':''} key={x.id} onClick={()=>setPage(x.id)}><Icon name={x.icon}/>{x.label}</button>)}</nav><div className="memory"><span>오늘의 지난 소리</span><strong>작년 오늘, 성수동</strong><p>카페 창가의 빗소리</p></div><div className="me"><Avatar person={{name:session.name,color:'coral'}} size="sm"/><span><strong>{session.name}</strong><small>@{session.id}</small></span></div></aside><main className="main"><header className="mobile"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><Icon name="bell"/></header>{page==='map'&&<MapHub notify={notify}/>} {page==='friends'&&<FriendsHub friends={friends} setFriends={setFriends} blocked={blocked} setBlocked={setBlocked} notify={notify}/>} {page==='groups'&&<GroupsHub groups={groups} setGroups={setGroups} friends={friends} notify={notify} currentUser={session}/>} {page==='settings'&&<SettingsHub notify={notify} currentUser={session} onLogout={()=>setSession(null)}/>}</main><nav className="bottom">{nav.map(x=><button className={page===x.id?'active':''} key={x.id} onClick={()=>setPage(x.id)}><Icon name={x.icon}/><span>{x.label}</span></button>)}</nav><Toast text={toast}/></div>;
}
