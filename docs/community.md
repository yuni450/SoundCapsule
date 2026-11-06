# 친구·그룹·설정 (3단계)

## 현재 구현 범위

실제 서버가 없는 **동일 브라우저 로컬 계정용 구현**이다. 앱에는 데모 사용자를 생성하지 않는다. 회원가입으로 등록된 계정만 검색되며, 비밀번호/해시는 서비스 응답에 포함하지 않는다. 다른 브라우저·기기로 초대 코드를 보내도 가입하거나 녹음을 공유할 수 없다. 원격 메시지나 실시간 서버 알림을 구현한 것으로 보아서는 안 된다.

기존 데모 친구/그룹 localStorage 키는 삭제하지 않지만, 실제 친구 관계나 그룹 권한으로 가져오지 않는다. 기존 녹음·사진·메모·피아노 원장은 유지한다. IndexedDB v4 업그레이드는 기존 스토어를 삭제하지 않고 아래 스토어만 추가한다.

| 스토어 | 키 | 의미 |
| --- | --- | --- |
| communityFriends | [a,b] (정렬된 사용자 ID) | 수락이 완료된 양방향 관계 |
| communityRequests | [fromId,toId] | 아직 수락하지 않은 요청 |
| communityGroups | id | 이름, 그룹장, 무작위 UUID 초대 코드 |
| communityMembers | [groupId,userId] | 그룹장/구성원 역할 |

## 화면과 서비스 계약

`src/services/community.js`는 비동기 Promise API다. 호출자 ID를 파라미터로 받지 않고 현재 로컬 세션을 읽는다. 변경 성공 후 같은 탭 이벤트/BroadcastChannel로 재조회하며, 포커스 복귀 시에도 다시 읽는다. 조회 도중 계정이 바뀌면 응답을 거부한다.

- `searchLocalUsers(query)` → `{id,name}[]`
- `getFriendState()` → `{friends,incoming,outgoing}`
- `requestFriend(targetId)` / `respondToFriend(fromId,accept)` / `removeFriend(targetId)`
- `getFriendRecordings(targetId)` → 수락된 친구의 `visibility: friends` 기록만
- `createGroup(name)` → 그룹 (그룹장만 inviteCode 포함)
- `listGroups()` → 내가 속한 그룹만
- `joinGroup(inviteCode)` → groupId (중복 가입은 멱등)
- `getGroup(groupId)` → 그룹/구성원/그룹 공유 녹음; 구성원만 접근
- `leaveGroup(groupId)` → 마지막 구성원이 나가면 그룹 메타데이터만 삭제; 그룹장은 남은 구성원 중 ID 정렬순 첫 구성원에게 이전
- `setRecordingVisibility(recordingId,visibility,groupId?)` → 본인 녹음만 수정. 그룹 공유는 가입 확인 필요. 파일은 복제하지 않음

초대 코드는 현재 구조에서 별도 발송 서버 없이 참여 의사를 확인할 수 있는 최소 수단이다. 코드 원문은 그룹장에게만 표시한다. 만료·회전·사용 횟수 제한은 서버 연동 시 추가해야 한다. 그룹 탈퇴/삭제는 기존 녹음이나 피아노 달성 기록을 삭제하지 않는다. 남은 그룹에 공유한 자기 녹음은 탈퇴 후에도 구성원이 조회할 수 있다. 공유를 중단하려면 먼저 나만 보기로 바꾼다. 비어 삭제된 그룹의 녹음도 소유자에게 남는다.

## 접근 정책과 보안 한계

화면에서 숨기는 것과 별도로 서비스 계층에서 확인한다.

- 녹음 목록은 본인 소유만 반환한다.
- 오디오/사진 API는 원본 녹음 메타데이터와 친구 관계/그룹 가입을 **같은 IndexedDB 읽기 트랜잭션에서** 확인한다.
- 비공개/미지원 공개 값은 타인에게 거부한다. 공통 Recording 모델은 변경하지 않았다. `public` 전체 공개 정책은 현재 모델에 없으므로 지원하지 않는다.
- 타인 녹음의 수정/삭제/공유 변경은 거부한다.
- 친구 피아노 조회는 수락된 친구 관계가 필요하다. 타인의 복구 큐/이벤트 ID는 반환하거나 재시도하지 않는다. 달성 쓰기/복구는 소유자만 가능하다.
- 친구 삭제/그룹 탈퇴 후 조회를 다시 시도하면 거부한다. 이미 다운로드된 바이트는 회수할 수 없다.

**이 정책은 서버의 보안 경계가 아니다.** 로컬 계정과 세션은 localStorage에 있고 IndexedDB는 사용자가 직접 열 수 있다. DevTools로 세션/스토어를 조작하는 악성 클라이언트를 막지 못한다. 저수준 저장소 모듈도 서버 비밀을 보유하지 않는다. 따라서 실제 다중 사용자 개인정보 보호/인증을 완료했다고 판단하면 안 된다.

## 피아노 설정

`src/lib/pianoPreferences.js`의 `usePianoPreferences(userId)`가 단일 저장소다. 음표와 설정 화면은 같은 구독 상태를 사용한다. `soundcapsule:piano-settings:<계정 ID>`에 음량(0~100)·음소거를 저장한다. 초기값은 55%/음소거 해제다. 같은 탭 이벤트와 storage 이벤트로 변경을 반영한다. 새 계정은 별도 기본값으로 시작한다. 저장 실패는 이전 값을 유지하고 오류를 표시한다.

설정의 기존 프로필/알림/권한/녹음 환경설정 키도 계정별로 분리한다. 기존 전역 키는 자동 복사하지 않는다(다른 계정의 설정을 가져올 위험 방지). 기존 녹음 환경설정은 엔진 미연동임을 명시하고, 외부 앱 연결은 준비 중으로 표시한다. 실제 녹음·사진·메모는 기존 경로를 사용한다. 로그아웃은 기존 인증 화면으로 연결한다.

## 실제 서비스에 필요한 후속 작업

1. 서버 계정/세션 검증, 안전한 비밀번호 저장, 세션 만료 및 권한 검증.
2. 서버 친구 요청/수락·그룹 가입/초대 코드 검증·탈퇴 API와 DB 제약.
3. 녹음/사진 메타데이터 조회뿐 아니라 Blob 다운로드에도 동일한 권한 적용(인증된 객체 저장소 또는 짧은 만료의 서명 URL).
4. 피아노 원장에 대한 소유자 쓰기와 친구 조회 정책, 저장 성공 이벤트의 서버 검증.
5. 사용자 동의/전체 공개 정책을 정한 뒤 모델/API 확장. 현재 클라이언트에서 public을 임의 허용하지 않음.
6. 원격 이벤트/푸시, 초대 만료·회전, 계정 삭제·차단 정책. 다른 기기 설정 동기화가 필요하면 서버 사용자 환경설정 추가.

## 검증

`npm test`, `npm run test:browser`, `npm run build`를 실행한다. `tests/browser/community.test.js`는 격리된 Chrome 테스트 프로필에서만 계정과 Blob을 생성한다. 친구 수락 전후 직접 오디오/사진 호출, 타인 수정/삭제 거부, 권한 철회, 그룹 가입/탈퇴/그룹장 이전, 원본 보존, 피아노 설정 양방향 반영/새로고침/계정 분리, 모바일 폭을 확인한다. 실제 기기 터치/음질이나 서버 보안 검증은 대체하지 않는다.

## 로컬 확인 순서

1. A 계정으로 가입하고 3초 이상 녹음을 저장한다. 친구 화면의 ‘내 녹음 공개 범위’에서 녹음을 선택해 친구에게 공유한다.
2. 설정에서 로그아웃하고 B 계정을 등록한다. 친구 화면에서 A를 찾아 요청한다.
3. A로 다시 로그인해 받은 요청을 수락한다. 이제 서로 친구를 선택해 친구 공개 녹음과 월별 음표를 조회할 수 있다.
4. 그룹 열기 → 그룹 생성 후 표시되는 초대 코드를 복사한다. 같은 브라우저에서 B로 로그인해 코드를 입력한다. A가 그룹에 공유한 녹음은 B의 그룹 상세에서 재생할 수 있다.
5. 음표/설정 어느 쪽에서든 피아노 음량·음소거를 바꾸고 다른 화면이나 새로고침에서 같은 값을 확인한다. 다른 계정에는 값이 전달되지 않는다.

## 이번 단계 변경 파일

이 목록은 이미 작업 폴더에 있던 1·2단계 변경과 구분한 3단계 작업 범위다.

- 화면: `src/features/FriendsHub.jsx`, `src/features/GroupsHub.jsx`, `src/features/SettingsHub.jsx`
- 공유 UI/구독/응답형 스타일: `src/features/community/shared.jsx`, `src/features/community/community.css`
- 계정/서비스/조회 정책: `src/services/localIdentity.js`, `src/services/community.js`, `src/services/communityPolicy.js`
- 기존 화면 연결/계정별 초기화/로컬 인증 안내: `src/App.jsx`, `src/AuthScreen.jsx`
- IndexedDB v4 및 기존 녹음 API 권한 검사: `src/storage/database.js`, `src/storage/recordings.js`
- 피아노 조회/복구 권한: `src/domain/piano/index.js`, `src/domain/piano/repository.js`
- 공통 피아노 환경설정: `src/lib/pianoPreferences.js`, `src/features/piano/usePianoAudio.js`, `src/features/PianoHub.jsx`
- 신규 테스트: `tests/communityPolicy.test.js`, `tests/browser/community.test.js`
- 기존 권한/마이그레이션 테스트 보완: `tests/browser/piano.test.js`, `tests/browser/pianoUI.test.js`, `tests/browser/workflows.test.js`
- 설명: `docs/community.md`

`src/models/recording.js`, 지도 컴포넌트와 홈·캘린더·피아노 스타일 파일은 이번 단계에서 수정하지 않았다. 기존 Git 미커밋 변경사항은 그대로 유지한다.

이번 검증 결과: 단위 테스트 25개, Chrome 전체 브라우저 테스트 34개 통과. 이후 친구 진행 막대 접근성 이름을 보완하고 해당 친구 권한·진행도 브라우저 테스트를 다시 통과했다. 최종 `npm run build`, `git diff --check`도 통과했다. 가상 마이크와 모바일 뷰포트를 이용한 검증이며 실제 모바일 기기의 터치·오디오나 서버 환경은 검증하지 않았다. commit/push/PR은 실행하지 않았다.
