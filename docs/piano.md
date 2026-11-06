# 월별 피아노 데이터 API — 1단계

이 문서는 1단계 데이터 API 설명입니다. 2단계 음표 화면과 연주는 [piano-ui.md](./piano-ui.md)를 참고하세요.
API 진입점은 `src/domain/piano/index.js`이며 새 라이브러리는 추가하지 않았습니다.

## 사용자와 독립 원장

조회 함수의 `{ userId }`를 생략하면 현재 `soundcapsule:session`의 로그인 ID를 사용합니다.
로컬/E2E 세션은 기존 `settings.localUserId`를 사용하며 녹음 저장도 같은 규칙입니다.
기존 파일의 사용자 ID/날짜는 변경하지 않습니다. 명시적 userId 조회는 로컬 데이터 분리이며 서버 권한 검증이 아닙니다.

IndexedDB `soundcapsule`은 버전 3입니다. 기존 recordings/audio/photos/settings는 보존하고 다음을 추가합니다.

| 저장소 | 구조 |
| --- | --- |
| pianoAchievements | `[userId, localDate]` 유일 키. byUserMonth 인덱스 |
| pianoEvents | JSON 문자열 `[userId, recordingId]` 이벤트 ID. byUserState 인덱스 |

달성 항목은 `{ userId, localDate, yearMonth, firstAchievedAt, eventId, recordingId, timeZone }`입니다.
firstAchievedAt은 해당 날짜 성공 이벤트의 가장 이른 완료 시각입니다.
파일을 삭제해도 원장/영수증은 유지합니다. 월 전환은 조회 대상 변경이며 이전 원장을 지우지 않습니다.
기존 파일을 읽어 달성을 소급 생성하지 않습니다.

## 저장 성공 연동

1. 기존 공통 saveRecording에서 3초/빈 Blob 검증
2. 녹음 정보·오디오·달성용 intent를 같은 트랜잭션에 저장
3. IDB complete 이벤트에서 완료 ISO 시각·IANA 시간대·현지 날짜를 한 번 캡처
4. 메모리와 동기 localStorage 완료 저널에 스냅샷을 보완
5. 스냅샷을 pianoEvents의 pending으로 영속화
6. 원장과 applied 영수증을 같은 트랜잭션에 저장
7. 새 날짜일 때만 진행도 변경 알림

recordedAt은 녹음 시작 시각 그대로입니다. createdAt은 객체 생성 시각이므로 달성 시각으로 사용하지 않습니다.
완료 기준은 브라우저가 JS에 전달한 IDB complete 이벤트의 관측 시각입니다.
11/30 23:59 시작·12/1 00:01 완료 시 캘린더는 11/30, 피아노는 12/1입니다.
재시도할 때 날짜/시간대를 현재 기기 설정으로 다시 계산하지 않습니다.
파일 삭제 함수는 pianoAchievements/pianoEvents를 열거나 수정하지 않습니다.

## API 사용법

```js
import {
  PIANO_KEYS, recordSuccessfulRecordingDay,
  getMonthlyPiano, getWeekdayProgress, isKeyUnlocked,
  isAllKeysUnlocked, isMonthlyPianoComplete,
  subscribePianoProgress, retryPendingPianoEvents, getPendingPianoEvents,
} from './domain/piano/index.js';

const month = await getMonthlyPiano('2026-11');
const monday = await getWeekdayProgress('2026-11', 1);
const unlocked = await isKeyUnlocked('2026-11', 1);
const allUnlocked = await isAllKeysUnlocked('2026-11');
const complete = await isMonthlyPianoComplete('2026-11');
const history = await getMonthlyPiano('2026-10', { userId: selectedUserId });
```

요일은 **월=1~일=7**이며 월~일 순서로 반환합니다. PIANO_KEYS는 음계/음높이/파스텔 HEX 색상을 제공합니다.
도(C)/빨강, 레(D)/주황, 미(E)/노랑, 파(F)/초록, 솔(G)/파랑, 라(A)/남색, 시(B)/보라입니다.

월별 반환값은 다음과 같습니다.

```js
{
  userId, yearMonth: '2026-11',
  weekdays: [
    { weekday: 1, uniqueDateCount: 2, filledSlots: 2, maxSlots: 4,
      progressLabel: '2/4', percent: 50, isUnlocked: true /* note, pitch, color 등도 포함 */ },
    // ... 월~일 7개
  ],
  unlockedKeyCount: 1, allKeysUnlocked: false, monthlyComplete: false,
  recovery: { userId, applied: 0, pending: 0, unresolved: [], errors: [] },
}
```

고유 날짜 수가 5라도 표시 칸은 최대 4, 퍼센트는 0/25/50/75/100입니다.
같은 요일 2일부터 isUnlocked=true입니다. 7개가 각 2일인 allKeysUnlocked와 모두 4칸인 monthlyComplete는 다릅니다.

`recordSuccessfulRecordingDay({ userId, recordingId, duration, savedAt, timeZone })`는 저장 흐름에서 자동 호출됩니다.
반환값은 `Promise<{ inserted, localDate, yearMonth, achievement }>`입니다.
실제 commit이 남긴 intent와 일치해야 하므로 과거 파일만 있거나 존재하지 않는 이벤트는 거절합니다.
같은 이벤트 재시도는 원래 영수증을 반환하므로 inserted도 원래 값과 같습니다.
다른 이벤트가 같은 날짜를 달성하면 inserted=false이며 진행도 알림을 발생시키지 않습니다.

## 변경 이벤트와 2단계 화면 연결

```js
const unsubscribe = subscribePianoProgress(({ userId, yearMonth }) => {
  // 화면의 사용자/월과 일치하면 getMonthlyPiano로 재조회
}, { userId: currentUserId, yearMonth: selectedMonth });
// React effect cleanup에서 unsubscribe()
```

이벤트 이름은 `soundcapsule:piano-progress-changed`, 상세값은 `{ userId, yearMonth, localDate }`입니다.
같은 탭 CustomEvent와 다른 탭 BroadcastChannel을 제공하고 동일 탭 중복 수신은 막습니다.
파일 삭제·같은 날짜 추가·동일 이벤트 재시도에는 알림이 없습니다.
채널 차단 환경에서는 같은 탭 알림을 유지하며 화면 복귀 시 재조회해야 합니다.

2단계 UI는 선택 사용자/월을 조회하고 구독 및 focus/visibilitychange에 재조회하세요.
현지 월이 바뀌면 조회 인자를 새 월로 바꾸되 이전 원장을 지우지 마세요.
피아노 오류 복구를 위해 오디오 저장을 다시 호출하면 안 됩니다.

## 실패와 복구

- 피아노 쓰기 실패는 이미 완료된 녹음을 실패로 반환하지 않습니다.
- 확정한 pending 스냅샷은 파일 삭제/페이지 재시작 후에도 원래 날짜로 재시도합니다.
- pending IDB 쓰기 자체가 실패하면 localStorage 완료 저널이 원래 시각을 보존합니다.
- 홈/캘린더 listRecordings 진입/복귀와 피아노 조회 API에서 자동 재시도합니다.
- `retryPendingPianoEvents({ userId }?)`와 `getPendingPianoEvents({ userId }?)`도 제공합니다.
- 자동 무한 반복 타이머는 없습니다. 2단계 UI에서 online/focus 및 수동 재시도를 연결할 수 있습니다.

잔여 위험: 녹음 commit과 완료 시각 관측 사이의 강제 종료, 또는 IDB/localStorage 완료 스냅샷 쓰기가
모두 실패한 뒤 프로세스가 종료되면 정확한 완료 시각을 복구할 수 없습니다.
이때 intent는 남지만 `recovery.unresolved`로 명시하고 날짜를 추정하지 않습니다.
2단계 UI에서 복구 필요 안내/지원 정책을 연결해야 합니다.
recordedAt/createdAt/재시도 날짜로 조용히 소급하지 않습니다. 한 저장소의 일시 실패는 저널/재시도로 복구합니다.
기기 시계 오류와 저장소 전체 삭제·OS 회수는 서버 없이 보증할 수 없습니다.

## 파일 역할과 검증

- `src/domain/piano/model.js`: 날짜·집계·음계/색상
- `src/domain/piano/journal.js`: intent와 완료 저널
- `src/domain/piano/repository.js`: 원장·멱등 영수증 트랜잭션
- `src/domain/piano/events.js`: 변경 알림과 구독
- `src/domain/piano/index.js`: 공개 조회·재시도 API
- `src/storage/database.js`: 기존 IDB 로직 분리, v3 무손실 확장
- `src/storage/recordingUser.js`: 로그인/로컬 소유자 확인
- `src/storage/recordings.js`: 녹음 저장 연동과 진입 복구
- `tests/piano.test.js`, `tests/browser/piano.test.js`: 집계·실제 IDB/복구/날짜/사용자 검증
- `tests/browser/minimumRecording.test.js`: 홈/캘린더 3초와 달성 검증, 기존 skip 제거
- `tests/browser/workflows.test.js`: v3 마이그레이션으로 갱신

실행: `npm test`, `npm run test:browser`, `npm run build`.
검증은 임시 Chrome/가상 마이크이며 실제 휴대폰·OS 재시작·장기 보관은 별도 확인 대상입니다.

최종 검증: 단위 테스트 15개, 브라우저 시나리오 24개 통과, skip/실패 없음, 프로덕션 빌드 통과.
0~5일 집계·2일 활성화·7개 활성화와 100% 구분은 단위 테스트로 확인했습니다.
실제 IDB에서는 같은 날 병렬 저장, 동일 이벤트 재시도, 모든 파일 삭제 후 유지, 새로고침,
로그인 사용자/다른 탭 분리, 완료 월 경계, 보존 데이터를 다른 시간대로 로드하는 경우,
두 종류의 쓰기 실패와 미확정 이벤트 진단을 검증했습니다.
홈·캘린더의 2초 미달성/3초 성공 달성 및 기존 재생·다운로드·삭제·사진·메모 회귀 검증도 포함합니다.
