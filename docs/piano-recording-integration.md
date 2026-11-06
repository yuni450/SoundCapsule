# 녹음과 월별 피아노 연동

기존 제안 계약을 실제 API로 구현했습니다. 최신 저장 구조·API·복구 정책은 [piano.md](./piano.md)를 참고하세요.
피아노 UI·소리·친구·설정·내비게이션은 이번 단계에 추가하지 않았습니다.

홈과 캘린더의 RecordingComposer → useAudioRecorder → saveRecording 흐름과 최소 3초 정책은 그대로입니다.
공통 Recording 모델과 기존 파일의 userId/날짜는 변경하지 않습니다.

| 시각 | 용도 |
| --- | --- |
| recordedAt | 녹음 시작 시각. 캘린더의 현지 날짜 분류 |
| createdAt | 객체 생성 시각. 저장 완료 시각으로 사용하지 않음 |
| updatedAt | 메모/사진 수정 시각. 달성 날짜에 영향 없음 |
| 피아노 savedAt/timeZone/localDate | IDB complete 이벤트에서 확정한 저장 완료 관측 시각과 당시 시간대/날짜 |

녹음 정보/파일/intent를 원자적으로 저장하고 commit 성공 후 독립 피아노 원장에 반영합니다.
삭제는 원장·영수증을 지우지 않으며 기존 파일에서 달성을 소급하지 않습니다.
후속 피아노 쓰기 실패는 pending 이벤트/완료 저널로 재시도하며 파일을 중복 저장하지 않습니다.

이전 제안의 getMonthlyPianoProgress 대신 요청한 getMonthlyPiano를 구현했습니다.
recordSuccessfulRecordingDay와 요일별/전체 활성화/완성 조회, 변경 이벤트, 복구 API를 제공합니다.
기존 피아노 API 부재로 skip했던 시나리오는 실제 검증으로 대체했습니다.
