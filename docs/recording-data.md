# 공통 녹음 데이터 사용법

메인홈, 캘린더, 지도는 `src/models/recording.js`의 `Recording` 구조를 공유합니다.
JavaScript의 JSDoc으로 필드와 타입을 설명하며, TypeScript나 추가 라이브러리는 사용하지 않습니다.
파일 업로드, 데이터 저장, 공개 범위의 접근 권한 처리는 각 기능/백엔드에서 별도로 구현해야 합니다.
이 모듈을 import하는 것만으로 데이터가 생성되지는 않습니다.

| 필드 | 형식 및 규칙 |
| --- | --- |
| id | 고유 문자열. 생성 함수에서 생략하면 UUID 자동 생성 |
| userId | 필수 사용자 ID 문자열 |
| title | 필수 제목 문자열 |
| audioUrl | 필수 오디오 URL 또는 저장소 경로 문자열 |
| recordedAt | 실제 녹음 날짜/시간. `Date.toISOString()`으로 만든 UTC 문자열 |
| duration | 초 단위 0 이상 숫자. 소수 허용 |
| location | `{ name, latitude, longitude }`. 생략 시 이름은 빈 문자열, 좌표는 둘 다 null |
| photoUrls | 사진 URL 또는 경로 문자열 배열. 기본 `[]` |
| memo | 메모 문자열. 기본 빈 문자열 |
| visibility | `private`(기본), `friends`, `group` |
| groupId | 기본 null. `group`일 때 필수 문자열, 그 외에는 null |
| createdAt | UTC ISO 문자열. 생략 시 생성 함수 호출 시각 |
| updatedAt | UTC ISO 문자열. 생략 시 createdAt과 동일 |

위도는 -90~90, 경도는 -180~180이며 숫자 0도 유효합니다.
좌표가 없으면 반드시 둘 다 null로 지정합니다. 장소명만 기록하는 것도 가능합니다.
location을 직접 전달할 때는 세 필드를 모두 포함하세요.
빈 제목, 공백뿐인 ID/파일 경로, 문자열로 된 숫자, 유효하지 않은 날짜는 허용하지 않습니다.
경로의 실제 존재나 ID의 저장소 내 중복 여부는 이 모듈에서 확인하지 않습니다.

## 메인홈: 실제 녹음 결과로 데이터 생성

아래 코드는 사용 패턴이며 실행되는 샘플 데이터는 포함하지 않습니다.
각 변수는 실제 로그인, 녹음, 파일 저장, 입력 폼에서 받은 값을 사용합니다.
페이지 파일 위치에 맞게 상대 import 경로를 조정하세요.

```js
import { createRecording } from '../models/recording.js';

// 실제 녹음 및 파일 저장을 완료한 이벤트 핸들러 안에서 호출
const recording = createRecording({
  userId: currentUser.id,
  title: titleInput,
  audioUrl: savedAudioUrl,
  recordedAt: recordingStartedAt.toISOString(),
  duration: recordedDurationSeconds,
});
// recording을 팀에서 합의한 상태 관리/저장 함수에 전달
```

잘못된 입력이면 `TypeError`가 발생합니다. `catch (error)`에서
`error.errors`의 필드별 메시지를 폼에 표시할 수 있습니다.
ID 자동 생성은 HTTPS 또는 localhost의 `crypto.randomUUID()`를 사용합니다.

## 캘린더와 지도: 같은 기록 검증 및 읽기

```js
import { validateRecording } from '../models/recording.js';

const { valid, errors } = validateRecording(receivedRecording);
if (valid) {
  // 캘린더: 사용자 로컬 시간으로 표시 (날짜 그룹화도 같은 시간대 사용)
  const dateLabel = new Date(receivedRecording.recordedAt).toLocaleDateString();

  // 지도: 좌표가 없는 기록은 마커를 만들지 않음. 좌표 0을 배제하지 않음.
  const { latitude, longitude } = receivedRecording.location;
  const hasCoordinates = latitude !== null && longitude !== null;
  // dateLabel 및 hasCoordinates를 각 화면에서 사용
} else {
  console.error(errors);
}
```

`validateRecording`은 완성된 기록의 모든 필드를 검사하고 입력을 수정하지 않습니다.
수정 시에는 기존 기록을 복사하고 `updatedAt: new Date().toISOString()`을 갱신한 뒤 검사하세요.
`recordedAt`은 녹음한 시각으로 유지합니다. 임시 `blob:` URL을 사용한다면 브라우저 수명에
종속되므로 공유/영구 보관 전에 저장된 파일 주소로 교체해야 합니다.
