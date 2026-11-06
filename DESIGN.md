# SoundCapsule (사운드 다이어리) — DESIGN.md

> **Visual Philosophy: Radical Minimalism & Tactile Audio Journal**  
> Ollama Design System의 극단적 미니멀리즘(Pure Black/White, Monospaced Accents, Full Pill Buttons, 1px Crisp Borders)을 계승하여, 소리(Sound) 본연의 울림과 그날의 감정을 담아내는 차분하고 직관적인 디자인 언어입니다.

---

## 1. Brand Identity & Naming (브랜드 & 네이밍 제안)

- **서비스명 제안:** **SoundCapsule** (서브타이틀: *Sound Diary for your moments*)
  - *대체 후보:* **OtoLog (音록)**, **SoundEcho**, **WaveDiary**
- **코어 키워드:** `Acoustic Memory`, `Pure & Intimate`, `Tactile Waveform`, `Geographic Audio`
- **마스코트 / 심볼 컨셉:**
  - Ollama의 라마 캐릭터처럼 심플한 단선 흑백 일러스트 심볼.
  - 음파(Waveform)와 캡슐(Capsule) 알약 형태를 결합한 미니멀 심볼 `(•)`.

---

## 2. Color System (색상 체계)

Ollama의 상징적인 무채색 베이스에, 사운드 레코딩 및 감성 상태를 알리는 정제된 포인트 컬러를 조합합니다.

| 분류 | 토큰명 | Hex 코드 | 용도 및 의미 |
| :--- | :--- | :--- | :--- |
| **Canvas** | `--bg-canvas` | `#FFFFFF` | 주 배경색 (깨끗한 페이퍼 화이트) |
| | `--bg-subtle` | `#F9F9FB` | 서브 섹션, 인풋 필드, 비활성 탭 배경 |
| | `--bg-card` | `#FFFFFF` | 카드 엘리먼트 배경 |
| **Foreground** | `--text-primary` | `#000000` | 헤드라인, 핵심 텍스트, 주 액션 버튼 텍스트 |
| | `--text-secondary`| `#52525B` | 보조 텍스트, 설명문, 카테고리 라벨 |
| | `--text-muted` | `#A1A1AA` | 타임스탬프, 플레이스홀더, 비활성 아이콘 |
| **Border** | `--border-subtle` | `#EEEEF0` | 아주 옅은 구분선 |
| | `--border-default`| `#E4E4E7` | 카드 테두리, 버튼 테두리 (1px hairline) |
| | `--border-strong` | `#18181B` | 포커스 링, 선택된 컴포넌트 테두리 |
| **Action** | `--action-primary`| `#000000` | 주요 CTA 버튼 배경 (Pure Black) |
| | `--action-text` | `#FFFFFF` | 주요 CTA 버튼 글자색 |
| **Accent (Sound)**| `--record-red` | `#EF4444` | 녹음 중 펄스 인디케이터, 정지 버튼 |
| | `--waveform-bar` | `#18181B` | 재생 중 오디오 파형 바 |
| | `--waveform-idle`| `#E4E4E7` | 미재생 오디오 파형 바 |
| | `--accent-sage` | `#10B981` | 장소 핀(지도), 재방문 알림 뱃지 |

---

## 3. Typography (글씨체 및 타이포그래피)

Ollama의 핵심인 **SF Pro Rounded / Plus Jakarta Sans**(디스플레이)와 **Modern Sans**(본문), **JetBrains Mono**(시간·좌표)를 3단 구성합니다.

- **Display / Headings:** `'Plus Jakarta Sans', 'Pretendard Rounded', -apple-system, sans-serif`  
  부드러운 둥근 곡선을 가져 딱딱하지 않고 감성적인 오디오 저널의 느낌을 부여.
- **Body / Interface:** `'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif`  
  가독성과 한글/영문 밸런스가 뛰어난 현대적 고딕.
- **Data / Meta / Time:** `'JetBrains Mono', 'ui-monospace', monospace`  
  녹음 시간(`03:24`), 날짜(`2026.11.06`), 위·경도 좌표, 오디오 비트레이트 표시에 사용하여 테크니컬한 정밀함 표현.

### Type Scale

| 레벨 | 크기 / Line-height | Weight | 용도 |
| :--- | :--- | :--- | :--- |
| **Display** | 36px / 1.2 | ExtraBold (800) | 메인 랜딩 헤드라인, 웰컴 메시지 |
| **Heading 1** | 24px / 1.3 | Bold (700) | 화면 타이틀, 녹음 카드 타이틀 |
| **Heading 2** | 18px / 1.4 | SemiBold (600) | 섹션 헤더, 다이얼로그 타이틀 |
| **Body Large** | 15px / 1.5 | Medium (500) | 리스트 본문, 녹음 메모 |
| **Body Small** | 13px / 1.5 | Regular (400) | 보조 설명, 친구 목록 서브텍스트 |
| **Mono Meta** | 12px / 1.4 | SemiBold (600) | 타임코드, 녹음 길이, 위치 태그 |

---

## 4. Component Rules (컴포넌트 설계 원칙)

### 1) Extreme Pill Shapes (`border-radius: 9999px`)
- 모든 버튼, 검색창, 태그 칩, 오디오 컨트롤 바, 탭 인디케이터는 완전한 타원형(Pill)을 기본 형태로 채택합니다.
- 카드 컨테이너는 넉넉한 둥글기(`border-radius: 20px` ~ `24px`)를 사용하여 손에 쥐는 스마트폰처럼 부드러운 촉감을 전달합니다.

### 2) Ultra-Crisp 1px Border (노 섀도우 지향)
- 무거운 그림자(Drop shadow)를 배제하고 정교한 `1px solid var(--border-default)` 테두리를 사용해 모던한 종이 인쇄물 느낌을 연출합니다.
- 호버 또는 액티브 시 은은한 배경 변색(`background-color: var(--bg-subtle)`) 또는 다크 테두리 강조로 상태를 표현합니다.

### 3) Tactile Audio Waveform (촉각적 오디오 파형)
- 오디오 재생 바는 일반 가로 막대가 아니라, 30~50개의 수직 바로 이루어진 **진짜 음파(Waveform)** 형태로 시각화합니다.
- 녹음 시: 실시간 마이크 입력 볼륨에 반응하여 펄스 애니메이션이 살아 움직입니다.
- 재생 시: 재생 헤드가 지나간 파형은 Black(`--waveform-bar`), 남은 파형은 Light Gray(`--waveform-idle`)로 채워집니다.

---

## 5. Screen UX Flow (5대 핵심 기능 UI/UX 설계)

```
[ 상단 네비게이션 / 뷰 토글 (Web 와이드 ↔ Mobile 앱 뷰) ]
 ├── 1. 홈 · 녹음  : 실시간 파형 + 거대 원터치 녹음 Pill + 입력 시트 (날짜/위치/사진/메모)
 ├── 2. 캘린더     : 월간 날짜 그리드(소리 기록일 도트 표시) + 당일 오디오 카드 리스트 & 인라인 플레이어
 ├── 3. 지도 · 탐색 : 전 세계/로컬 핀 맵 + 핀 탭 사운드 팝업 + [재방문 알림 플로팅 카드]
 ├── 4. 친구 · 공유 : 친구 검색/추가 + 그룹 스페이스 + 그룹 사운드 피드 & 청취
 └── 5. 설정       : 프로필 + 오디오 음질/노이즈캔슬링 옵션 + 알림 및 앱 연동(사진/메모)
```

### 상세 기능별 UX 스펙:

1. **메인 홈 · 녹음 (Home & Record)**
   - 화면 중앙에 대형 오디오 시각화 원형 비주얼라이저 배치.
   - 중앙의 검은색 알약형(Pill) 녹음 버튼: 탭하면 타이머가 시작되며 붉은색 펄스(`REC 00:14`)로 전환.
   - 녹음 종료 즉시 하단에서 **"새로운 소리 캡슐 저장"** 시트가 슬라이드업.
   - *장소 자동 감지(GPS), 시간 자동 기록, 사진 1장 첨부, 한 줄 메모 입력 후 저장 시 캘린더/지도 자동 동기화.*

2. **캘린더 · 날짜별 기록 (Calendar)**
   - 상단 주간/월간 캘린더: 소리가 기록된 날짜 하단에 작은 미니멀 블랙 도트 표기.
   - 특정 날짜 클릭 시 하단에 그날 채집된 소리 카드(Sound Card)들이 나열됨.
   - 카드 내에서 **즉시 재생(Play/Pause) 버튼**, 실시간 음파 진행 바, 함께 남긴 사진 썸네일, 위치 태그가 원스톱으로 제공됨.

3. **지도 · 장소별 기록 (Map & Globe)**
   - 미니멀 흑백/세이지 톤의 모던 지도(또는 3D 인터랙티브 지구본 뷰).
   - 녹음이 등록된 장소마다 사운드 핀 표시. 핀을 누르면 오디오 프리뷰 카드 노출.
   - **재방문 알림 (Revisit Alert):**
     - 사용자가 예전에 녹음했던 장소 반경에 재진입했을 때 상단 플로팅 배너로 등장:
     - *"📍 3개월 전에 이곳을 방문했어요. 그날의 소리를 다시 들어볼까요?"* (즉시 재생 버튼 포함)

4. **친구 · 공유 (Friends & Community)**
   - 상단 검색창: 친구 고유 ID 검색 및 즉시 팔로우.
   - "그룹 (Sound Capsule Groups)": 예) `2026 제주 여행 패밀리`, `퇴근길 일상 사운드`.
   - 그룹원끼리 각자의 소리를 포스팅하고, 이어폰으로 함께 들으며 텍스트/이모지 반응 공유.

5. **설정 (Settings)**
   - **계정**: 아바타, 닉네임, 핸들 ID, 프라이버시 설정.
   - **소리**: 무손실 오디오(FLAC/ALAC), 바람 소리 필터(Wind Noise Reduction), 3D 입체 음향.
   - **알림**: 장소 기반 재방문 알림 ON/OFF, 아침/저녁 다이어리 리마인더, 감성 알림음(차임벨, 물방울 등).
   - **앱 연동**: Apple Photos(촬영 시점 오디오 자동 매칭), Notes/메모, 지도 앱 연동.
