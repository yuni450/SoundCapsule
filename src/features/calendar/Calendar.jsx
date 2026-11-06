import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listRecordings, subscribeRecordings } from '../../storage/recordings.js';
import { groupByLocalDate, localDateKey, monthCells } from './calendarDates.js';
import RecordingDetails from './RecordingDetails.jsx';
import RecordingComposer from '../home/RecordingComposer.jsx';
import './calendar.css';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export default function Calendar({ onActivityChange }) {
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [selected, setSelected] = useState(() => localDateKey(new Date()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reloadRef = useRef(() => {});
  const activity = useRef(new Map());
  const [recorderActivity, setRecorderActivity] = useState({ hasUnsaved: false, busy: false });
  const updateActivity = useCallback((id, state) => {
    if (state) activity.current.set(id, state);
    else activity.current.delete(id);
    const values = [...activity.current.values()];
    onActivityChange?.({ hasUnsaved: values.some((value) => value.dirty), busy: values.some((value) => value.busy) });
  }, [onActivityChange]);
  const updateRecorderActivity = useCallback((state) => {
    setRecorderActivity(state);
    updateActivity('calendar-recorder', { dirty: state.hasUnsaved, busy: state.busy });
  }, [updateActivity]);
  const onRecorded = (recording) => {
    // 선택된 칸이나 저장 시각이 아니라 실제 녹음 시작 시각으로 이동합니다.
    const date = new Date(recording.recordedAt);
    setSelected(localDateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  };
  const groups = useMemo(() => groupByLocalDate(recordings), [recordings]);
  const cells = monthCells(month.getFullYear(), month.getMonth());
  const selectedRecords = groups.get(selected) ?? [];
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  useEffect(() => {
    let alive = true;
    let request = 0;
    const load = async () => {
      setToday(localDateKey(new Date()));
      const current = ++request;
      setLoading(true); setError('');
      try {
        const data = await listRecordings();
        if (alive && current === request) setRecordings(data);
      } catch {
        if (alive && current === request) setError('녹음을 불러오지 못했어요. 다시 시도해 주세요.');
      } finally {
        if (alive && current === request) setLoading(false);
      }
    };
    reloadRef.current = load;
    load();
    const unsubscribe = subscribeRecordings(load);
    const timer = setInterval(() => setToday(localDateKey(new Date())), 1000);
    return () => { alive = false; request++; unsubscribe(); clearInterval(timer); };
  }, []);

  const choose = (date) => {
    if (localDateKey(date) === selected) return true;
    // 목록을 바꾸기 전에 저장하지 않은 메모를 확인합니다.
    const states = [...activity.current.values()];
    if (states.some((value) => value.busy)) return false;
    const dirty = states.some((value) => value.dirty);
    if (dirty && !window.confirm('저장하지 않은 녹음이나 메모가 있어요. 다른 날짜로 이동할까요?')) return false;
    setRecorderActivity({ hasUnsaved: false, busy: false });
    setSelected(localDateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    return true;
  };
  const moveMonth = (offset) => choose(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12));

  return <div className="sc-calendar">
    <header className="sc-cal-header"><span>SoundCapsule ✳</span><span>나의 소리 달력</span></header>
    <main className="sc-cal-main">
      <section className="sc-cal-panel" aria-labelledby="calendar-title">
        <p className="sc-cal-eyebrow">MEMORIES, ONE DAY AT A TIME</p>
        <h1 id="calendar-title">소리로 돌아보는 하루</h1><p className="sc-cal-muted">날짜를 골라 그날의 기억을 꺼내보세요.</p>
        <div className="sc-cal-month"><button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button><h2 aria-live="polite">{month.getFullYear()}년 {month.getMonth() + 1}월</h2><button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button></div>
        <div className="sc-cal-tools"><span><i className="sc-cal-dot" /> 녹음한 날</span><button type="button" onClick={() => choose(new Date())}>오늘</button></div>
        <table className="sc-cal-grid" aria-label={`${month.getFullYear()}년 ${month.getMonth() + 1}월 달력`}>
          <thead><tr>{weekdays.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
          <tbody>{Array.from({ length: cells.length / 7 }, (_, row) => <tr key={row}>{cells.slice(row * 7, row * 7 + 7).map((date, column) => {
            if (!date) return <td key={column} />;
            const key = localDateKey(date);
            const count = groups.get(key)?.length ?? 0;
            return <td key={column}><button type="button" aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일${count ? `, 녹음 ${count}개` : ', 녹음 없음'}`} aria-pressed={selected === key} aria-current={today === key ? 'date' : undefined} className={`${today === key ? 'is-today' : ''} ${selected === key ? 'is-selected' : ''}`} onClick={() => { if (key !== selected) choose(date); }}><span>{date.getDate()}</span>{count > 0 && <i className="sc-cal-dot" aria-hidden="true" />}</button></td>;
          })}</tr>)}</tbody>
        </table>
      </section>
      <section className="sc-cal-day" aria-labelledby="selected-date-title">
        <div className="sc-cal-day-heading"><h2 id="selected-date-title">{selectedLabel}</h2><span>{selectedRecords.length}개의 소리</span></div>
        {(selected === today || recorderActivity.hasUnsaved) ? <>
          {selected !== today && <p className="sc-cal-midnight" role="status">날짜가 바뀌었어요. 진행 중인 녹음은 시작한 날짜에 저장됩니다. 새 녹음은 오늘 날짜에서 시작해 주세요.</p>}
          <RecordingComposer key={selected} compact onActivityChange={updateRecorderActivity} onSaved={onRecorded}
            canStart={() => selected === localDateKey(new Date())} startDisabled={selected !== today} />
        </> : <p className="sc-cal-muted">{selected < today ? '이날의 소리는 다시 꺼내 들을 수 있어요.' : '새로운 소리는 오늘 날짜에서만 담을 수 있어요.'}</p>}
        {loading && <p role="status">기억을 불러오는 중…</p>}
        {error && <div role="alert" className="sc-cal-error">{error} <button type="button" onClick={() => reloadRef.current()}>다시 불러오기</button></div>}
        {!loading && !error && !selectedRecords.length && <div className="sc-cal-empty"><span aria-hidden="true">♪</span><p>이날은 담아둔 소리가 없어요.</p><p>{selected === today ? '위에서 지금의 소리를 남겨보세요.' : '새 녹음은 오늘 날짜에서만 남길 수 있어요.'}</p></div>}
        <ul className="sc-cal-records">{selectedRecords.map((recording) => <RecordingDetails key={recording.id} recording={recording} onActivityChange={updateActivity} />)}</ul>
      </section>
    </main>
  </div>;
}
