import { useEffect, useRef, useState } from 'react';
import { getMonthlyPiano, PIANO_KEYS, subscribePianoProgress } from '../domain/piano/index.js';
import { currentLocalMonth, lockedKeyMessage, monthLabel, PIANO_TONES, shiftMonth } from './piano/presentation.js';
import { usePianoAudio } from './piano/usePianoAudio.js';
import './piano/piano.css';

export default function PianoHub({ userId }) {
  const [currentMonth, setCurrentMonth] = useState(() => currentLocalMonth());
  const [month, setMonth] = useState(() => currentLocalMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState({ id: 0, text: '' });
  const owner = useRef(userId);
  const reload = useRef(() => {});
  const audio = usePianoAudio(userId);
  const latest = useRef(null);
  const future = month > currentMonth;
  const matchesOwner = !userId || data?.userId === userId;
  const visible = data?.yearMonth === month && matchesOwner && !future ? data : null;

  useEffect(() => { audio.stopAll(); }, [userId, audio.stopAll]);

  useEffect(() => {
    const tick = () => setCurrentMonth(currentLocalMonth());
    const timer = setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => {
    let alive = true, request = 0;
    owner.current = userId;
    const load = async () => {
      const current = ++request; setLoading(true); setError('');
      try {
        const next = await getMonthlyPiano(month, { userId });
        if (alive && current === request) { owner.current = next.userId; setData(next); }
      } catch {
        if (alive && current === request) { setData(null); setError('음표 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); }
      } finally { if (alive && current === request) setLoading(false); }
    };
    reload.current = load; load();
    const unsubscribe = subscribePianoProgress(change => {
      if ((!owner.current || change.userId === owner.current) && change.yearMonth === month) load();
    });
    const visibleAgain = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', load); window.addEventListener('online', load);
    document.addEventListener('visibilitychange', visibleAgain);
    return () => {
      alive = false; request++; unsubscribe();
      window.removeEventListener('focus', load); window.removeEventListener('online', load);
      document.removeEventListener('visibilitychange', visibleAgain);
    };
  }, [month, userId]);

  const activate = (index) => {
    if (loading || error || data?.yearMonth !== month) return;
    const key = { ...PIANO_KEYS[index], uniqueDateCount: visible?.weekdays[index].uniqueDateCount ?? 0 };
    if (!visible?.weekdays[index].isUnlocked) {
      setNotice(previous => ({ id: previous.id + 1, text: lockedKeyMessage(key, month, currentMonth) }));
      return;
    }
    setNotice(previous => ({ ...previous, text: '' })); audio.play(index + 1);
  };
  latest.current = activate;
  useEffect(() => {
    const keydown = (event) => {
      if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const index = PIANO_TONES.findIndex(tone => tone.code === event.code);
      if (index >= 0) { event.preventDefault(); latest.current?.(index); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  const navigate = (next) => {
    if (next === month) return;
    audio.stopAll(); setData(null); setNotice(previous => ({ ...previous, text: '' })); setMonth(next);
  };
  const recovery = data?.yearMonth === month && matchesOwner ? data.recovery : null;
  return <section className="piano-page" aria-labelledby="piano-title">
    <header className="piano-heading"><div><p className="piano-eyebrow">LITTLE SOUNDS, SEVEN COLORS</p><h1 id="piano-title">🎵 나의 음표</h1><p>하루의 소리가 모여, 나만의 멜로디가 돼요.</p></div><span className="piano-page-mark" aria-hidden="true">♬</span></header>
    <div className="piano-month-controls">
      <button type="button" aria-label="이전 달 음표" disabled={month === '0001-01'} onClick={() => navigate(shiftMonth(month, -1))}>‹</button>
      <h2 aria-live="polite">{monthLabel(month)}</h2>
      <button type="button" aria-label="다음 달 음표" disabled={month === '9999-12'} onClick={() => navigate(shiftMonth(month, 1))}>›</button>
      <button type="button" className="piano-today" onClick={() => navigate(currentMonth)}>현재 달</button>
    </div>
    <div className="piano-summary"><span>이번 달 열린 건반</span><strong>{loading ? '—' : visible?.unlockedKeyCount ?? 0}<small>/7</small></strong><p>같은 요일에 2일 기록하면 연주할 수 있어요.</p></div>
    {future && <p className="piano-info">아직 오지 않은 달이에요. 새 기록은 현재 달에서 남길 수 있어요.</p>}
    {loading && <p role="status" className="piano-info">음표 기록을 불러오는 중…</p>}
    {error && <div role="alert" className="piano-error">{error}<button type="button" onClick={() => reload.current()}>다시 시도</button></div>}
    {recovery && (recovery.unresolved.length > 0 || recovery.pending > 0) && <div className="piano-recovery" role="status">
      {recovery.unresolved.length > 0 && <p>저장 완료 날짜를 확인할 수 없는 기록 {recovery.unresolved.length}개가 있어 복구 확인이 필요해요. 날짜를 임의로 추정하지 않았어요.</p>}
      {recovery.pending > 0 && <p>녹음은 저장됐지만 음표 반영을 기다리는 기록이 {recovery.pending}개 있어요.</p>}
      <button type="button" disabled={loading} onClick={() => reload.current()}>기록 다시 확인</button>
    </div>}
    <div className="piano-instrument" aria-busy={loading}>
      <div className="piano-instrument-label"><span>MY MONTHLY PIANO</span><span>♪</span></div>
      <div className="piano-scroll" role="region" aria-label="월요일부터 일요일까지 피아노 건반" tabIndex={0}>
        <div className="piano-keyboard">{PIANO_KEYS.map((key, index) => {
          const progress = visible?.weekdays[index]; const tone = PIANO_TONES[index];
          const playable = Boolean(progress?.isUnlocked && !loading && !error);
          const slots = progress?.filledSlots ?? 0, percent = progress?.percent ?? 0;
          return <div className="piano-key-cell" key={key.weekday}>
            <button type="button" className={`piano-key ${playable ? 'is-unlocked' : 'is-locked'} ${audio.playing.has(key.weekday) ? 'is-playing' : ''}`}
              style={{ '--key-color': key.color, '--key-fill': `${percent}%` }} aria-disabled={!playable}
              aria-label={`${key.label[0]} · ${key.note} ${tone.noteId}, ${slots}/4, ${playable ? '연주 가능' : '잠김'}`} aria-keyshortcuts={tone.shortcut}
              aria-describedby={`piano-instructions${playable ? '' : ` piano-lock-help-${key.weekday}`}`} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); event.currentTarget.focus(); activate(index); } }}
              onClick={(event) => { if (event.detail === 0) activate(index); }}>
              <span className="piano-fill" aria-hidden="true" /><span className="piano-key-status" aria-hidden="true">{playable ? '♪' : '잠김'}</span>
              <span className="piano-key-name">{key.label[0]}</span><span className="piano-pitch">{tone.noteId}</span><kbd aria-hidden="true">{tone.shortcut}</kbd>
            </button>
            <div className="piano-key-progress" role="progressbar" aria-label={`${key.label} 기록 진행도`} aria-valuemin={0} aria-valuemax={4} aria-valuenow={slots} aria-valuetext={`${progress?.uniqueDateCount ?? 0}일 달성, ${slots}/4, ${percent}%`}><strong>{slots}/4</strong><span>{percent}%</span></div>
            <span className="piano-days">{progress?.uniqueDateCount ?? 0}일 기록</span>
            {!playable && <span id={`piano-lock-help-${key.weekday}`} className="piano-sr-only">{lockedKeyMessage({ ...key, uniqueDateCount: progress?.uniqueDateCount ?? 0 }, month, currentMonth)}</span>}
          </div>;
        })}</div>
      </div>
      <p className="piano-scroll-hint">작은 화면에서는 건반을 옆으로 밀어보세요.</p>
    </div>
    <div className="piano-sound-controls"><label htmlFor="piano-volume">음량 <span>{audio.volume}%</span></label><input id="piano-volume" type="range" min="0" max="100" value={audio.volume} onChange={(event) => audio.setVolume(Number(event.target.value))} /><button type="button" aria-pressed={audio.muted} onClick={() => audio.setMuted(value => !value)}>{audio.muted ? '음소거 해제' : '음소거'}</button></div>
    <p id="piano-instructions" className="piano-instructions">A · S · D · F · G · H · J로 도~시를 연주해요. 잠긴 건반도 눌러 안내를 확인할 수 있어요.</p>
    {notice.text && <div key={notice.id} className="piano-guidance" role="status" aria-live="polite">{notice.text}</div>}
    {audio.error && <p role="alert" className="piano-error">{audio.error}</p>}
    {visible?.allKeysUnlocked && !loading && <div className="piano-celebration" role="status">🎶 모든 음을 연주할 수 있어요!</div>}
    {visible?.monthlyComplete && !loading && <div className="piano-celebration is-complete" role="status">🌈 이번 달 피아노 완성!</div>}
    {!loading && !error && !visible?.unlockedKeyCount && <p className="piano-empty">아직 열린 건반이 없어요. 홈이나 캘린더에서 오늘의 소리를 담아보세요.</p>}
    <p className="piano-footnote">파일을 지워도 달성한 날짜는 남아요. 4일이면 100%, 5번째 기록도 소중하게 간직해요.</p>
  </section>;
}
