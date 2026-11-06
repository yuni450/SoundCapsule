import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeRecording, friendKey } from '../src/services/communityPolicy.js';
function allowed(recording, { viewer='bob', friend=false, member=false, write=false }={}) {
 return new Promise(resolve=>{
  const tx={ objectStore(name){return {get(key){
   assert.deepEqual(key,name==='communityFriends'?friendKey(viewer,recording.userId):[recording.groupId,viewer]);
   const request={};queueMicrotask(()=>request.onsuccess({target:{result:(name==='communityFriends'?friend:member)?{}:undefined}}));return request;
  }};}};
  authorizeRecording(tx,viewer,recording,()=>resolve(true),()=>resolve(false),write);
 });
}
const record={userId:'alice',visibility:'private',groupId:null};
test('소유자는 녹음 공개 범위와 무관하게 조회/수정하며 타인은 private/미지원 public 접근 불가',async()=>{
 assert.equal(await allowed(record,{viewer:'alice',write:true}),true);
 for(const visibility of ['private','public',null,undefined]) assert.equal(await allowed({...record,visibility},{friend:true,member:true}),false);
 assert.equal(await allowed(null),false);
});
test('friends 오디오/사진 정책은 요청 상태가 아닌 확정 관계가 있어야 조회 허용',async()=>{
 const shared={...record,visibility:'friends'};
 assert.equal(await allowed(shared),false);assert.equal(await allowed(shared,{friend:true}),true);
 assert.equal(await allowed(shared,{friend:true,write:true}),false);
});
test('group 정책은 해당 groupId의 실제 구성원만 허용하고 친구 관계로 우회 불가',async()=>{
 const shared={...record,visibility:'group',groupId:'group-one'};
 assert.equal(await allowed(shared,{friend:true}),false);assert.equal(await allowed(shared,{member:true}),true);
 assert.equal(await allowed(shared,{member:true,write:true}),false);
 assert.equal(await allowed({...shared,groupId:null},{member:true}),false);
});
