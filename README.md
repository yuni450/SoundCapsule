# SoundCapsule (사운드 다이어리) — UI/UX 디자인 시스템 & 프로토타입

> **Visual Philosophy:** Radical Minimalism & Tactile Audio Journal (Ollama DESIGN.md Reference)  
> 친구들의 웃음소리, 여행지의 파도 소리처럼 그날의 분위기를 담은 소리를 기록하고, 날짜와 장소를 따라 다시 듣는 크로스플랫폼(Web & Mobile App) 서비스입니다.

---

## 🎨 디자인 시스템 요약 (`DESIGN.md` 준수)

1. **컬러 팔레트 (Monochrome + Accent)**
   - **Canvas & Card:** Pure White (`#FFFFFF`), Subtlest Gray (`#F7F7F8`)
   - **Text & Foreground:** Deep Black (`#09090B`), Zinc Gray (`#52525B`, `#A1A1AA`)
   - **Border:** 1px Hairline (`#E4E4E7`) — 과도한 그림자를 배제한 모던한 종이 질감
   - **Recording & Audio Accent:** Active Pulse Red (`#EF4444`), Revisit Sage Green (`#10B981`)
2. **타이포그래피**
   - **Headings & Titles:** `Plus Jakarta Sans` / `Pretendard Rounded` (부드럽고 감성적인 라운디드 고딕)
   - **Body:** `Pretendard` (깔끔한 한글/영문 현대적 산세리프)
   - **Time & Coordinates:** `JetBrains Mono` (`00:03:24`, GPS 좌표 등 정밀한 오디오 데이터 표현)
3. **컴포넌트 룰**
   - **Extreme Pill Shape:** 버튼, 인풋, 태그 칩, 오디오 컨트롤은 완전한 타원형(`border-radius: 9999px`) 채택
   - **Tactile Waveform:** 30~50개의 수직 바로 이루어진 실제 오디오 음파 시각화

---

## 📱 5대 핵심 화면 UX 흐름

| 화면 / 기능 | 핵심 UI 인터랙션 |
| :--- | :--- |
| **1. 메인 홈 · 녹음** | 실시간 오디오 파형 반응, 대형 원터치 녹음 Pill 버튼, 녹음 종료 즉시 슬라이드업되는 **'기록 정보 입력 시트'** (날짜/시간/장소 GPS 자동 감지, 사진 첨부, 캘린더 & 지도 자동 반영) |
| **2. 캘린더 · 날짜별 기록** | 월간 캘린더 (소리가 기록된 날짜에 블랙 도트), 날짜 선택 시 당일 소리 카드 리스트, 카드 내 **인라인 즉시 재생/일시정지 버튼**, 파형 진행률, 사진 썸네일, 감성 메모 |
| **3. 지도 · 장소별 기록** | 인터랙티브 핀 맵, 핀 클릭 시 오디오 팝업 재생, **'재방문 알림 토스트'** (*"📍 3개월 전에 이곳을 방문했어요. 그날의 소리를 다시 들어볼까요?"*) |
| **4. 친구 · 공유** | 상대방 ID 검색 및 추가, 그룹 생성 & 초대 수락, 그룹 타임라인 내 소리 공유 및 코멘트 재생 |
| **5. 설정** | 프로필 및 계정 관리, 소리 옵션(바람 소리 필터, 무손실 Hi-Fi), 알림(재방문 알림 토글, 물방울 알림음), 앱 연동(사진/메모/음악 앱) |

---

## 🚀 로컬 실행 방법

```bash
# 개발 서버 시작 (웹/앱 뷰어 실행)
npm run dev
```

브라우저 상단의 **[📱 모바일 앱 뷰]** 와 **[💻 웹 데스크톱 뷰]** 버튼을 통해 기획안에 적힌 모바일 앱과 반응형 웹 대시보드 화면을 자유롭게 전환하며 테스트할 수 있습니다.
우측 상단의 **[📐 DESIGN.md 스펙 보기]**를 누르면 피그마 스타일의 실시간 컬러/폰트/컴포넌트 가이드가 오버레이됩니다.
