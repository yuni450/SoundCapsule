import { useRef, useState } from 'react';
import AuthScreen from './AuthScreen.jsx';
import { usePersistentState } from './lib/usePersistentState.js';
import Home from './features/home/Home.jsx';
import Calendar from './features/calendar/Calendar.jsx';
import MapHub from './features/MapHub.jsx';
import FriendsHub from './features/FriendsHub.jsx';
import GroupsHub from './features/GroupsHub.jsx';
import SettingsHub from './features/SettingsHub.jsx';
import PianoHub from './features/PianoHub.jsx';

const localSession = { id:'local.user',name:'나',role:'member',local:true };
const bypassAuth = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';
const initialSession = bypassAuth ? localSession : null;
const nav = [
  { id:'home',label:'홈 · 녹음',shortLabel:'홈',icon:'home' },
  { id:'calendar',label:'캘린더',shortLabel:'캘린더',icon:'calendar' },
  { id:'map',label:'지도',shortLabel:'지도',icon:'map' },
  { id:'piano',label:'🎵 음표',shortLabel:'음표',icon:'music' },
  { id:'friends',label:'친구',shortLabel:'친구',icon:'people' },
  { id:'settings',label:'설정',shortLabel:'설정',icon:'settings' },
];

function Icon({ name, size = 20 }) {
  const paths = {
    home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    map:<><path d="M3 6.5 8.5 3l7 3.5L21 3v14.5L15.5 21l-7-3.5L3 21z"/><path d="M8.5 3v14.5M15.5 6.5V21"/></>,
    people:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    chat:<><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2a8 8 0 0 1-3 1v3H7v-3a8 8 0 0 1-2-1l-2 2-4-4 2-2a8 8 0 0 1-1-3h-3V7h3a8 8 0 0 1 1-2l-2-2 4-4 2 2a8 8 0 0 1 2-1v-3h5v3a8 8 0 0 1 3 1l2-2 4 4-2 2a8 8 0 0 1 1 2h3v5h-3a8 8 0 0 1-1 3z"/></>,
    music:<><path d="M10 18V5l10-2v13M10 8l10-2"/><ellipse cx="7" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Toast({ text }) {
  return text ? <div className="toast" role="status"><Icon name="check" size={17}/>{text}</div> : null;
}

function Avatar({ name }) {
  return <span className="avatar sm coral">{name?.[0] || '나'}</span>;
}

export default function App() {
  const [page,setPage]=useState('home');
  const [homeActivity,setHomeActivity]=useState({hasUnsaved:false,busy:false});
  const [calendarActivity,setCalendarActivity]=useState({hasUnsaved:false,busy:false});
  const [users,setUsers]=usePersistentState('users',[]);
  const [session,setSession]=usePersistentState('session',initialSession);
  const [toast,setToast]=useState('');
  const timer=useRef(null);
  const activity=page==='home'?homeActivity:page==='calendar'?calendarActivity:{hasUnsaved:false,busy:false};

  const navigate=(next)=>{
    if(next===page||activity.busy)return;
    if(activity.hasUnsaved&&!window.confirm('저장하지 않은 녹음이나 메모가 있어요. 화면을 이동하면 사라집니다. 이동할까요?'))return;
    setHomeActivity({hasUnsaved:false,busy:false});
    setCalendarActivity({hasUnsaved:false,busy:false});
    setPage(next);
  };

  const notify=(text,type='message')=>{
    const saved=localStorage.getItem(`soundcapsule:settings:alerts:v2:${session?.id}`);
    let settings=null;
    try{settings=saved?JSON.parse(saved):null}catch{}
    const enabled=settings?.[type]!==false;
    const inApp=settings?.channels?.inApp!==false;
    if(inApp&&enabled){setToast(text);clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),2500)}
    if(!enabled||settings?.channels?.push===false||!('Notification'in window)||Notification.permission!=='granted'||!document.hidden)return;
    const quiet=settings?.quiet;
    if(quiet?.enabled){const time=new Date().toTimeString().slice(0,5);const muted=quiet.start<quiet.end?time>=quiet.start&&time<quiet.end:time>=quiet.start||time<quiet.end;if(muted)return}
    navigator.serviceWorker?.ready.then(registration=>registration.showNotification('SoundCapsule',{body:text,icon:'/favicon.svg',tag:`soundcapsule-${type}`})).catch(()=>new Notification('SoundCapsule',{body:text}));
    if(settings?.vibration)navigator.vibrate?.(80);
  };

  if(!session||(session.local&&!bypassAuth))return <AuthScreen users={users} setUsers={setUsers} onLogin={user=>{setSession({id:user.id,name:user.name,role:user.role,loginAt:new Date().toISOString()});setPage('home')}}/>;

  const content={
    home:<Home key={session.id} onActivityChange={setHomeActivity}/>,
    calendar:<Calendar key={session.id} onActivityChange={setCalendarActivity}/>,
    map:<MapHub notify={notify}/>,
    piano:<PianoHub key={session.id} userId={session.local?undefined:session.id}/>,
    friends:<FriendsHub key={session.id} currentUser={session}/>,
    groups:<GroupsHub key={session.id} currentUser={session}/>,
    settings:<SettingsHub key={session.id} notify={notify} currentUser={session} onLogout={()=>setSession(null)}/>,
  };

  return <div className="shell merged-shell">
    <aside className="sidebar"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><nav>{nav.map(item=><button type="button" className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} disabled={activity.busy} key={item.id} onClick={()=>navigate(item.id)}><Icon name={item.icon}/>{item.label}</button>)}</nav><button type="button" className="group-entry" aria-label="그룹 열기" aria-current={page==='groups'?'page':undefined} disabled={activity.busy} onClick={()=>navigate('groups')}><Icon name="chat"/>그룹 열기</button><div className="memory"><span>오늘의 지난 소리</span><strong>작년 오늘, 성수동</strong><p>카페 창가의 빗소리</p></div><div className="me"><Avatar name={session.name}/><span><strong>{session.name}</strong><small>@{session.id}</small></span></div></aside>
    <main className="main"><header className="mobile"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><button type="button" className="group-entry" aria-label="그룹 열기" disabled={activity.busy} onClick={()=>navigate('groups')}>그룹</button><Icon name="bell"/></header>{content[page]}</main>
    <nav className="bottom" aria-label="주요 화면">{nav.map(item=><button type="button" aria-label={item.label} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} disabled={activity.busy} key={item.id} onClick={()=>navigate(item.id)}><Icon name={item.icon}/><span aria-hidden="true">{item.shortLabel}</span></button>)}</nav>
    <Toast text={toast}/>
  </div>;
}
