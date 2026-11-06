import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecording, validateRecording } from '../src/models/recording.js';
import { canAccessRecording } from '../src/storage/recordings.js';

const base = {
  id:'recording-1',userId:'owner',title:'저장한 소리',audioUrl:'indexeddb://soundcapsule/audio/recording-1',
  recordedAt:'2026-11-06T14:59:58.000Z',duration:2,location:{name:'서울',latitude:37.5665,longitude:126.978},
};

test('녹음 생성 시 실제 저장 완료 시각을 자동으로 기록한다', () => {
  const recording=createRecording(base);
  assert.equal(validateRecording(recording).valid,true);
  assert.match(recording.savedAt,/Z$/);
  assert(Date.parse(recording.savedAt)>=Date.parse(recording.recordedAt));
});

test('위도와 경도는 함께 저장해야 한다', () => {
  const recording=createRecording({...base,location:{name:'서울',latitude:null,longitude:null}});
  assert.equal(validateRecording(recording).valid,true);
  const invalid={...recording,location:{...recording.location,latitude:37.5}};
  assert.equal(validateRecording(invalid).valid,false);
});

test('비공개·친구·그룹 공유 권한을 구분한다', () => {
  const privateRecording=createRecording(base);
  assert.equal(canAccessRecording(privateRecording,{userId:'owner'}),true);
  assert.equal(canAccessRecording(privateRecording,{userId:'other'}),false);
  const friends={...privateRecording,visibility:'friends'};
  assert.equal(canAccessRecording(friends,{userId:'viewer',friendIds:['owner']}),true);
  const group={...privateRecording,visibility:'group',groupId:'group-1'};
  assert.equal(canAccessRecording(group,{userId:'viewer',groupIds:['group-1']}),true);
  assert.equal(canAccessRecording(group,{userId:'viewer',groupIds:[]}),false);
});
