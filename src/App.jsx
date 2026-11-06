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
}
