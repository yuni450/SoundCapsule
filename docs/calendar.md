# 소리 달력

하단의 홈·녹음 / 캘린더 버튼으로 전환합니다. 월 이동, 오늘로 돌아가기,
녹음일의 초록 점, 선택한 날의 녹음 목록을 제공합니다.
오늘을 선택하면 홈과 동일한 녹음 컴포넌트에서 시작·종료·미리 듣기·제목/장소/메모 입력·저장을
캘린더 안에서 할 수 있습니다. 과거/미래 날짜는 저장된 기록을 조회·편집하는 용도로만 사용합니다.
날짜는 공통 모델의 `recordedAt`을 브라우저의 **현지 시간**으로 변환해 분류합니다.
UTC 문자열을 단순히 잘라 날짜로 사용하지 않습니다.

## 파일

- `src/features/calendar/Calendar.jsx`: 월별 달력, 날짜 선택, 조회/로딩/오류/빈 상태
- `src/features/calendar/calendarDates.js`: 현지 날짜 키와 월별 날짜 계산
- `src/features/calendar/RecordingDetails.jsx`: 기존 AudioPlayer 재사용, 메모 편집, 사진 추가/보기/삭제
- `src/features/calendar/calendar.css`: 베이지·초록색 캘린더 전용 반응형 스타일
- `src/features/home/RecordingComposer.jsx`: 홈·캘린더 공통 녹음 UI/정보 입력/저장 흐름
- `src/features/home/useAudioRecorder.js`: 실제 녹음 시작 시각 자동 기록, 권한 요청 전후 날짜 조건 확인
- `src/features/home/formatDuration.js`: 녹음 길이 표시 공통 함수
- `src/storage/recordings.js`: 기존 DB 조회 재사용, 사진 저장과 메모 변경 API, 변경 알림
- `src/App.jsx`, `src/app.css`: 홈·캘린더 전환과 하단 탐색
- `src/features/home/Home.jsx`: 녹음 중이거나 저장 전인 경우 화면 이동 확인에 필요한 상태 전달
- `tests/calendarDates.test.js`: 윤년, 월 길이, 연도 경계, 서울/LA의 날짜 구분 검증

## 저장 규칙

IndexedDB `soundcapsule`을 버전 1에서 2로 올리면서 기존 `recordings`, `audio`,
`settings`는 그대로 보존하고 `photos` 저장소만 추가합니다.
공통 모델은 변경하지 않습니다.

- `memo`: 500자 이내, 저장 시 기존 녹음의 최신 데이터를 읽고 메모만 변경
- `photoUrls`: 기존 문자열 배열 형식 유지. 로컬 사진은 `indexeddb://soundcapsule/photos/<id>` 식별자
- `photos`: 위 ID를 키로 실제 이미지 Blob 저장. 사진과 녹음의 photoUrls를 같은 트랜잭션으로 갱신
- `updatedAt`: 메모 또는 사진을 변경할 때 갱신. recordedAt과 오디오는 유지
- 사진당 최대 10MB, SVG 제외 이미지 형식 지원. HEIC 등 미지원 형식은 브라우저에 따라 미리 보기가 불가능할 수 있음
- 녹음 삭제 시 해당 녹음의 사진 Blob도 정보/오디오와 함께 삭제. 다른 녹음에는 영향 없음

API: `updateRecordingMemo(id, memo)`, `addRecordingPhotos(id, files)`,
`getRecordingPhoto(photoUrl)`, `deleteRecordingPhoto(id, photoUrl)`.
`listRecordings()`와 `getRecordingAudio(id)`는 기존 API 그대로 사용합니다.

캘린더는 진입 시, 같은 탭/다른 탭의 변경 알림 수신 시, 브라우저 화면 복귀 시 재조회합니다.
저장하지 않은 메모나 녹음이 있으면 화면 이동 전에 확인합니다.
저장 중에는 화면 이동을 막습니다. 메모 변경은 저장 버튼을 눌러야 보관됩니다.

## 실시간 녹음의 날짜 규칙

- 날짜/시간 입력이나 수정 UI가 없으며 선택한 날짜를 녹음 시각으로 저장하지 않습니다.
- `recordedAt`은 `MediaRecorder.start()` 직전에 생성한 `new Date().toISOString()` 값입니다.
- 저장 버튼을 누른 시각은 createdAt/updatedAt에 반영되고, recordedAt은 초안의 시작 시각 그대로입니다.
- 오늘 여부는 기기 현지 날짜로 비교하고 마이크 권한 요청 전/후 모두 검사합니다.
- 자정을 넘긴 진행 중 녹음/초안은 잃지 않도록 계속 표시하여 종료/저장할 수 있습니다.
  기존 초안의 다시 녹음은 막고, 저장 후에는 시작한 날짜의 목록에 나타납니다.
  새 녹음은 새 오늘 날짜를 선택해야 시작할 수 있습니다.
- 홈/캘린더는 같은 IndexedDB 변경 알림을 구독해 목록과 점을 갱신합니다.
  저장된 기존 기록의 recordedAt은 변경하지 않습니다.

사진을 누르면 새 탭에서 크게 봅니다. 사진 미리 보기와 재생용 object URL은 제거 시 해제합니다.
새로고침 후에도 실제 Blob과 메모는 유지되지만, 브라우저 데이터 삭제 시 함께 사라집니다.
DB 업그레이드가 다른 탭 때문에 막히면 다른 SoundCapsule 탭을 닫고 다시 시도하세요.

## 검증 명령과 수동 확인

```sh
node --test tests/calendarDates.test.js
npm run build
```

홈에서 녹음 후 캘린더에 점과 기록이 보이는지, 이전/다음 달과 오늘 이동,
사진 추가·새로고침·사진 삭제, 메모 저장·새로고침, 홈에서 녹음 삭제 후 달력 반영을 확인하세요.
실제 모바일 마이크는 HTTPS/localhost 조건과 브라우저 권한이 필요합니다.
친구·그룹·설정, 로그인·서버, 공통 모델은 변경하지 않습니다.

## 구현 검증 결과

- 날짜 계산 테스트 6개(자정/연말 경계 포함)와 프로덕션 빌드 통과
- 임시 Chrome 프로필에서 v1 DB를 생성하고 v2 업그레이드 후 정보/오디오/사용자 ID 보존 검증
- 가상 마이크 녹음 → 홈 저장 → 캘린더 점/목록 표시와 기존 AudioPlayer 재생 검증
- 메모와 사진 추가/조회/삭제, 저장 실패 시 롤백과 재시도, 새로고침 후 유지 검증
- 다른 탭의 메모 변경 반영, 홈에서 녹음 삭제 후 사진 Blob 정리와 캘린더 갱신 검증
- 저장 전 메모의 날짜/화면 이동 취소, 320px/390px/1440px에서 가로 넘침 없음 확인
- 기존 메인홈 녹음/저장/재생/다운로드/삭제 및 실패 복구 회귀 검증 통과
- 홈/캘린더에서 실제 시작 ISO 시각 저장, 현지 시간 표시, 과거/미래 녹음 UI 미노출 검증
- 제어된 시계로 자정 전 시작·자정 후 저장, 권한 대기 중 자정 경과, 날짜 이동 취소 검증

실제 모바일 Safari/Chrome과 기기 마이크는 자동 검증에 포함하지 않았습니다.
