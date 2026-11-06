# 녹음 최소 시간과 A 담당 피아노 연동 계약 (제안)

## 현재 코드 확인 결과

현재 브랜치에는 `src/domain/piano/`, `PianoHub.jsx`, `src/features/piano/`나
피아노 달성 기록 API/저장소가 없습니다. 따라서 피아노의 저장·집계·화면은 구현하지 않았고,
아래 계약도 아직 호출되는 API가 아닙니다. A가 API를 제공한 뒤 연결해야 합니다.

홈/캘린더는 `RecordingComposer` → `useAudioRecorder` → `saveRecording`을 공유합니다.
훅은 `performance.now()`의 시작/종료 차이로 초를 계산합니다.
표시 타이머와 무관하게 3초 미만이면 초안을 만들지 않고
`최소 3초 이상 녹음해야 저장할 수 있어요!`를 표시합니다.
저장 API에서도 같은 정책을 검사하므로 UI 외 호출로 3초 제한을 우회할 수 없습니다.
기존 3초 미만 기록은 삭제/변환하지 않고 그대로 조회·재생·사진/메모 편집·삭제할 수 있습니다.

### IndexedDB와 날짜 의미

DB `soundcapsule` 버전 2의 `recordings`(Recording), `audio`(실제 Blob),
`photos`(사진 Blob), `settings`(로컬 사용자 ID)를 그대로 사용합니다.
녹음 정보/파일은 동일한 트랜잭션에 저장하며, `saveRecording()`은 **트랜잭션 완료 후** 반환합니다.
삭제는 해당 정보·오디오·첨부 사진만 같은 트랜잭션에서 지웁니다.

| 필드/시각 | 실제 의미 |
| --- | --- |
| recordedAt | MediaRecorder.start 직전의 ISO 시각. 캘린더는 이 시각의 현지 날짜로 분류 |
| createdAt | createRecording이 객체를 만든 시각. DB 트랜잭션 완료보다 앞서므로 실제 저장 완료 시각과 같다고 보장할 수 없음 |
| updatedAt | 최초에는 createdAt. 메모/사진 수정 시 갱신되므로 달성 날짜로 사용할 수 없음 |
| savedAt (연동 이벤트 제안 필드) | await saveRecording 반환 직후 관측한 실제 저장 완료 시각. Recording 모델에 임의로 추가하지 않음 |

## A에게 요청할 API

제안 이름이며, 최종 이름/경로/타입은 A와 합의해야 합니다.

```js
recordSuccessfulRecordingDay({
  userId,       // 저장 결과 Recording.userId와 동일한 소유자
  recordingId,  // 저장 결과 Recording.id, 재시도에도 동일한 이벤트 ID
  savedAt,      // await saveRecording 완료 직후 캡처한 ISO 문자열
  timeZone,     // 같은 순간 Intl.DateTimeFormat().resolvedOptions().timeZone
  duration,     // 저장된 실제 초. 반드시 유한수 >= 3
});
// Promise<{ localDate: 'YYYY-MM-DD', monthKey: 'YYYY-MM', inserted: boolean }>
// inserted=false도 정상 성공: 해당 날짜가 이미 인정된 경우
// 저장 실패는 reject. 재시도는 동일 payload 사용
```

피아노 화면에서 읽을 월별 API도 A가 제공해야 합니다. 제안 계약은
`getMonthlyPianoProgress({ userId, monthKey: 'YYYY-MM' })`이며,
`Promise<{ monthKey, weekdays: [{ weekday, uniqueDateCount, filledSlots, percent, active }] }>`를 반환합니다.
weekdays는 월~일 순서이고 weekday는 월=1~일=7로 통일하는 안을 제안합니다.
원장의 고유 날짜 수와 최대 4칸으로 제한된 표시값을 구분해야 합니다.
이 읽기 API 역시 이번 변경에서 구현하지 않습니다.

현재 저장소 userId는 `settings.localUserId`에서 생성한 로컬 ID입니다.
로그인 세션 ID와 피아노 소유자 ID의 대응은 A와 확인해야 하며, 임의로 App/인증 코드를 수정하지 않았습니다.

호출자는 녹음 저장 성공을 먼저 확정하고, 반환 직후 savedAt/timeZone을 한 번 캡처합니다.
권한 거부·취소·오류·빈 Blob·3초 미만·저장 실패 경로에서는 호출하지 않습니다.
초안/미리 듣기 단계에서도 호출하지 않습니다.
피아노 호출은 오디오 저장 try/catch와 분리해, 피아노만 실패한 경우 녹음을 다시 저장하지 않도록 합니다.

### A가 보장할 달성 데이터 규칙

- 달성 원장은 녹음 목록과 독립 보관. 녹음 ID로 파일을 다시 조회하지 않아도 재시도할 수 있어야 함
- 파일 삭제·메모/사진 수정은 달성 원장을 삭제하거나 날짜를 변경하지 않음
- `(userId, localDate)`는 유일. 같은 날 여러 성공 녹음은 1일만 인정
- 동일 `(userId, recordingId)` 재시도는 멱등 처리. 재시도 시각이나 새 시간대로 달성일을 다시 계산하지 않음
- `localDate`는 captured savedAt을 captured timeZone으로 변환한 현지 날짜. recordedAt/createdAt을 대신 사용하지 않음
- 원장에는 사용자·고유 날짜와 최초 성공 이벤트의 시각/시간대 등 재시도에 필요한 근거를 보존
- 선택한 월의 원장만 조회하여 월~일 순서로 고유 날짜 수 집계
- 요일별 표시 칸은 `min(고유 날짜 수, 4)`, 퍼센트는 칸 수 × 25, 건반 활성화는 고유 날짜 수 >= 2
- 월 전환은 조회 대상 변경. 이전 달 원장을 초기화/삭제하지 않음. 다섯 번째 같은 요일도 표시는 4/4

예: 11/2 월요일 세 파일 저장 → 월 1/4. 11/9 월요일 저장 → 월 2/4 및 도 활성화.
11/2의 파일을 모두 삭제해도 월 2/4와 활성화는 유지되어야 합니다.
23:59 시작해 다음 날 00:01 저장 완료하면 캘린더는 시작한 날, 피아노는 저장 완료한 날입니다.

## 실패와 재시도 제안 (아직 미구현)

1. 오디오 저장이 실패하면 피아노 이벤트를 만들지 않습니다.
2. 오디오 저장 성공 후 피아노만 실패하면 “녹음 저장 완료, 피아노 반영 대기”로 구분합니다.
   녹음/원본을 삭제하거나 저장 버튼을 다시 실행하지 않습니다.
3. 캡처한 payload를 독립적인 영속 pending/outbox에 보관하고, 다음 앱 진입/온라인 복귀에 제한된
   지수 백오프와 수동 재시도를 제공합니다. 삭제 뒤에도 pending payload는 남아 있어야 합니다.
4. A는 완료 응답을 받은 이벤트만 pending에서 제거하도록 멱등 API를 제공해야 합니다.
5. 별도 API 두 개를 순서대로 호출하는 것만으로 원자성이 생기지는 않습니다.
   오디오 commit과 완료 시각 캡처/pending 저장 사이 앱 종료 가능성이 남습니다.
   A와 저장 계층의 이벤트 영속화/복구 정책을 함께 확정해야 하며, 복구 시 정확한 저장 완료 시각을
   알 수 없다면 recordedAt 또는 재시도 시각으로 조용히 대체하면 안 됩니다.

이번 변경에서는 pending 저장소, 피아노 저장소/집계, 가짜 API나 완료 시각 필드를 추가하지 않았습니다.
따라서 **삭제 후 달성 보존 등 피아노 연동은 미완료**입니다.
기존 recordedAt/createdAt을 달성 시각으로 잘못 사용하는 연결도 하지 않았습니다.

## 검증 범위

- 단위 테스트: 2.999초 거절, 정확히 3초 허용, NaN/무한수/문자열 거절
- 브라우저: 홈/캘린더에서 실제 약 2초 종료 시 저장 불가, 약 3.2초 종료 시 저장 성공
- 표시 타이머 숫자 변경/업데이트 중단에도 실제 경과 시간으로 판정
- 저장 API 직접 호출에서 짧은 녹음 거절, 기존 짧은 기록 보존은 기존 마이그레이션 회귀 테스트로 확인
- 기존 기능 회귀 테스트의 성공 녹음 대기 시간을 새 3초 정책에 맞게 변경
- 피아노 필요 항목 5개는 skip 사유를 명시: 같은 날 중복, 삭제 후 유지, 2일 건반 활성화,
  월 전환 보존, 자정 전후 저장 완료 날짜. API 부재로 검증 완료가 아님

실행: `npm test`, `npm run test:browser`, `npm run build`.
브라우저 검증은 임시 Chrome 프로필/가상 마이크이며 실제 휴대폰 음질·OS 동작 확인은 별도입니다.

최종 결과: 단위 테스트 8개 통과, 브라우저 테스트 16개 통과/피아노 관련 5개 skip,
실패 0개, 프로덕션 빌드 통과. 실제 피아노 연동 성공을 의미하지 않습니다.

### 이번 변경 파일

- `src/lib/recordingPolicy.js`: 공통 최소 시간과 안내 문구
- `src/features/home/useAudioRecorder.js`: 짧은 녹음 초안 차단
- `src/storage/recordings.js`: 신규 저장 진입점에서 동일 정책 검사
- `tests/recordingPolicy.test.js`: 3초 경계/잘못된 값 단위 테스트
- `tests/browser/minimumRecording.test.js`: 홈/캘린더 2초·3초 및 저장 API 테스트, 미완료 피아노 테스트 구분
- `tests/browser/regressions.test.js`, `tests/browser/workflows.test.js`: 기존 성공 시나리오를 3초 정책에 맞게 조정
- `docs/piano-recording-integration.md`: 코드 분석과 A 연동 제안/미완료 항목
