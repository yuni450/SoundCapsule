import React, { useState, useEffect } from 'react';

// 초기 샘플 사운드 기록 데이터 (기획안 연계)
const initialRecordings = [
  {
    id: 'rec-1',
    title: '제주 협재해변의 늦은 파도 소리',
    date: '2026-11-06',
    time: '18:42',
    duration: '01:45',
    location: '제주 제주시 한림읍 협재해변',
    memo: '친구들과 모래사장에 앉아서 노을 질 때 들은 파도 소리와 갈매기 울음.',
    photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    tags: ['파도', '노을', '힐링'],
    revisitMonthsAgo: 3,
    lat: 33.3941,
    lng: 126.2397,
    coordsPercent: { top: '65%', left: '38%' },
  },
  {
    id: 'rec-2',
    title: '성수동 카페 아침 빗소리와 에스프레소 머신',
    date: '2026-11-04',
    time: '09:15',
    duration: '00:58',
    location: '서울 성동구 성수동2가',
    memo: '창가 자리에 부딪히는 빗방울 소리와 원두 그라인더의 규칙적인 울림.',
    photo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    tags: ['카페', '빗소리', '집중'],
    revisitMonthsAgo: null,
    lat: 37.5447,
    lng: 127.056,
    coordsPercent: { top: '32%', left: '55%' },
  },
  {
    id: 'rec-3',
    title: '남산 타워 둘레길 가을 바람과 바스락 낙엽',
    date: '2026-11-01',
    time: '15:30',
    duration: '02:12',
    location: '서울 용산구 남산공원길',
    memo: '친구들이랑 산책하며 웃고 떠들던 순간. 걸을 때마다 밟히는 마른 낙엽 소리.',
    photo: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
    tags: ['산책', '바람', '친구들'],
    revisitMonthsAgo: 1,
    lat: 37.5512,
    lng: 126.9882,
    coordsPercent: { top: '40%', left: '52%' },
  },
];

export default function App() {
  // 모드: 모바일 앱 뷰 ('mobile') vs 웹 데스크톱 뷰 ('web')
  const [viewMode, setViewMode] = useState('mobile');
  
  // 현재 활성 탭 (1: home, 2: calendar, 3: map, 4: friends, 5: settings)
  const [activeTab, setActiveTab] = useState('home');

  // 디자이너용 Design System Spec 패널 열림/닫힘
  const [showSpecPanel, setShowSpecPanel] = useState(false);

  // 사운드 다이어리 기록 상태
  const [recordings, setRecordings] = useState(initialRecordings);
  const [selectedDate, setSelectedDate] = useState('2026-11-06');
  
  // 녹음 인터랙션 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // 저장 모달 인풋 상태
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('서울 성동구 뚝섬로 (GPS 자동감지)');
  const [newMemo, setNewMemo] = useState('');

  // 현재 오디오 재생 중인 기록 ID 및 진행도
  const [playingId, setPlayingId] = useState(null);

  // 지도 핀 선택 상태
  const [selectedPin, setSelectedPin] = useState(recordings[0]);

  // 설정 스위치 토글 상태
  const [noiseFilter, setNoiseFilter] = useState(true);
  const [losslessAudio, setLosslessAudio] = useState(false);
  const [revisitNotification, setRevisitNotification] = useState(true);
  const [photoSync, setPhotoSync] = useState(true);

  // 녹음 타이머 틱
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

  const handleStartStopRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
    } else {
      setIsRecording(false);
      setNewTitle(`오후의 소리 기록 (#${recordings.length + 1})`);
      setShowSaveModal(true);
    }
  };

  const handleSaveRecording = () => {
    const now = new Date();
    const newEntry = {
      id: `rec-${Date.now()}`,
      title: newTitle || '그날의 소리 기록',
      date: '2026-11-06',
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      duration: formatTimer(recordingSeconds || 24),
      location: newLocation,
      memo: newMemo || '오늘의 분위기와 공기를 담은 소리.',
      photo: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=600&q=80',
      tags: ['일상', '소리일기'],
      revisitMonthsAgo: null,
      lat: 37.54,
      lng: 127.04,
      coordsPercent: { top: '48%', left: '46%' },
    };
    setRecordings([newEntry, ...recordings]);
    setShowSaveModal(false);
    setNewMemo('');
    setActiveTab('calendar');
  };

  const togglePlay = (id) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  // 선택된 날짜의 녹음 필터링
  const filteredRecordings = recordings.filter((r) => r.date === selectedDate);

  return (
    <>
      {/* ------------------------------------------------------------------
          1. TOP GLOBAL TOOLBAR (Ollama Minimalist Bar)
          ------------------------------------------------------------------ */}
      <header className="global-bar">
        <div className="brand-section">
          <div className="brand-icon">S</div>
          <div>
            <span className="brand-title">SoundCapsule</span>
          </div>
          <span className="brand-tag">Ollama DESIGN.md</span>
        </div>

        {/* 뷰포트 전환 (앱 뷰 ↔ 웹 뷰) */}
        <div className="viewport-switchers">
          <button
            type="button"
            className={`switch-btn ${viewMode === 'mobile' ? 'active' : ''}`}
            onClick={() => setViewMode('mobile')}
          >
            <span>📱</span> 모바일 앱 뷰
          </button>
          <button
            type="button"
            className={`switch-btn ${viewMode === 'web' ? 'active' : ''}`}
            onClick={() => setViewMode('web')}
          >
            <span>💻</span> 웹 데스크톱 뷰
          </button>
        </div>

        {/* 디자인 스펙 사이드바 토글 버튼 */}
        <button
          type="button"
          className={`spec-toggle-btn ${showSpecPanel ? 'active' : ''}`}
          onClick={() => setShowSpecPanel(!showSpecPanel)}
        >
          <span>📐</span> {showSpecPanel ? '가이드 닫기' : 'DESIGN.md 스펙 보기'}
        </button>
      </header>

      {/* ------------------------------------------------------------------
          2. WORKSPACE WRAPPER
          ------------------------------------------------------------------ */}
      <div className="workspace-wrapper">
        {/* 디바이스 컨테이너 (Mobile or Web) */}
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
                    <span>🎙️</span> 메인 홈 · 녹음
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
                    className={`web-nav-item ${activeTab === 'friends' ? 'active' : ''}`}
                    onClick={() => setActiveTab('friends')}
                  >
                    <span>👥</span> 친구 · 공유
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
                  <p style={{ fontSize: 13, fontWeight: 600 }}>소리여행자</p>
                  <p style={{ fontSize: 11, color: '#a1a1aa' }}>@sound_wanderer</p>
                </div>
                <span style={{ fontSize: 11, color: '#10b981' }}>●</span>
              </div>
            </aside>
          )}

          {/* 앱 메인 쉘 */}
          <div className="app-screen-body">
            {/* 모바일 상단 노치 & 상태바 (모바일 모드일 때만) */}
            {viewMode === 'mobile' && (
              <div className="mobile-status-bar">
                <span>09:41</span>
                <div className="dynamic-island" />
                <span>5G 100%</span>
              </div>
            )}

            {/* 화면 헤더 */}
            <div className="screen-header">
              <h1 className="screen-title">
                {activeTab === 'home' && '소리 녹음'}
                {activeTab === 'calendar' && '사운드 캘린더'}
                {activeTab === 'map' && '장소별 사운드'}
                {activeTab === 'friends' && '친구 & 그룹'}
                {activeTab === 'settings' && '환경 설정'}
              </h1>
              <div className="header-action-pill">
                <span>●</span>
                <span>{recordings.length}개의 캡슐</span>
              </div>
            </div>

            {/* ==========================================================
                TAB 1: 메인 홈 · 녹음 (소리 녹음 & 파형 인터랙션)
                ========================================================== */}
            {activeTab === 'home' && (
              <div className="record-screen">
                <div className="sound-hero-meta">
                  <div className="sound-badge">
                    <span>GPS</span> 서울 성동구 뚝섬로 · 맑음 18°C
                  </div>
                  <h2>그날의 공기와 소리를 담아보세요</h2>
                  <p>친구들의 웃음소리, 바람, 파도 소리를 기록해 캘린더에 보관합니다.</p>
                </div>

                {/* 실시간 촉각적 오디오 파형 시각화 */}
                <div className="visualizer-stage">
                  <div className="waveform-bars">
                    {[18, 30, 48, 65, 34, 52, 78, 90, 42, 60, 30, 70, 85, 45, 62, 38, 20, 50, 75, 40, 24, 60, 80, 55, 35, 68, 88, 48, 22].map(
                      (h, i) => (
                        <div
                          key={i}
                          className={`bar ${isRecording ? 'pulsing' : 'idle'}`}
                          style={{
                            height: isRecording
                              ? `${Math.max(12, (h * (1 + (i % 3) * 0.2)) % 85)}px`
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

                {/* 거대 원터치 녹음 버튼 (Ollama Pill) */}
                <div className="record-trigger-area">
                  <button
                    type="button"
                    className={`btn-record-giant ${isRecording ? 'recording' : ''}`}
                    onClick={handleStartStopRecord}
                  >
                    <span>{isRecording ? '■' : '●'}</span>
                    <span>{isRecording ? '녹음 종료 및 저장' : '소리 녹음 시작'}</span>
                  </button>
                  <p className="record-subnote">
                    {isRecording
                      ? '녹음 중입니다. 완료하려면 버튼을 다시 눌러주세요.'
                      : '버튼을 누르면 즉시 주변 소리를 캡처합니다.'}
                  </p>
                </div>

                {/* 최근 저장된 소리 스니펫 */}
                <div className="recent-snippet">
                  <div className="recent-left">
                    <div className="recent-icon">🌊</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{recordings[0]?.title}</p>
                      <p style={{ fontSize: 11, color: '#71717a' }}>
                        {recordings[0]?.date} · {recordings[0]?.duration}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="header-action-pill"
                    onClick={() => setActiveTab('calendar')}
                  >
                    전체보기 →
                  </button>
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 2: 캘린더 · 날짜별 기록 (캘린더 & 사운드 카드)
                ========================================================== */}
            {activeTab === 'calendar' && (
              <div className="calendar-screen">
                {/* 월간 캘린더 위젯 */}
                <div className="calendar-card">
                  <div className="calendar-month-row">
                    <span className="month-label">2026년 11월</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="cal-nav-btn">‹</button>
                      <button type="button" className="cal-nav-btn">›</button>
                    </div>
                  </div>

                  <div className="calendar-weekdays">
                    <span>일</span>
                    <span>월</span>
                    <span>화</span>
                    <span>수</span>
                    <span>목</span>
                    <span>금</span>
                    <span>토</span>
                  </div>

                  <div className="calendar-days-grid">
                    {/* 10월 말일 */}
                    <div className="day-cell other-month">28</div>
                    <div className="day-cell other-month">29</div>
                    <div className="day-cell other-month">30</div>
                    <div className="day-cell other-month">31</div>

                    {/* 11월 일자들 (소리 있는 날짜에 블랙 도트) */}
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((d) => {
                      const dayStr = `2026-11-${String(d).padStart(2, '0')}`;
                      const hasRecord = recordings.some((r) => r.date === dayStr);
                      const isSel = selectedDate === dayStr;
                      return (
                        <div
                          key={d}
                          className={`day-cell ${isSel ? 'selected' : ''}`}
                          onClick={() => setSelectedDate(dayStr)}
                        >
                          <span>{d}</span>
                          {hasRecord && <div className="sound-dot" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 선택한 날짜의 녹음 카드 리스트 */}
                <div className="day-record-list">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#52525b' }}>
                      {selectedDate}의 소리 기록 ({filteredRecordings.length})
                    </p>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a1a1aa' }}>
                      CARD VIEW
                    </span>
                  </div>

                  {filteredRecordings.length === 0 ? (
                    <div
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#a1a1aa',
                        fontSize: 13,
                        background: '#fff',
                        borderRadius: 20,
                        border: '1px dashed #e4e4e7',
                      }}
                    >
                      이 날짜에 기록된 소리가 없습니다. 홈에서 소리를 녹음해보세요!
                    </div>
                  ) : (
                    filteredRecordings.map((rec) => (
                      <article key={rec.id} className="sound-card">
                        <div className="sound-card-header">
                          <div>
                            <h3 className="sound-card-title">{rec.title}</h3>
                            <div className="sound-card-meta">
                              <span>📍 {rec.location}</span>
                              <span>·</span>
                              <span>{rec.time}</span>
                            </div>
                          </div>
                          <span className="sound-badge-pill">{rec.duration}</span>
                        </div>

                        {/* 인라인 오디오 플레이어 & 음파 */}
                        <div className="sound-player-row">
                          <button
                            type="button"
                            className="btn-play-mini"
                            onClick={() => togglePlay(rec.id)}
                            aria-label="재생/일시정지"
                          >
                            {playingId === rec.id ? '❚❚' : '▶'}
                          </button>
                          <div className="card-waveform">
                            {[12, 22, 14, 28, 16, 26, 20, 15, 24, 18, 10, 22, 28, 16, 12, 24, 18].map(
                              (h, i) => (
                                <div
                                  key={i}
                                  className={`card-wave-bar ${playingId === rec.id && i < 10 ? 'played' : ''}`}
                                  style={{
                                    height: playingId === rec.id ? `${h}px` : `${Math.max(6, h * 0.6)}px`,
                                  }}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {/* 짧은 메모 */}
                        <p className="sound-memo">"{rec.memo}"</p>

                        {/* 첨부 사진 */}
                        {rec.photo && (
                          <img
                            src={rec.photo}
                            alt="녹음 당시 장소 사진"
                            className="sound-image-preview"
                          />
                        )}
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 3: 지도 · 장소별 기록 (지구본/지도 & 재방문 알림)
                ========================================================== */}
            {activeTab === 'map' && (
              <div className="map-screen">
                <div className="map-viewport">
                  {/* 기획안 핵심 요구사항: 재방문 알림 토스트 */}
                  <div className="revisit-toast">
                    <div className="revisit-icon-pill">📍</div>
                    <div className="revisit-text" style={{ flex: 1 }}>
                      <h4>3개월 전에 이곳을 방문했어요.</h4>
                      <p>그날의 파도 소리를 다시 들어볼까요? (협재해변)</p>
                    </div>
                    <button
                      type="button"
                      className="btn-listen-revisit"
                      onClick={() => {
                        const rec = recordings.find((r) => r.id === 'rec-1');
                        if (rec) {
                          setSelectedPin(rec);
                          togglePlay(rec.id);
                        }
                      }}
                    >
                      다시 듣기
                    </button>
                  </div>

                  {/* 지도 인터랙티브 핀들 */}
                  {recordings.map((rec) => (
                    <div
                      key={rec.id}
                      className={`map-pin ${selectedPin?.id === rec.id ? 'active' : ''}`}
                      style={{ top: rec.coordsPercent.top, left: rec.coordsPercent.left }}
                      onClick={() => setSelectedPin(rec)}
                    >
                      <div className={`pin-bubble ${rec.revisitMonthsAgo ? 'pulse' : ''}`}>
                        <span>🎵</span>
                        <span>{rec.title.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}

                  {/* 장소 선택 팝업 바텀 시트 */}
                  {selectedPin && (
                    <div className="map-bottom-sheet">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: 11, color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                            {selectedPin.date} · {selectedPin.time}
                          </p>
                          <h4 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0' }}>
                            {selectedPin.title}
                          </h4>
                          <p style={{ fontSize: 12, color: '#52525b' }}>📍 {selectedPin.location}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-play-mini"
                          onClick={() => togglePlay(selectedPin.id)}
                        >
                          {playingId === selectedPin.id ? '❚❚' : '▶'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==========================================================
                TAB 4: 친구 · 공유 (친구 검색, 그룹 생성 & 공유 피드)
                ========================================================== */}
            {activeTab === 'friends' && (
              <div className="friends-screen">
                {/* 상대방 ID 검색바 */}
                <div className="search-pill-box">
                  <span className="search-icon-pos">🔍</span>
                  <input
                    type="text"
                    className="search-pill-input"
                    placeholder="친구 아이디를 검색해 추가하세요 (@soundmate)"
                  />
                </div>

                <div className="subtab-switcher">
                  <button type="button" className="subtab-btn active">내 그룹 (2)</button>
                  <button type="button" className="subtab-btn">친구 목록 (14)</button>
                  <button type="button" className="subtab-btn">+ 새 그룹 생성</button>
                </div>

                {/* 그룹 1: 제주 여행 소리 모음 */}
                <article className="group-capsule-card">
                  <div className="group-header">
                    <div>
                      <h3 className="group-title">🌴 2026 제주 가을 여행</h3>
                      <p style={{ fontSize: 12, color: '#71717a' }}>초대 수락 친구 4명 참여 중</p>
                    </div>
                    <span className="group-members-pill">공유됨</span>
                  </div>

                  <div className="feed-item">
                    <div className="feed-user-row">
                      <div className="avatar-tiny" style={{ background: '#2563eb' }}>민</div>
                      <span>민지 · 3시간 전 공유</span>
                    </div>
                    <div className="sound-card" style={{ padding: 12, margin: '4px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>돌담길 바람 소리와 풀벌레</span>
                        <button
                          type="button"
                          className="btn-play-mini"
                          style={{ width: 30, height: 30, fontSize: 11 }}
                          onClick={() => togglePlay('feed-1')}
                        >
                          {playingId === 'feed-1' ? '❚❚' : '▶'}
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#52525b' }}>
                      💬 "이때 진짜 시원했는데 또 가고 싶다!"
                    </p>
                  </div>
                </article>

                {/* 그룹 2: 퇴근길 일상 소리 */}
                <article className="group-capsule-card">
                  <div className="group-header">
                    <div>
                      <h3 className="group-title">☕ 성수 & 한강 사운드 스팟</h3>
                      <p style={{ fontSize: 12, color: '#71717a' }}>친구 2명 참여 중</p>
                    </div>
                    <span className="group-members-pill">그룹</span>
                  </div>
                  <button
                    type="button"
                    className="header-action-pill"
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  >
                    + 이 그룹에 내 녹음 공유하기
                  </button>
                </article>
              </div>
            )}

            {/* ==========================================================
                TAB 5: 설정 (계정, 소리 옵션, 알림, 앱 연동)
                ========================================================== */}
            {activeTab === 'settings' && (
              <div className="settings-screen">
                {/* 계정 프로필 */}
                <div className="profile-card">
                  <div className="profile-avatar-lg">S</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>소리여행자</h3>
                    <p style={{ fontSize: 12, color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                      @sound_wanderer
                    </p>
                    <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>
                      계정 · 비밀번호 · 프로필 사진 관리
                    </p>
                  </div>
                  <button type="button" className="header-action-pill">수정</button>
                </div>

                {/* 소리 옵션 */}
                <div className="settings-group">
                  <div className="settings-group-title">소리 옵션</div>
                  <div className="setting-row">
                    <div>
                      <span>바람 소리 / 노이즈 캔슬링</span>
                      <span className="setting-label-sub">야외 녹음 시 바람 잡음을 감쇄합니다.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-pill ${noiseFilter ? 'checked' : ''}`}
                      onClick={() => setNoiseFilter(!noiseFilter)}
                    >
                      <div className="toggle-knob" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <span>무손실 Hi-Fi 오디오 저장 (FLAC)</span>
                      <span className="setting-label-sub">고용량 원음으로 녹음합니다.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-pill ${losslessAudio ? 'checked' : ''}`}
                      onClick={() => setLosslessAudio(!losslessAudio)}
                    >
                      <div className="toggle-knob" />
                    </button>
                  </div>
                </div>

                {/* 알림 옵션 */}
                <div className="settings-group">
                  <div className="settings-group-title">알림</div>
                  <div className="setting-row">
                    <div>
                      <span>장소 재방문 안내 알림</span>
                      <span className="setting-label-sub">
                        '3개월 전에 이곳을 방문했어요' 리마인더를 받습니다.
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-pill ${revisitNotification ? 'checked' : ''}`}
                      onClick={() => setRevisitNotification(!revisitNotification)}
                    >
                      <div className="toggle-knob" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <span>알림음 선택</span>
                      <span className="setting-label-sub">부드러운 물방울 차임벨</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#71717a' }}>물방울 ›</span>
                  </div>
                </div>

                {/* 앱 연동 관리 */}
                <div className="settings-group">
                  <div className="settings-group-title">앱 연동 관리</div>
                  <div className="setting-row">
                    <div>
                      <span>사진 앱 (Apple Photos / Gallery)</span>
                      <span className="setting-label-sub">녹음 시간과 일치하는 사진 자동 추천</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-pill ${photoSync ? 'checked' : ''}`}
                      onClick={() => setPhotoSync(!photoSync)}
                    >
                      <div className="toggle-knob" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <span>메모 및 음악 스트리밍 앱 연동</span>
                      <span className="setting-label-sub">BGM 정보 및 텍스트 노트 동기화</span>
                    </div>
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>연결됨 ›</span>
                  </div>
                </div>
              </div>
            )}

            {/* 모바일 하단 탭 바 (모바일 모드일 때만 표시) */}
            {viewMode === 'mobile' && (
              <nav className="mobile-bottom-nav">
                <button
                  type="button"
                  className={`bottom-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                  onClick={() => setActiveTab('home')}
                >
                  <div className="tab-icon-wrap">🎙️</div>
                  <span>녹음</span>
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

            {/* ==========================================================
                녹음 완료 후 정보 입력 모달 (기록 정보 입력 시트)
                ========================================================== */}
            {showSaveModal && (
              <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                <div className="sheet-container" onClick={(e) => e.stopPropagation()}>
                  <div className="sheet-grabber" />
                  <div className="sheet-header">
                    <h3>새로운 소리 캡슐 저장</h3>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a1a1aa' }}>
                      2026.11.06
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">기록 제목</label>
                    <input
                      type="text"
                      className="input-pill"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="예) 친구들과 웃던 제주 해변 파도"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">위치 및 장소명 (지도에 자동 반영)</label>
                    <input
                      type="text"
                      className="input-pill"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">짧은 메모 남기기</label>
                    <input
                      type="text"
                      className="input-pill"
                      value={newMemo}
                      onChange={(e) => setNewMemo(e.target.value)}
                      placeholder="그 순간의 기분과 날씨, 사람들을 적어보세요."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">사진 앱 연동 (자동 매칭된 사진 1장)</label>
                    <div className="photo-preview-box">
                      <img
                        src="https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=120&q=80"
                        alt="자동 매칭 사진"
                        className="photo-thumb"
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600 }}>녹음 시간과 일치하는 사진 발견</p>
                        <p style={{ fontSize: 11, color: '#71717a' }}>사진 앱에서 자동으로 캡슐에 첨부됩니다.</p>
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
                      캘린더 & 지도에 저장하기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------
            3. DESIGN SYSTEM SPEC PANEL (Ollama Tokens Inspector)
            ------------------------------------------------------------------ */}
        {showSpecPanel && (
          <aside className="spec-panel">
            <h2 className="spec-heading">DESIGN.md 토큰 가이드</h2>
            <p className="spec-sub">
              Ollama Design System의 극단적 미니멀리즘과 라운디드 폰트, 정제된 팔레트를 사운드 저널에 최적화했습니다.
            </p>

            {/* Colors */}
            <div className="spec-section">
              <div className="spec-section-title">Color Palette</div>
              <div className="swatch-grid">
                <div className="color-swatch-card">
                  <div className="swatch-color-box" style={{ background: '#000000' }} />
                  <div className="swatch-info">
                    <span className="swatch-name">Pure Black</span>
                    <span className="swatch-hex">#000000</span>
                  </div>
                </div>
                <div className="color-swatch-card">
                  <div className="swatch-color-box" style={{ background: '#FFFFFF' }} />
                  <div className="swatch-info">
                    <span className="swatch-name">Paper Canvas</span>
                    <span className="swatch-hex">#FFFFFF</span>
                  </div>
                </div>
                <div className="color-swatch-card">
                  <div className="swatch-color-box" style={{ background: '#E4E4E7' }} />
                  <div className="swatch-info">
                    <span className="swatch-name">Border Default</span>
                    <span className="swatch-hex">#E4E4E7</span>
                  </div>
                </div>
                <div className="color-swatch-card">
                  <div className="swatch-color-box" style={{ background: '#EF4444' }} />
                  <div className="swatch-info">
                    <span className="swatch-name">Record Pulse</span>
                    <span className="swatch-hex">#EF4444</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="spec-section">
              <div className="spec-section-title">Typography Rules</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <p style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    Display: Plus Jakarta Sans / Rounded
                  </p>
                  <p style={{ fontSize: 11, color: '#71717a' }}>헤드라인, 브랜드 타이틀, 라운디드 감성</p>
                </div>
                <div>
                  <p style={{ fontWeight: 500 }}>Body: Pretendard / Modern Sans</p>
                  <p style={{ fontSize: 11, color: '#71717a' }}>가독성 중심의 한글/영문 본문</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    Meta: JetBrains Mono (00:03:24, GPS)
                  </p>
                  <p style={{ fontSize: 11, color: '#71717a' }}>타임스탬프, 좌표, 음파 상태 표시</p>
                </div>
              </div>
            </div>

            {/* Component Anatomy */}
            <div className="spec-section">
              <div className="spec-section-title">Component Rules</div>
              <ul style={{ paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: '#52525b' }}>
                <li><strong>Full Pill Shape:</strong> 모든 버튼 및 검색창은 <code>border-radius: 9999px</code></li>
                <li><strong>1px Crisp Hairline:</strong> 그림자 최소화, 깨끗한 단선 보더 사용</li>
                <li><strong>Tactile Waveform:</strong> 30개 수직 바 형태의 실제 음파 시각화</li>
                <li><strong>Revisit Prompt:</strong> 장소 재방문 시 부드러운 그린 톤 플로팅 안내</li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
