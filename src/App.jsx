import React, { useState, useEffect } from 'react';
import { soundSynth } from './soundSynth';

// 요일별 7개 피아노 건반 메타데이터 (월~일 / 도~시)
const PIANO_KEYS = [
  { day: '월', note: '도', colorName: '빨강', color: 'var(--pastel-c)', bgTint: 'var(--pastel-c-bg)', keyIdx: 0, solfege: 'Do', freq: '261.63Hz' },
  { day: '화', note: '레', colorName: '주황', color: 'var(--pastel-d)', bgTint: 'var(--pastel-d-bg)', keyIdx: 1, solfege: 'Re', freq: '293.66Hz' },
  { day: '수', note: '미', colorName: '노랑', color: 'var(--pastel-e)', bgTint: 'var(--pastel-e-bg)', keyIdx: 2, solfege: 'Mi', freq: '329.63Hz' },
  { day: '목', note: '파', colorName: '초록', color: 'var(--pastel-f)', bgTint: 'var(--pastel-f-bg)', keyIdx: 3, solfege: 'Fa', freq: '349.23Hz' },
  { day: '금', note: '솔', colorName: '파랑', color: 'var(--pastel-g)', bgTint: 'var(--pastel-g-bg)', keyIdx: 4, solfege: 'Sol', freq: '392.00Hz' },
  { day: '토', note: '라', colorName: '남색', color: 'var(--pastel-a)', bgTint: 'var(--pastel-a-bg)', keyIdx: 5, solfege: 'La', freq: '440.00Hz' },
  { day: '일', note: '시', colorName: '보라', color: 'var(--pastel-b)', bgTint: 'var(--pastel-b-bg)', keyIdx: 6, solfege: 'Ti', freq: '493.88Hz' },
];

function PianoBlackKeys() {
  return (
    <div className="piano-black-keys" aria-hidden="true">
      {[1, 2, 4, 5, 6].map((position) => (
        <span
          key={position}
          className="piano-black-key"
          style={{ left: `${(position / 7) * 100}%` }}
        />
      ))}
    </div>
  );
}

const initialRecordings = [
  {
    id: 'rec-1',
    title: '제주 협재해변의 늦은 파도 소리',
    soundType: 'wave',
    date: '2026-11-06',
    dayOfWeek: 4, // 금요일
    month: 11,
    time: '18:42',
    duration: '01:45',
    location: '제주 제주시 한림읍 협재해변',
    hasMapPin: true,
    memo: '친구들과 모래사장에 앉아서 노을 질 때 들은 파도 소리와 갈매기 울음. 가슴이 확 트이는 평온함.',
    photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    tags: ['파도', '노을', '힐링'],
    revisitMonthsAgo: 3,
    coordsPercent: { top: '65%', left: '38%' },
  },
  {
    id: 'rec-2',
    title: '성수동 카페 아침 빗소리와 에스프레소 머신',
    soundType: 'rain',
    date: '2026-11-04',
    dayOfWeek: 2, // 수요일
    month: 11,
    time: '09:15',
    duration: '00:58',
    location: '서울 성동구 성수동2가',
    hasMapPin: true,
    memo: '창가 자리에 부딪히는 빗방울 소리와 원두 그라인더의 규칙적인 울림. 마음이 차분해지는 순간.',
    photo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    tags: ['카페', '빗소리', '집중'],
    revisitMonthsAgo: null,
    coordsPercent: { top: '32%', left: '55%' },
  },
  {
    id: 'rec-3',
    title: '남산 타워 둘레길 가을 바람과 바스락 낙엽',
    soundType: 'wind',
    date: '2026-11-01',
    dayOfWeek: 6, // 일요일
    month: 11,
    time: '15:30',
    duration: '02:12',
    location: '서울 용산구 남산공원길',
    hasMapPin: true,
    memo: '친구들이랑 산책하며 웃고 떠들던 순간. 걸을 때마다 사각사각 밟히는 마른 낙엽 소리.',
    photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
    tags: ['산책', '바람', '친구들'],
    revisitMonthsAgo: 1,
    coordsPercent: { top: '40%', left: '52%' },
  },
  {
    id: 'rec-4',
    title: '10월의 고요한 가을밤 풀벌레 소리',
    soundType: 'wind',
    date: '2026-10-15',
    dayOfWeek: 3, // 목요일
    month: 10,
    time: '21:10',
    duration: '01:20',
    location: '강원도 춘천시 공지천',
    hasMapPin: true,
    memo: '밤공기가 차가워지기 시작할 때쯤 물가에 앉아 들었던 귀뚜라미 울음소리.',
    photo: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=600&q=80',
    tags: ['가을밤', '풀벌레', '휴식'],
    revisitMonthsAgo: null,
    coordsPercent: { top: '28%', left: '60%' },
  },
];

// 친구 목록 목업 데이터
const initialFriends = [
  {
    id: 'f-1',
    name: '김민지',
    handle: '@sound_minji',
    avatar: 'MJ',
    streak: 12,
    pianoCounts: [3, 4, 2, 4, 3, 2, 2], // 전 건반 해금 상태
    recentSound: '한강 여의도 둔치 버스킹 기타 선율',
  },
  {
    id: 'f-2',
    name: '이준호',
    handle: '@juno_beats',
    avatar: 'JH',
    streak: 7,
    pianoCounts: [2, 3, 1, 4, 2, 0, 1], // 일부 잠김
    recentSound: '동묘 구제시장 엘피 레코드 지직거림',
  },
  {
    id: 'f-3',
    name: '박서연',
    handle: '@seoyeon_wave',
    avatar: 'SY',
    streak: 19,
    pianoCounts: [4, 4, 4, 4, 4, 4, 4], // 100% 완성 상태
    recentSound: '양양 서피비치 거친 파도 앰비언스',
  },
];

export default function App() {
  const [viewMode, setViewMode] = useState('mobile');
  const [activeTab, setActiveTab] = useState('home');
  const [showSpecPanel, setShowSpecPanel] = useState(false);

  // 사운드 다이어리 기록 상태
  const [recordings, setRecordings] = useState(initialRecordings);
  const [calendarMonth, setCalendarMonth] = useState(11);
  const [selectedDate, setSelectedDate] = useState('2026-11-06');

  // 🎵 11월 요일별 피아노 건반 녹음 횟수 상태: [월, 화, 수, 목, 금, 토, 일]
  // 기본 데이터: 월(2), 화(4), 수(1), 목(3), 금(2), 토(0), 일(1)
  const [pianoCounts, setPianoCounts] = useState([2, 4, 1, 3, 2, 0, 1]);
  const [activePianoToast, setActivePianoToast] = useState(null);
  const [pressedKeyIndex, setPressedKeyIndex] = useState(null);

  // 모달 상태들
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showPastPianoModal, setShowPastPianoModal] = useState(false);
  const [selectedFriendPiano, setSelectedFriendPiano] = useState(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // 녹음 인터랙션 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // 저장 모달 인풋 상태
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('서울 성동구 뚝섬로 (GPS 자동감지)');
  const [includeLocationPin, setIncludeLocationPin] = useState(true);
  const [newMemo, setNewMemo] = useState('');

  // 오디오 재생 상태
  const [playingId, setPlayingId] = useState(null);
  const [mapMode, setMapMode] = useState('map');
  const [selectedPin, setSelectedPin] = useState(recordings[0]);

  // 친구 검색 및 설정 상태
  const [friendSearchId, setFriendSearchId] = useState('');
  const [friends, setFriends] = useState(initialFriends);
  const [friendSuccessToast, setFriendSuccessToast] = useState(false);

  // 설정 스위치 상태
  const [noiseFilter, setNoiseFilter] = useState(true);
  const [losslessAudio, setLosslessAudio] = useState(false);
  const [revisitNotification, setRevisitNotification] = useState(true);
  const [photoSync, setPhotoSync] = useState(true);
  const [copiedTokenText, setCopiedTokenText] = useState(null);

  // 녹음 타이머
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 녹음 시작 및 종료 토글
  const handleStartStopRecord = () => {
    if (!isRecording) {
      soundSynth.playChime('start');
      setIsRecording(true);
    } else {
      soundSynth.playChime('stop');
      setIsRecording(false);
      setNewTitle(`오후의 소리 기록 (#${recordings.length + 1})`);
      setShowSaveModal(true);
    }
  };

  // 녹음 저장 및 요일별 건반 진행도 자동 반영
  const handleSaveRecording = () => {
    const now = new Date();
    // 0: 일요일, 1: 월, 2: 화, 3: 수, 4: 목, 5: 금, 6: 토
    // PIANO_KEYS 인덱스: 0(월) ~ 6(일)
    const jsDay = now.getDay();
    const pianoIndex = jsDay === 0 ? 6 : jsDay - 1;

    const newEntry = {
      id: `rec-${Date.now()}`,
      title: newTitle || '그날의 소리 기록',
      soundType: 'wind',
      date: '2026-11-06',
      dayOfWeek: pianoIndex,
      month: 11,
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      duration: formatTimer(recordingSeconds || 24),
      location: newLocation,
      hasMapPin: includeLocationPin,
      memo: newMemo || '오늘의 분위기와 공기를 담은 소리. 일상의 평온한 기록.',
      photo: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=600&q=80',
      tags: ['일상', '소리일기'],
      revisitMonthsAgo: null,
      coordsPercent: { top: '48%', left: '46%' },
    };

    setRecordings([newEntry, ...recordings]);

    // 해당 요일 피아노 카운트 1 증가
    setPianoCounts((prev) => {
      const next = [...prev];
      next[pianoIndex] = (next[pianoIndex] || 0) + 1;
      return next;
    });

    setShowSaveModal(false);
    setNewMemo('');

    // 건반 탭으로 이동하여 바로 소리 확인 가능
    setActiveTab('piano');
    const dayMeta = PIANO_KEYS[pianoIndex];
    triggerPianoToast(`오늘 녹음으로 [${dayMeta.day} · ${dayMeta.note}] 건반이 채워졌어요! 🎶`);
  };

  // 피아노 건반 계산 헬퍼
  // 0일: 0% (잠김), 1일: 25% (잠김), 2일: 50% (연주 가능), 3일: 75% (연주 가능), 4일 이상: 100% (연주 가능)
  const getKeyFillPercent = (count) => {
    if (count <= 0) return 0;
    if (count === 1) return 25;
    if (count === 2) return 50;
    if (count === 3) return 75;
    return 100;
  };

  const isKeyPlayable = (count) => count >= 2;

  // 전체 완성 및 전체 해금 판별
  const allKeysPlayable = pianoCounts.every((c) => c >= 2);
  const allKeysCompleted = pianoCounts.every((c) => c >= 4);

  // 건반 탭 핸들러 (연주 or 잠김 안내 토스트)
  const handleKeyClick = (keyIdx, targetCounts = pianoCounts) => {
    const count = targetCounts[keyIdx] || 0;
    const keyInfo = PIANO_KEYS[keyIdx];

    if (isKeyPlayable(count)) {
      // 열린 건반: 리얼 피아노 음 출력
      soundSynth.playPianoNote(keyIdx);
      setPressedKeyIndex(keyIdx);
      setTimeout(() => setPressedKeyIndex(null), 180);
    } else {
      // 잠긴 건반: 남은 녹음 횟수 안내 툴팁 노출
      const needed = 2 - count;
      const countWord = needed === 1 ? '한 번' : '두 번';
      triggerPianoToast(`${keyInfo.day}요일에 ${countWord} 더 녹음하면 ${keyInfo.note}가 열려요 🔒`);
    }
  };

  const triggerPianoToast = (msg) => {
    setActivePianoToast(msg);
    setTimeout(() => {
      setActivePianoToast((current) => (current === msg ? null : current));
    }, 2800);
  };

  const togglePlay = (id, type = 'wave') => {
    if (playingId === id) {
      soundSynth.stopAll();
      setPlayingId(null);
    } else {
      setPlayingId(id);
      if (type === 'rain') {
        soundSynth.playRain();
      } else if (type === 'wind') {
        soundSynth.playWind();
      } else {
        soundSynth.playWave();
      }
    }
  };

  const handleCopyToken = (hex) => {
    navigator.clipboard?.writeText(hex);
    setCopiedTokenText(hex);
    setTimeout(() => setCopiedTokenText(null), 1800);
  };

  const filteredRecordings = recordings.filter((r) => r.date === selectedDate);
  const mapRecordings = recordings.filter((r) => r.hasMapPin);

  return (
    <>
      {/* ------------------------------------------------------------------
          1. TOP GLOBAL TOOLBAR (Ollama Minimalist)
          ------------------------------------------------------------------ */}
      <header className="global-bar">
        <div className="brand-section">
          <div className="brand-icon">S</div>
          <div>
            <span className="brand-title">SoundCapsule</span>
          </div>
          <span className="brand-tag">Ollama Minimal · Weekly Piano</span>
        </div>

        <div className="viewport-switchers">
          <button
            type="button"
            className={`switch-btn ${viewMode === 'mobile' ? 'active' : ''}`}
            onClick={() => setViewMode('mobile')}
          >
            <span>📱</span> 모바일 뷰
          </button>
          <button
            type="button"
            className={`switch-btn ${viewMode === 'web' ? 'active' : ''}`}
            onClick={() => setViewMode('web')}
          >
            <span>💻</span> 데스크톱 뷰
          </button>
        </div>

        <button
          type="button"
          className={`spec-toggle-btn ${showSpecPanel ? 'active' : ''}`}
          onClick={() => setShowSpecPanel(!showSpecPanel)}
        >
          <span>📐</span> {showSpecPanel ? '가이드 닫기' : 'Ollama DESIGN.md 스펙'}
        </button>
      </header>

      {/* ------------------------------------------------------------------
          2. WORKSPACE WRAPPER
          ------------------------------------------------------------------ */}
      <div className="workspace-wrapper">
        <div className={`device-container mode-${viewMode}`}>
          {/* 웹 뷰 전용 사이드바 */}
          {viewMode === 'web' && (
            <aside className="web-sidebar">
              <div>
                <div className="brand-section" style={{ paddingBottom: '16px' }}>
                  <div className="brand-icon">S</div>
                  <span className="brand-title">SoundCapsule</span>
                </div>
                <nav className="web-nav-list">
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'home' ? 'active' : ''}`}
                    onClick={() => setActiveTab('home')}
                  >
                    <span>🎙️</span> 홈 · 소리 녹음
                  </button>
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calendar')}
                  >
                    <span>📅</span> 캘린더 · 날짜별
                  </button>
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveTab('map')}
                  >
                    <span>🗺️</span> 지도 · 장소별
                  </button>
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'piano' ? 'active' : ''}`}
                    onClick={() => setActiveTab('piano')}
                  >
                    <span>🎵</span> 음표 · 요일 피아노
                  </button>
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                  >
                    <span>👥</span> 친구 & 그룹 공유
                  </button>
                  <button
                    type="button"
                    className={`web-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                  >
                    <span>⚙️</span> 설정
                  </button>
                </nav>
              </div>

              <div className="web-user-badge">
                <div className="avatar-tiny">SO</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>소리여행자</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    🎵 열린 건반 {pianoCounts.filter((c) => c >= 2).length}/7개
                  </p>
                </div>
                <span style={{ fontSize: 11, color: '#10b981' }}>● 온</span>
              </div>
            </aside>
          )}

          {/* 앱 메인 쉘 */}
          <div className="app-screen-body">
            {viewMode === 'mobile' && (
              <div className="mobile-status-bar">
                <span>09:41</span>
                <div className="dynamic-island" />
                <span>5G 100%</span>
              </div>
            )}

            <div className="screen-header">
              <h1 className="screen-title">
                {activeTab === 'home' && '소리 녹음'}
                {activeTab === 'calendar' && '사운드 캘린더'}
                {activeTab === 'map' && '장소별 사운드'}
                {activeTab === 'piano' && '🎵 11월 요일별 피아노'}
                {activeTab === 'friends' && '친구 & 그룹 공유'}
                {activeTab === 'settings' && '환경 설정'}
              </h1>
              <div className="header-action-pill">
                <span>●</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {allKeysCompleted
                    ? '피아노 완성 🏆'
                    : `열린 건반 ${pianoCounts.filter((c) => c >= 2).length}/7`}
                </span>
              </div>
            </div>

            {/* ==========================================================
                TAB 1: 메인 홈 · 소리 녹음 ("녹음 종료" 피드백 반영)
                ========================================================== */}
            {activeTab === 'home' && (
              <div className="record-screen">
                <div className="sound-hero-meta">
                  <div className="sound-badge">
                    <span>GPS</span> 서울 성동구 뚝섬로 · 맑음 18°C
                  </div>
                  <h2>그날의 공기와 소리를 담아보세요</h2>
                  <p>
                    친구들의 웃음소리, 파도와 바람 소리를 기록하면<br />
                    녹음한 요일에 맞춰 파스텔톤 피아노 건반이 차오릅니다.
                  </p>
                </div>

                <div className="visualizer-stage">
                  <div className="waveform-bars">
                    {[18, 30, 48, 65, 34, 52, 78, 90, 42, 60, 30, 70, 85, 45, 62, 38, 20, 50, 75, 40, 24, 60, 80, 55, 35, 68, 88, 48, 22].map(
                      (h, i) => (
                        <div
                          key={i}
                          className={`bar ${isRecording ? 'pulsing' : 'idle'}`}
                          style={{
                            height: isRecording
                              ? `${Math.max(12, (h * (1 + (i % 3) * 0.2)) % 75)}px`
                              : `${Math.max(10, h * 0.4)}px`,
                            animationDelay: `${(i % 5) * 0.1}s`,
                          }}
                        />
                      )
                    )}
                  </div>

                  <div className="timer-badge">
                    <span className={isRecording ? 'live-indicator' : ''} />
                    <span>{isRecording ? `REC ${formatTimer(recordingSeconds)}` : '00:00 READY'}</span>
                  </div>
                </div>

                {/* 사용자 명시 피드백 반영: 녹음 중에는 오직 "녹음 종료"만 표시 */}
                <div className="record-trigger-area">
                  <button
                    type="button"
                    className={`btn-record-giant ${isRecording ? 'recording' : ''}`}
                    onClick={handleStartStopRecord}
                  >
                    <span>{isRecording ? '■' : '●'}</span>
                    <span>{isRecording ? '녹음 종료' : '소리 녹음 시작'}</span>
                  </button>
                  <p className="record-subnote">
                    {isRecording
                      ? '소리를 담는 중입니다. 마치려면 버튼을 눌러주세요.'
                      : '버튼을 눌러 오늘의 소리를 담고 요일별 피아노 건반을 채워보세요.'}
                  </p>
                </div>

                {/* 홈 화면 요일별 피아노 미리보기 스트립 */}
                <div className="home-piano-strip" onClick={() => setActiveTab('piano')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 20 }}>🎹</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        이번 주 피아노 건반 진행도
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {allKeysPlayable
                          ? '모든 건반이 열렸어요! 지금 연주해보세요.'
                          : `현재 7개 중 ${pianoCounts.filter((c) => c >= 2).length}개 건반 연주 가능`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {PIANO_KEYS.map((k, idx) => {
                      const playable = isKeyPlayable(pianoCounts[idx]);
                      return (
                        <div
                          key={k.day}
                          style={{
                            width: 14,
                            height: 28,
                            borderRadius: 4,
                            background: playable ? k.color : '#e4e4e7',
                            opacity: playable ? 1 : 0.45,
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 2: 캘린더 · 날짜별 기록 & 지난 피아노 보기
                ========================================================== */}
            {activeTab === 'calendar' && (
              <div className="calendar-screen">
                <div className="calendar-card">
                  <div className="calendar-month-row">
                    <button
                      type="button"
                      className="cal-nav-btn"
                      onClick={() => setCalendarMonth((m) => (m === 11 ? 10 : 11))}
                    >
                      ‹
                    </button>
                    <span className="month-label">2026년 {calendarMonth}월</span>
                    <button
                      type="button"
                      className="cal-nav-btn"
                      onClick={() => setCalendarMonth((m) => (m === 10 ? 11 : 10))}
                    >
                      ›
                    </button>
                  </div>

                  <div className="calendar-weekdays">
                    <span>월</span>
                    <span>화</span>
                    <span>수</span>
                    <span>목</span>
                    <span>금</span>
                    <span>토</span>
                    <span>일</span>
                  </div>

                  <div className="calendar-days-grid">
                    {Array.from({ length: 30 }, (_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `2026-${String(calendarMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const hasRecord = recordings.some((r) => r.date === dateStr);
                      const isSelected = selectedDate === dateStr;

                      return (
                        <div
                          key={dayNum}
                          className={`day-cell ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedDate(dateStr)}
                        >
                          <span>{dayNum}</span>
                          {hasRecord && <div className="sound-dot" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* 캘린더 하단 지난달 피아노 보기 배지 (기획안 요구사항 반영) */}
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-default)' }}>
                    <button
                      type="button"
                      onClick={() => setShowPastPianoModal(true)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span>🎹 10월의 피아노 · 완성 7/7</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>열어보기 ›</span>
                    </button>
                  </div>
                </div>

                {/* 선택한 날짜의 녹음 카드 목록 */}
                <div className="day-record-list">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {selectedDate}의 소리 기록 ({filteredRecordings.length}건)
                    </span>
                    <button
                      type="button"
                      className="brand-tag"
                      onClick={() => {
                        soundSynth.playChime('start');
                        handleStartStopRecord();
                      }}
                    >
                      + 새 기록 추가
                    </button>
                  </div>

                  {filteredRecordings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                      <p style={{ fontSize: 28, marginBottom: 8 }}>🎙️</p>
                      <p style={{ fontSize: 13 }}>이 날짜에 남겨진 소리가 없습니다.</p>
                      <p style={{ fontSize: 11, marginTop: 4 }}>녹음 버튼을 눌러 그날의 분위기를 채워보세요.</p>
                    </div>
                  ) : (
                    filteredRecordings.map((rec) => (
                      <div key={rec.id} className="sound-card">
                        <div className="sound-card-header">
                          <div>
                            <h3 className="sound-card-title">{rec.title}</h3>
                            <div className="sound-card-meta">
                              <span>⏰ {rec.time}</span>
                              <span>•</span>
                              <span>⏱️ {rec.duration}</span>
                              <span>•</span>
                              <span>📍 {rec.location}</span>
                            </div>
                          </div>
                          <span className="sound-badge-pill">{rec.tags.join(' · ')}</span>
                        </div>

                        <div className="sound-player-row">
                          <button
                            type="button"
                            className="btn-play-mini"
                            onClick={() => togglePlay(rec.id, rec.soundType)}
                          >
                            {playingId === rec.id ? '⏸' : '▶'}
                          </button>
                          <div className="card-waveform">
                            {[20, 45, 75, 30, 60, 90, 40, 80, 50, 65, 35, 70, 85, 40, 60, 30].map((h, i) => (
                              <div
                                key={i}
                                className={`card-wave-bar ${playingId === rec.id && i < 10 ? 'played' : ''}`}
                                style={{ height: `${h * 0.3}px` }}
                              />
                            ))}
                          </div>
                        </div>

                        {rec.memo && <div className="sound-memo">📝 {rec.memo}</div>}

                        {rec.photo && (
                          <img src={rec.photo} alt="현장 사진" className="sound-image-preview" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 3: 지도 · 장소별 기록 & 지구본 탐색 & 재방문 알림
                ========================================================== */}
            {activeTab === 'map' && (
              <div className="map-screen">
                {/* 재방문 알림 (기획안 요구사항 반영) */}
                <div className="revisit-toast">
                  <div className="revisit-icon-pill">📍</div>
                  <div className="revisit-text" style={{ flex: 1 }}>
                    <h4>3개월 전에 이곳을 방문했어요</h4>
                    <p>제주 협재해변에서 남겼던 그날의 파도 소리를 다시 들어볼까요?</p>
                  </div>
                  <button
                    type="button"
                    className="btn-listen-revisit"
                    onClick={() => togglePlay('rec-1', 'wave')}
                  >
                    {playingId === 'rec-1' ? '정지 ⏹' : '소리 듣기 ▶'}
                  </button>
                </div>

                {/* 지도 상단 모드 스위치 (지역 지도 vs 3D 지구본) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '76px',
                    right: '16px',
                    zIndex: 20,
                    background: '#ffffff',
                    padding: '3px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    className={`switch-btn ${mapMode === 'map' ? 'active' : ''}`}
                    onClick={() => setMapMode('map')}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    🗺️ 2D 지도
                  </button>
                  <button
                    type="button"
                    className={`switch-btn ${mapMode === 'globe' ? 'active' : ''}`}
                    onClick={() => setMapMode('globe')}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    🌐 3D 지구본
                  </button>
                </div>

                {/* 지도 캔버스 */}
                <div className="map-viewport">
                  {mapMode === 'globe' ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div
                        style={{
                          width: 200,
                          height: 200,
                          borderRadius: '50%',
                          border: '2px solid var(--border-strong)',
                          background: 'radial-gradient(circle at 30% 30%, #e0f2fe, #38bdf8 70%, #0369a1)',
                          boxShadow: 'inset -20px -20px 40px rgba(0,0,0,0.3), 0 12px 30px rgba(0,0,0,0.15)',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>전 세계 4개 기록</span>
                      </div>
                      <p style={{ marginTop: 14, fontSize: 12, fontWeight: 600 }}>
                        지구본을 회전해 전 세계에서 담은 소리를 탐색하세요
                      </p>
                    </div>
                  ) : (
                    <>
                      {mapRecordings.map((rec) => (
                        <div
                          key={rec.id}
                          className={`map-pin ${selectedPin.id === rec.id ? 'active' : ''}`}
                          style={{
                            top: rec.coordsPercent.top,
                            left: rec.coordsPercent.left,
                          }}
                          onClick={() => setSelectedPin(rec)}
                        >
                          <div className={`pin-bubble ${rec.id === 'rec-1' ? 'pulse' : ''}`}>
                            <span>🎙️</span>
                            <span>{rec.title.split(' ')[0]}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* 선택된 핀 하단 바텀 시트 */}
                {selectedPin && (
                  <div className="map-bottom-sheet">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 700 }}>{selectedPin.title}</h4>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          📍 {selectedPin.location} • 📅 {selectedPin.date}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-play-mini"
                        onClick={() => togglePlay(selectedPin.id, selectedPin.soundType)}
                      >
                        {playingId === selectedPin.id ? '⏸' : '▶'}
                      </button>
                    </div>
                    {selectedPin.memo && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                        "{selectedPin.memo}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ==========================================================
                TAB 4: 🎵 음표 · 요일별 피아노 (Weekly Pastel Piano)
                ========================================================== */}
            {activeTab === 'piano' && (
              <div className="piano-screen">
                <div className="piano-header-card">
                  <h2>11월의 요일별 피아노</h2>
                  <p>
                    실제 소리를 기록한 날의 요일마다 건반이 아래에서 위로 차오릅니다.<br />
                    건반을 50%(2회) 이상 채우면 맑은 피아노 소리가 열립니다.
                  </p>
                </div>

                {/* 피아노 완성 또는 해금 축하 배너 */}
                {allKeysCompleted ? (
                  <div className="piano-complete-banner" style={{ background: '#ecfdf5', borderColor: '#10b981' }}>
                    <span>🎉</span>
                    <span>이번 달 피아노 완성! 일곱 건반이 모두 100% 채워졌습니다.</span>
                  </div>
                ) : allKeysPlayable ? (
                  <div className="piano-complete-banner">
                    <span>🎶</span>
                    <span>모든 음을 연주할 수 있어요! 열린 건반을 눌러 나만의 멜로디를 만들어보세요.</span>
                  </div>
                ) : null}

                {/* 7개 건반 랙 컨테이너 */}
                <div className="piano-rack-stage">
                  {/* 건반 클릭 시 안내 토스트 (예: '수요일에 한 번 더 녹음하면 미가 열려요') */}
                  {activePianoToast && (
                    <div className="piano-feedback-toast">
                      {activePianoToast}
                    </div>
                  )}

                  <div className="piano-keys-row">
                    {PIANO_KEYS.map((keyInfo, idx) => {
                      const count = pianoCounts[idx] || 0;
                      const fillPercent = getKeyFillPercent(count);
                      const playable = isKeyPlayable(count);
                      const isPressed = pressedKeyIndex === idx;

                      return (
                        <div key={keyInfo.day} className="piano-key-column">
                          <button
                            type="button"
                            className={`piano-key-body ${playable ? 'unlocked' : 'locked'} ${isPressed ? 'key-pressed' : ''}`}
                            onClick={() => handleKeyClick(idx)}
                            aria-label={`${keyInfo.day}요일 ${keyInfo.note} 건반`}
                          >
                            {/* 아래에서 위로 차오르는 파스텔 컬러 수직 필 */}
                            <div
                              className="piano-key-fill"
                              style={{
                                height: `${fillPercent}%`,
                                backgroundColor: keyInfo.color,
                              }}
                            />

                            {/* 검은 건반 아래에 요일 & 계이름 표시 */}
                            <div className="piano-key-labels">
                              <span className="key-day-tag">{keyInfo.day}</span>
                              <span className="key-note-tag">{keyInfo.note}</span>
                              {!playable && <span className="key-lock-icon">🔒</span>}
                            </div>
                          </button>

                          {/* 건반 하단 진행도 (예: 2/4) */}
                          <div className="key-progress-counter">
                            {count >= 4 ? '4/4' : `${count}/4`}
                          </div>
                        </div>
                      );
                    })}
                    <PianoBlackKeys />
                  </div>
                </div>

                {/* 건반 규칙 안내 박스 */}
                <div className="piano-guide-box">
                  <h4>💡 요일별 피아노 채움 규칙</h4>
                  <ul style={{ paddingLeft: 18, margin: '6px 0 10px 0', lineHeight: 1.6 }}>
                    <li><strong>0일 (0%):</strong> 잠김 상태 🔒</li>
                    <li><strong>1일 (25%):</strong> 잠김 상태 (탭 시 남은 횟수 안내)</li>
                    <li><strong>2일 (50%):</strong> <strong>연주 가능 🎹</strong> (실제 피아노 소리 출력)</li>
                    <li><strong>3일 (75%):</strong> 연주 가능</li>
                    <li><strong>4일 이상 (100%):</strong> 건반 색상 완전 채움 완료</li>
                  </ul>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    * 매월 1일 새달의 피아노가 0%에서 시작하며, 지난달의 피아노는 보관함에서 언제든 다시 열어 연주할 수 있습니다.
                  </p>
                </div>

                {/* 지난 피아노 보관함 열기 */}
                <button
                  type="button"
                  onClick={() => setShowPastPianoModal(true)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '12px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span>📁</span> 지난달(10월) 피아노 보관함 열람
                </button>
              </div>
            )}

            {/* ==========================================================
                TAB 5: 친구 · 친구 추가 & 그룹 공유 & 친구 음표 보기
                ========================================================== */}
            {activeTab === 'friends' && (
              <div className="friends-screen">
                <div className="calendar-card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>친구 추가</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="input-pill"
                      placeholder="친구의 아이디를 검색하세요 (예: seoyeon_wave)"
                      value={friendSearchId}
                      onChange={(e) => setFriendSearchId(e.target.value)}
                    />
                    <button
                      type="button"
                      className="brand-tag"
                      style={{ background: '#000', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        if (friendSearchId.trim()) {
                          setFriendSuccessToast(true);
                          setTimeout(() => setFriendSuccessToast(false), 2400);
                          setFriendSearchId('');
                        }
                      }}
                    >
                      검색
                    </button>
                  </div>
                  {friendSuccessToast && (
                    <p style={{ fontSize: 12, color: '#10b981', marginTop: 8, fontWeight: 600 }}>
                      ✓ 친구 추가 요청을 보냈습니다!
                    </p>
                  )}
                </div>

                {/* 그룹 사운드 캡슐 */}
                <div className="calendar-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800 }}>내 사운드 그룹 (2)</h3>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>초대받은 멤버들과 소리를 모으는 공간</p>
                    </div>
                    <button
                      type="button"
                      className="brand-tag"
                      onClick={() => setShowCreateGroupModal(true)}
                    >
                      + 새 그룹 만들기
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>제주 파도 여행 캡슐</h4>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>멤버 4명</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        "협재와 월정리 해변에서 녹음한 소리들을 함께 공유하고 있어요."
                      </p>
                    </div>
                    <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-inner)', border: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>성수 카페 산책단</h4>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>멤버 3명</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        "아침 커피 내리는 소리와 잔잔한 빗소리 아카이빙"
                      </p>
                    </div>
                  </div>
                </div>

                {/* 친구 목록 & 친구 음표 보기 */}
                <div className="calendar-card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>친구 목록</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {friends.map((f) => (
                      <div key={f.id} className="friend-item-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="avatar-tiny">{f.avatar}</div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.handle}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              최근 소리: {f.recentSound}
                            </p>
                          </div>
                        </div>

                        {/* 기획안 핵심 요구사항: 친구 음표 보기 (친구 건반 연주 가능) */}
                        <button
                          type="button"
                          className="friend-piano-view-btn"
                          onClick={() => setSelectedFriendPiano(f)}
                        >
                          <span>🎵</span>
                          <span>친구 음표 보기</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 6: 설정 · 계정/소리/알림/앱 연동
                ========================================================== */}
            {activeTab === 'settings' && (
              <div className="settings-screen">
                <div className="profile-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="avatar-tiny" style={{ width: 50, height: 50, fontSize: 18 }}>
                      SO
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800 }}>소리여행자</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>sound_traveler@capsule.io</p>
                      <span className="brand-tag" style={{ marginTop: 6, display: 'inline-block' }}>
                        계정 프로필 관리
                      </span>
                    </div>
                  </div>
                </div>

                <div className="settings-group">
                  <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                    🎙️ 소리 녹음 옵션
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>주변 노이즈 리덕션</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>바람과 기계 소음을 줄이고 목소리와 자연음 강조</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={noiseFilter}
                      onChange={(e) => setNoiseFilter(e.target.checked)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>무손실 고음질 오디오 (FLAC 24-bit)</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>녹음 원본의 현장감을 선명하게 보존</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={losslessAudio}
                      onChange={(e) => setLosslessAudio(e.target.checked)}
                    />
                  </div>
                </div>

                <div className="settings-group">
                  <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                    🔔 알림 & 재방문 설정
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>장소 재방문 감지 알림</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>"3개월 전에 이곳을 방문했어요" 안내</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={revisitNotification}
                      onChange={(e) => setRevisitNotification(e.target.checked)}
                    />
                  </div>
                </div>

                <div className="settings-group">
                  <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                    🔗 외부 앱 연동
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>사진 보관함 자동 연동</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>녹음 시각과 같은 시간대의 사진 추천</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={photoSync}
                      onChange={(e) => setPhotoSync(e.target.checked)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------------------------------------------------
                모바일 하단 6개 네비게이션 탭 바 (Ollama Tactile Pill Bar)
                ---------------------------------------------------------- */}
            {viewMode === 'mobile' && (
              <nav className="mobile-bottom-nav">
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                  onClick={() => setActiveTab('home')}
                >
                  <div className="tab-icon-wrap">🎙️</div>
                  <span>홈</span>
                </button>
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('calendar')}
                >
                  <div className="tab-icon-wrap">📅</div>
                  <span>캘린더</span>
                </button>
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
                  onClick={() => setActiveTab('map')}
                >
                  <div className="tab-icon-wrap">🗺️</div>
                  <span>지도</span>
                </button>
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'piano' ? 'active' : ''}`}
                  onClick={() => setActiveTab('piano')}
                >
                  <div className="tab-icon-wrap">🎵</div>
                  <span>음표</span>
                </button>
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
                  onClick={() => setActiveTab('friends')}
                >
                  <div className="tab-icon-wrap">👥</div>
                  <span>친구</span>
                </button>
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <div className="tab-icon-wrap">⚙️</div>
                  <span>설정</span>
                </button>
              </nav>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------
            3. SPEC PANEL (Ollama Design Rules Inspector)
            ------------------------------------------------------------------ */}
        {showSpecPanel && (
          <aside className="spec-panel">
            <h2 className="spec-heading">Ollama DESIGN.md 스펙</h2>
            <p className="spec-sub">사운드 다이어리 & 요일별 피아노 UI/UX 가이드</p>

            <div className="spec-section">
              <h3 className="spec-section-title">Design Philosophy</h3>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Ollama 특유의 <strong>극단적 미니멀리즘</strong> (흑백 모노크롬, 1px 보더, 9999px Full Pill) 위에
                <strong>파스텔 7색 피아노 건반</strong>을 결합하여 감성적이면서도 군더더기 없는 디자인을 구현했습니다.
              </p>
            </div>

            <div className="spec-section">
              <h3 className="spec-section-title">Weekly Piano Mapping (월~일 / 도~시)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PIANO_KEYS.map((k) => (
                  <div
                    key={k.day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-subtle)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: k.color,
                          display: 'inline-block',
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {k.day}요일 · {k.note} ({k.colorName})
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {k.freq}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="spec-section">
              <h3 className="spec-section-title">Color Palette Tokens</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {[
                  { name: 'Canvas White', hex: '#FFFFFF' },
                  { name: 'Primary Black', hex: '#000000' },
                  { name: 'Subtle Gray', hex: '#F9F9FB' },
                  { name: 'Border Default', hex: '#E4E4E7' },
                  { name: 'Record Red', hex: '#EF4444' },
                  { name: 'Success Green', hex: '#10B981' },
                ].map((item) => (
                  <button
                    key={item.hex}
                    type="button"
                    onClick={() => handleCopyToken(item.hex)}
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-inner)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: item.hex,
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600 }}>{item.name}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {item.hex}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {copiedTokenText && (
                <p style={{ fontSize: 11, color: '#10b981', marginTop: 6, fontWeight: 600 }}>
                  ✓ {copiedTokenText} 복사되었습니다!
                </p>
              )}
            </div>

            <div className="spec-section">
              <h3 className="spec-section-title">Requirements Check</h3>
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.7 }}>
                <li>✓ 녹음 진행 중 버튼 문구: <strong>"녹음 종료"</strong> 명시</li>
                <li>✓ 일곱 건반 요일·계이름·파스텔 매핑 (월·도 ~ 일·시)</li>
                <li>✓ 채움 규칙 (0일: 0%, 1일: 25%, 2일: 50% 연주, 3일: 75%, 4일+: 100%)</li>
                <li>✓ 잠긴 건반 탭 시 친절한 남은 횟수 안내 토스트</li>
                <li>✓ 7건반 해금 시 "모든 음을 연주할 수 있어요!", 100% 시 "이번 달 피아노 완성!"</li>
                <li>✓ 캘린더 연동, 지도 재방문 알림, 친구 음표 보기 & 연주</li>
              </ul>
            </div>
          </aside>
        )}
      </div>

      {/* ------------------------------------------------------------------
          4. MODALS & SHEETS
          ------------------------------------------------------------------ */}
      {/* 1. 녹음 저장 모달 */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <h3>소리 다이어리 저장</h3>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={() => setShowSaveModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 'var(--radius-inner)', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                ⏰ <strong>2026. 11. 06 18:45</strong> 자동 기록됨
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                * 오늘(금요일) 저장 시 🎵 <strong>[금 · 솔]</strong> 건반 진행도에 1회가 자동 집계됩니다.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">기록 제목</label>
              <input
                type="text"
                className="input-pill"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="form-group">
              <label className="form-label">장소 정보</label>
              <input
                type="text"
                className="input-pill"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>지도에 위치 핀 추가</span>
              <input
                type="checkbox"
                checked={includeLocationPin}
                onChange={(e) => setIncludeLocationPin(e.target.checked)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">한 줄 메모</label>
              <input
                type="text"
                className="input-pill"
                placeholder="그 순간의 기분이나 분위기를 적어보세요"
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">사진 첨부 (사진 앱 자동 연동)</label>
              <div className="photo-preview-box">
                <img
                  src="https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=600&q=80"
                  alt="첨부 사진"
                  className="photo-thumb"
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>뚝섬 한강공원 노을.jpg</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>GPS 메타데이터 일치 확인됨</p>
                </div>
              </div>
            </div>

            <div className="sheet-buttons">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowSaveModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-save-capsule"
                onClick={handleSaveRecording}
              >
                저장하고 건반 채우기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 지난달 피아노 보관함 모달 (10월 피아노) */}
      {showPastPianoModal && (
        <div className="modal-overlay" onClick={() => setShowPastPianoModal(false)}>
          <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <h3>📁 10월의 피아노 (보관함)</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  지난달 7개 건반을 모두 완성했습니다! 건반을 눌러 다시 연주해보세요.
                </p>
              </div>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={() => setShowPastPianoModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="piano-rack-stage" style={{ margin: '14px 0' }}>
              <div className="piano-keys-row" style={{ height: 180 }}>
                {PIANO_KEYS.map((keyInfo, idx) => (
                  <div key={keyInfo.day} className="piano-key-column">
                    <button
                      type="button"
                      className="piano-key-body unlocked"
                      onClick={() => {
                        soundSynth.playPianoNote(idx);
                        setPressedKeyIndex(idx);
                        setTimeout(() => setPressedKeyIndex(null), 180);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="piano-key-fill"
                        style={{ height: '100%', backgroundColor: keyInfo.color }}
                      />
                      <div className="piano-key-labels">
                        <span className="key-day-tag">{keyInfo.day}</span>
                        <span className="key-note-tag">{keyInfo.note}</span>
                      </div>
                    </button>
                    <div className="key-progress-counter">4/4</div>
                  </div>
                ))}
                <PianoBlackKeys />
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                className="btn-save-capsule"
                onClick={() => setShowPastPianoModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 친구 음표 보기 모달 (친구 건반 연주 가능) */}
      {selectedFriendPiano && (
        <div className="modal-overlay" onClick={() => setSelectedFriendPiano(null)}>
          <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <div>
                <h3>🎵 {selectedFriendPiano.name}님의 11월 피아노</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {selectedFriendPiano.handle} • 연속 {selectedFriendPiano.streak}일 기록 중
                </p>
              </div>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={() => setSelectedFriendPiano(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              친구가 열어둔 파스텔 건반을 터치하여 친구만의 소리를 연주해보세요!
            </p>

            <div className="piano-rack-stage" style={{ margin: '14px 0' }}>
              <div className="piano-keys-row" style={{ height: 190 }}>
                {PIANO_KEYS.map((keyInfo, idx) => {
                  const count = selectedFriendPiano.pianoCounts[idx] || 0;
                  const fillPercent = getKeyFillPercent(count);
                  const playable = isKeyPlayable(count);

                  return (
                    <div key={keyInfo.day} className="piano-key-column">
                      <button
                        type="button"
                        className={`piano-key-body ${playable ? 'unlocked' : 'locked'}`}
                        onClick={() => handleKeyClick(idx, selectedFriendPiano.pianoCounts)}
                      >
                        <div
                          className="piano-key-fill"
                          style={{
                            height: `${fillPercent}%`,
                            backgroundColor: keyInfo.color,
                          }}
                        />
                        <div className="piano-key-labels">
                          <span className="key-day-tag">{keyInfo.day}</span>
                          <span className="key-note-tag">{keyInfo.note}</span>
                          {!playable && <span className="key-lock-icon">🔒</span>}
                        </div>
                      </button>
                      <div className="key-progress-counter">{count >= 4 ? '4/4' : `${count}/4`}</div>
                    </div>
                  );
                })}
                <PianoBlackKeys />
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="btn-save-capsule"
                onClick={() => setSelectedFriendPiano(null)}
              >
                친구 피아노 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 새 그룹 만들기 모달 */}
      {showCreateGroupModal && (
        <div className="modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
          <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <h3>새 사운드 그룹 생성</h3>
              <button
                type="button"
                className="cal-nav-btn"
                onClick={() => setShowCreateGroupModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">그룹 이름</label>
              <input
                type="text"
                className="input-pill"
                placeholder="예: 주말 산책 소리 모임"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="sheet-buttons">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowCreateGroupModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-save-capsule"
                onClick={() => {
                  setShowCreateGroupModal(false);
                  setNewGroupName('');
                }}
              >
                생성하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
import { useEffect, useRef, useState } from 'react';
import AuthScreen from './AuthScreen.jsx';
import { usePersistentState } from './lib/usePersistentState.js';
import Home from './features/home/Home.jsx';
import Calendar from './features/calendar/Calendar.jsx';
import MapHub from './features/MapHub.jsx';
import FriendsHub from './features/FriendsHub.jsx';
import GroupsHub from './features/GroupsHub.jsx';
import SettingsHub from './features/SettingsHub.jsx';
import PianoHub from './features/PianoHub.jsx';
import { playNotificationSound } from './lib/sounds.js';

const baseFriends = [
  { id:'haru.wave',name:'하루',handle:'@haru.wave',color:'#dc9a79',status:'방금 새로운 소리를 남겼어요' },
  { id:'min.zip',name:'민지',handle:'@min.zip',color:'#77a593',status:'서울 · 2시간 전' },
  { id:'june.sound',name:'준',handle:'@june.sound',color:'#7995af',status:'부산 · 어제' },
  { id:'sora.day',name:'소라',handle:'@sora.day',color:'#9283aa',status:'제주 · 3일 전' },
];

const baseGroups = [
  { id:1,name:'여름 바다 여행',emoji:'🌊',members:['하루','민지','준','나'],preview:'민지: 파도 소리 올렸어!',time:'오후 2:18' },
  { id:2,name:'우리들의 주말',emoji:'☀️',members:['소라','하루','나'],preview:'소라: 다음 주에도 만나요',time:'어제' },
];

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
    music:<><path d="M10 18V5l10-2v13M10 8l10-2"/><ellipse cx="7" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2a8 8 0 0 1-3 1v3H7v-3a8 8 0 0 1-2-1l-2 2-4-4 2-2a8 8 0 0 1-1-3h-3V7h3a8 8 0 0 1 1-2l-2-2 4-4 2 2a8 8 0 0 1 2-1v-3h5v3a8 8 0 0 1 3 1l2-2 4 4-2 2a8 8 0 0 1 1 2h3v5h-3a8 8 0 0 1-1 3z"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    check:<path d="m5 12 4 4L19 6"/>,
  };
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Toast({ text }) {
  return text ? <div className="toast" role="status"><Icon name="check" size={17}/>{text}</div> : null;
}

function Avatar({ name,image }) {
  return image?<img className="avatar sm" src={image} alt=""/>:<span className="avatar sm coral">{name?.[0] || '나'}</span>;
}

export default function App() {
  const [page,setPage]=useState(()=>new URLSearchParams(location.search).has('openRecording')?'map':'home');
  const [homeActivity,setHomeActivity]=useState({hasUnsaved:false,busy:false});
  const [calendarActivity,setCalendarActivity]=useState({hasUnsaved:false,busy:false});
  const [friends,setFriends]=usePersistentState('friends',baseFriends);
  const [blocked,setBlocked]=usePersistentState('blocked',[]);
  const [groups,setGroups]=usePersistentState('groups',baseGroups);
  const [users,setUsers]=usePersistentState('users',[]);
  const [session,setSession]=usePersistentState('session',initialSession);
  const [sessions,setSessions]=usePersistentState('account:sessions',[]);
  const [toast,setToast]=useState('');
  const timer=useRef(null);
  const activity=page==='home'?homeActivity:page==='calendar'?calendarActivity:{hasUnsaved:false,busy:false};
  useEffect(()=>{const check=event=>{if(!session?.sessionId)return;let revoked=[];try{revoked=JSON.parse(event?.newValue||localStorage.getItem('soundcapsule:revoked-sessions')||'[]')}catch{}if(revoked.includes(session.sessionId))setSession(null)};window.addEventListener('storage',check);check();return()=>window.removeEventListener('storage',check)},[session?.sessionId,setSession]);

  const navigate=(next)=>{
    if(next===page||activity.busy)return;
    if(activity.hasUnsaved&&!window.confirm('저장하지 않은 녹음이나 메모가 있어요. 화면을 이동하면 사라집니다. 이동할까요?'))return;
    setHomeActivity({hasUnsaved:false,busy:false});
    setCalendarActivity({hasUnsaved:false,busy:false});
    setPage(next);
  };

  const notify=(text,type='message')=>{
    const saved=localStorage.getItem('soundcapsule:settings:alerts:v2');
    let settings=null;
    try{settings=saved?JSON.parse(saved):null}catch{}
    const enabled=settings?.[type]!==false;
    const inApp=settings?.channels?.inApp!==false;
    if(inApp&&enabled){setToast(text);if(!document.hidden)playNotificationSound(settings?.sound||'soft');clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),2500)}
    if(!enabled||settings?.channels?.push===false||!('Notification'in window)||Notification.permission!=='granted'||!document.hidden)return;
    const quiet=settings?.quiet;
    if(quiet?.enabled){const time=new Date().toTimeString().slice(0,5);const muted=quiet.start<quiet.end?time>=quiet.start&&time<quiet.end:time>=quiet.start||time<quiet.end;if(muted)return}
    navigator.serviceWorker?.ready.then(registration=>registration.showNotification('SoundCapsule',{body:text,icon:'/favicon.svg',tag:`soundcapsule-${type}`})).catch(()=>new Notification('SoundCapsule',{body:text}));
    if(settings?.vibration)navigator.vibrate?.(80);
  };

  if(!session||(session.local&&!bypassAuth))return <AuthScreen users={users} setUsers={setUsers} onLogin={user=>{const loginAt=new Date().toISOString(),sessionId=crypto.randomUUID();setSession({id:user.id,name:user.name,role:user.role,profileImage:user.profileImage||null,loginAt,sessionId});setSessions(current=>[...current.filter(item=>item.userId!==user.id||item.sessionId!==sessionId),{sessionId,userId:user.id,loginAt,userAgent:navigator.userAgent,current:true}]);setPage(new URLSearchParams(location.search).has('openRecording')?'map':'home')}}/>;

  const content={
    home:<Home key={session.id} onActivityChange={setHomeActivity} groups={groups}/>,
    calendar:<Calendar key={session.id} onActivityChange={setCalendarActivity} appGroups={groups}/>,
    map:<MapHub notify={notify}/>,
    piano:<PianoHub key={session.id} userId={session.local?undefined:session.id}/>,
    friends:<FriendsHub friends={friends} setFriends={setFriends} blocked={blocked} setBlocked={setBlocked} notify={notify} currentUser={session}/>,
    groups:<GroupsHub groups={groups} setGroups={setGroups} friends={friends} notify={notify} currentUser={session}/>,
    settings:<SettingsHub notify={notify} currentUser={session} users={users} setUsers={setUsers} groups={groups} sessions={sessions.filter(item=>item.userId===session.id)} setSessions={setSessions} onProfileUpdate={profile=>{const oldId=session.id;setSession(current=>({...current,...profile}));setSessions(current=>current.map(item=>item.userId===oldId?{...item,userId:profile.id}:item))}} onRevokeSession={sessionId=>{setSessions(current=>current.filter(item=>item.sessionId!==sessionId));let revoked=[];try{revoked=JSON.parse(localStorage.getItem('soundcapsule:revoked-sessions')||'[]')}catch{}localStorage.setItem('soundcapsule:revoked-sessions',JSON.stringify([...new Set([...revoked,sessionId])]));if(sessionId===session.sessionId)setSession(null)}} onLogout={()=>{setSessions(current=>current.filter(item=>item.sessionId!==session.sessionId));setSession(null)}}/>,
  };

  return <div className="shell merged-shell">
    <aside className="sidebar"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><nav>{nav.map(item=><button type="button" className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} disabled={activity.busy} key={item.id} onClick={()=>navigate(item.id)}><Icon name={item.icon}/>{item.label}</button>)}</nav><button type="button" className="group-entry" aria-label="그룹 열기" aria-current={page==='groups'?'page':undefined} disabled={activity.busy} onClick={()=>navigate('groups')}><Icon name="chat"/>그룹 열기</button><div className="memory"><span>오늘의 지난 소리</span><strong>작년 오늘, 성수동</strong><p>카페 창가의 빗소리</p></div><div className="me"><Avatar name={session.name} image={session.profileImage}/><span><strong>{session.name}</strong><small>@{session.id}</small></span></div></aside>
    <main className="main"><header className="mobile"><div className="brand"><i><b/><b/><b/></i>SoundCapsule</div><button type="button" className="group-entry" aria-label="그룹 열기" disabled={activity.busy} onClick={()=>navigate('groups')}>그룹</button><Icon name="bell"/></header>{content[page]}</main>
    <nav className="bottom" aria-label="주요 화면">{nav.map(item=><button type="button" aria-label={item.label} className={page===item.id?'active':''} aria-current={page===item.id?'page':undefined} disabled={activity.busy} key={item.id} onClick={()=>navigate(item.id)}><Icon name={item.icon}/><span aria-hidden="true">{item.shortLabel}</span></button>)}</nav>
    <Toast text={toast}/>
  </div>;
}
