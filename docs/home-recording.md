# 메인홈 녹음과 로컬 저장

## 실행

```sh
npm ci
npm run dev
```

PC에서는 터미널의 localhost 주소를 엽니다. 실제 마이크 사용 권한을 허용한 뒤
녹음 → 종료 → 미리 듣기 → 제목 입력 → 저장 순서로 사용합니다.
장소명과 메모는 선택이며 녹음 날짜와 길이는 자동으로 기록됩니다.

마이크 API는 HTTPS 또는 localhost 같은 보안 컨텍스트가 필요합니다.
휴대폰에서 PC의 HTTP LAN IP로 접속하면 마이크 기능이 제한될 수 있으므로
모바일 테스트는 HTTPS로 제공되는 환경에서 진행하세요.
지원되는 MIME 형식을 검사해 WebM/Opus, MP4, WebM, Ogg 순으로 선택하고,
일치하는 형식이 없으면 브라우저 기본 형식을 사용합니다.
잠금 화면, 전화 수신, 백그라운드 전환 시 동작은 기기와 브라우저에 따라 다를 수 있습니다.
현재 경과 시간은 벽시계 기준이며 백그라운드에서 실제 녹음된 오디오 길이와 차이가 날 수 있습니다.

## 파일 역할

- `src/features/home/Home.jsx`: 녹음 UI, 정보 입력, 저장과 저장된 기록 재생
- `src/features/home/useAudioRecorder.js`: 마이크 권한, MediaRecorder, 타이머, 리소스 정리
- `src/features/home/AudioPlayer.jsx`: Blob의 임시 재생 URL 생성과 해제
- `src/features/home/home.css`: 홈 전용 스타일. `.sc-home`의 CSS 변수로 색상 변경
- `src/storage/recordings.js`: IndexedDB 접근과 공통 모델 생성. 다른 탭에서도 재사용 가능
- `src/App.jsx`: 메인홈 연결
- `src/styles.css`: 기존 준비 화면용 전역 레이아웃을 제거하고 기본 초기화만 유지

## 저장 계약

기존 `src/models/recording.js`는 변경하지 않습니다.
IndexedDB `soundcapsule` 버전 1에 다음 객체 저장소를 사용합니다.

- `recordings`: 공통 Recording 객체. `id`가 키
- `audio`: 실제 오디오 Blob. Recording의 `id`가 키
- `settings`: 브라우저 로컬 소유자 ID. 로그인 계정은 아님

파일과 정보는 동일한 트랜잭션에서 추가합니다. 저장 실패 시 둘 다 취소되고,
화면의 녹음 초안은 유지되어 다시 저장할 수 있습니다.
각 카드 오른쪽의 ⋯ 버튼에서 다운로드와 삭제를 선택할 수 있습니다.
메뉴는 바깥 클릭, Escape 또는 메뉴 밖으로 포커스를 이동하면 닫힙니다.
방향키와 Home/End로 항목을 이동할 수 있으며, Escape로 닫으면 ⋯ 버튼으로 포커스가 돌아갑니다.
고정 위치와 화면 경계 보정으로 카드 밖에서도 메뉴가 잘리지 않도록 표시합니다.
다운로드는 저장된 Blob을 읽어 제목과 실제 MIME 형식에 맞는 확장자(WebM, M4A 등)로 제공합니다.
파일명에서 운영체제가 허용하지 않는 문자는 밑줄로 바꾸며, 앱의 원본 데이터는 유지합니다.
다운로드 실패 시 카드에 안내하고 재시도할 수 있습니다.
모바일의 실제 저장 위치와 파일 저장/열기 동작은 브라우저 설정에 따라 다를 수 있습니다.
메뉴의 삭제 항목은 `이 녹음을 삭제하시겠습니까?` 확인 후 동작합니다.
`deleteRecording(id)`는 해당 ID의 정보와 오디오만 동일한 트랜잭션으로 삭제하며,
완료 후 목록과 개수가 즉시 갱신됩니다. 취소하거나 삭제에 실패하면 기록이 유지됩니다.
재생 중인 카드를 삭제하면 플레이어가 제거되고 임시 재생 URL도 해제됩니다.
현재 공개 범위는 `private`, 그룹은 null, 사진은 빈 배열,
좌표는 둘 다 null입니다. 장소명만 입력받으며 위치 권한은 요청하지 않습니다.

`audioUrl`은 `indexeddb://soundcapsule/audio/<id>` 형식의 식별자입니다.
브라우저가 직접 재생할 URL은 아니며, 저장된 Blob을 읽어 임시 URL로 바꿔야 합니다.
`blob:` URL은 데이터베이스에 저장하지 않습니다.

```js
import { listRecordings, getRecordingAudio } from '../storage/recordings.js';

// 캘린더와 지도: recordedAt, location 등을 같은 데이터 구조로 조회
const recordings = await listRecordings();

// 사용자가 실제 기록을 선택한 이벤트 안에서 재생
const blob = await getRecordingAudio(selectedRecording.id);
if (blob) {
  const url = URL.createObjectURL(blob);
  audioElement.src = url;
  // 재생 UI를 닫거나 다른 파일로 교체할 때 URL.revokeObjectURL(url) 호출
}
```

저장소는 같은 기기·브라우저·사이트 주소(origin)에서만 공유됩니다.
다른 기기/브라우저와 동기화되지 않으며, 브라우저 데이터 삭제·저장소 정리 시 유실될 수 있습니다.
시크릿 모드에서는 저장이 제한되거나 세션 종료 시 삭제될 수 있습니다.
서버, 로그인, 친구/그룹 공유, 캘린더/지도 화면은 이번 구현 범위에 포함하지 않습니다.

## 직접 확인할 항목

1. 마이크 허용 후 3초 이상 녹음 → 종료 → 미리 듣기에서 실제 소리 확인
2. 권한 거부 후 안내 확인 → 사이트 권한 변경 후 재시도
3. 다시 녹음 시 확인 창 취소하면 초안 유지, 확인하면 새 녹음 시작
4. 제목 없이 저장 불가, 제목 입력 후 연속 클릭해도 한 번만 저장
5. 새로고침 후 제목·장소·메모와 녹음 재생 확인
6. 저장소 접근 실패 시 안내 및 저장 전 초안 유지 확인
7. 모바일 Safari/Chrome에서 HTTPS 접속 후 녹음과 재생 확인

## 구현 시 검증 결과

- `npm run build` 통과
- 임시 Chrome 프로필과 가상 마이크로 실제 MediaRecorder 녹음·미리 듣기 검증
- IndexedDB 저장 후 페이지 새로고침과 오디오 재생 검증
- 저장 공간 부족 오류 주입 시 메타데이터/오디오 동시 롤백 및 재저장 검증
- 권한 거부, 권한 대기 취소 후 늦게 도착한 스트림 해제, 미지원 브라우저 안내 검증
- IndexedDB 사용 불가 시 오류 안내와 녹음 초안 유지 검증
- 녹음 종료 후 마이크 트랙 해제, 다시 녹음 확인/취소 검증
- 320px, 390px, 1440px에서 가로 넘침 없음 확인
- 삭제 확인창 취소 시 두 기록 유지, 확인 시 선택한 기록의 정보/오디오만 삭제 검증
- 오디오 삭제 실패 주입 시 메타데이터도 롤백되고 재시도 가능한지 검증
- 삭제 후 개수/빈 목록 갱신, 새로고침 후 유지, 다른 녹음 재생 및 재생 URL 해제 검증
- ⋯ 메뉴 바깥 클릭/Escape 닫기, 포커스 복귀, 방향키 조작 및 화면 경계 내 배치 검증
- 다운로드 파일명/확장자와 실제 파일 바이트가 원본 Blob과 일치하는지 검증
- 다운로드 성공/실패 모두 원본 정보와 오디오 유지, 이후 재생 가능 확인

자동 검증의 마이크 입력은 가상 장치입니다. 실제 마이크 음질 및 모바일 Safari/Chrome의
실기기 녹음·권한·백그라운드 동작은 위 수동 항목으로 확인해야 합니다.

API 참고: [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder),
[getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
