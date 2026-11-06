import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launchBrowser } from './helpers.js';
async function setup(browser) {
  const context=await browser.newContext({ viewport:{width:1280,height:900} });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE_URL);
  await page.getByRole('heading',{name:'담아둔 소리',exact:true}).waitFor();
  await page.evaluate(()=>localStorage.setItem('soundcapsule:users',JSON.stringify(['alice','bob','carol'].map(id=>({id,name:id,passwordHash:'not-in-responses'})))));
  await login(page,'alice');return {page,context,errors};
}
async function login(page,id) {
  await page.evaluate(id=>localStorage.setItem('soundcapsule:session',JSON.stringify({id,name:id})),id);
  await page.reload();await page.getByRole('heading',{name:'담아둔 소리',exact:true}).waitFor();
}
const call=(page,name,...args)=>page.evaluate(async({name,args})=>(await import('/src/services/community.js'))[name](...args),{name,args});
const storage=(page,name,...args)=>page.evaluate(async({name,args})=>(await import('/src/storage/recordings.js'))[name](...args),{name,args});
async function save(page,title='실제 로컬 기록') {
  return page.evaluate(async title=>(await import('/src/storage/recordings.js')).saveRecording({title,duration:3,recordedAt:new Date().toISOString(),blob:new Blob(['test audio'],{type:'audio/webm'})}),title);
}
test('친구 수락 전후 권한·비공개 오디오/사진 차단·삭제 후 재차단·사용자별 기록',async()=>{
 const browser=await launchBrowser();try{
  const {page,errors}=await setup(browser);
  const record=await save(page);
  const photo=await page.evaluate(async id=>(await import('/src/storage/recordings.js')).addRecordingPhotos(id,[new Blob(['photo'],{type:'image/png'})]),record.id);
  const users=await call(page,'searchLocalUsers');assert.equal(users.length,2);assert.equal('passwordHash' in users[0],false);
  await call(page,'requestFriend','bob');
  await login(page,'bob');assert.equal((await call(page,'getFriendState')).incoming.length,1);
  await assert.rejects(()=>call(page,'getFriendRecordings','alice'),/친구 관계/);
  await assert.rejects(()=>storage(page,'getRecordingAudio',record.id),/조회 권한/);
  await call(page,'respondToFriend','alice',true);
  assert.equal((await call(page,'getFriendRecordings','alice')).length,0);
  await assert.rejects(()=>storage(page,'getRecordingPhoto',photo.photoUrls[0]),/조회 권한/);
  await assert.rejects(()=>storage(page,'deleteRecording',record.id),/본인의 녹음/);
  await assert.rejects(()=>storage(page,'updateRecordingMemo',record.id,'변조'),/본인의 녹음/);
  assert.equal((await storage(page,'listRecordings')).length,0);
  await login(page,'alice');await call(page,'setRecordingVisibility',record.id,'friends');
  await login(page,'bob');assert.equal((await call(page,'getFriendRecordings','alice')).length,1);
  assert.equal(await page.evaluate(async id=>(await (await import('/src/storage/recordings.js')).getRecordingAudio(id)).text(),record.id),'test audio');
  assert.equal(await page.evaluate(async url=>(await (await import('/src/storage/recordings.js')).getRecordingPhoto(url)).text(),photo.photoUrls[0]),'photo');
  const piano=await page.evaluate(async()=>(await import('/src/domain/piano/index.js')).getMonthlyPiano(new Date().toISOString().slice(0,7),{userId:'alice'}));assert.equal(piano.userId,'alice');
  await page.getByRole('button',{name:'친구',exact:true}).click();await page.getByRole('button',{name:'alice · @alice',exact:true}).click();await page.getByRole('heading',{name:'친구 공개 녹음',exact:true}).waitFor();
  for (let index=0;index<7;index++) assert.equal(await page.getByRole('progressbar').nth(index).getAttribute('value'),String(piano.weekdays[index].filledSlots));
  await call(page,'removeFriend','alice');
  await assert.rejects(()=>storage(page,'getRecordingAudio',record.id),/조회 권한/);
  await assert.rejects(()=>page.evaluate(async()=>(await import('/src/domain/piano/index.js')).getMonthlyPiano('2026-11',{userId:'alice'})),/조회 권한/);
  await page.waitForFunction(()=>document.querySelectorAll('.community-record audio').length===0);
  await login(page,'alice');assert.equal((await storage(page,'listRecordings')).length,1);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('그룹 생성·초대 참여·구성원 조회·오디오 접근·탈퇴·그룹장 이전·원본 보존',async()=>{
 const browser=await launchBrowser();try{
  const {page,errors}=await setup(browser);const record=await save(page);
  const group=await call(page,'createGroup','우리의 소리');await call(page,'setRecordingVisibility',record.id,'group',group.id);
  await login(page,'bob');assert.equal((await call(page,'listGroups')).length,0);
  await assert.rejects(()=>call(page,'getGroup',group.id),/구성원/);await assert.rejects(()=>storage(page,'getRecordingAudio',record.id),/조회 권한/);
  await assert.rejects(()=>call(page,'joinGroup','invalid'),/초대 코드/);
  await call(page,'joinGroup',group.inviteCode);await call(page,'joinGroup',group.inviteCode);
  let detail=await call(page,'getGroup',group.id);assert.equal(detail.members.length,2);assert.equal(detail.recordings.length,1);assert.equal('inviteCode' in detail,false);
  await page.getByRole('button',{name:'그룹 열기',exact:true}).click();await page.getByRole('button',{name:'우리의 소리 · 2명',exact:true}).click();await page.getByRole('heading',{name:'공유된 소리',exact:true}).waitFor();
  await call(page,'leaveGroup',group.id);await assert.rejects(()=>storage(page,'getRecordingAudio',record.id),/조회 권한/);
  await call(page,'joinGroup',group.inviteCode);await login(page,'alice');await call(page,'leaveGroup',group.id);
  assert.equal((await storage(page,'listRecordings')).length,1);
  await login(page,'bob');detail=await call(page,'getGroup',group.id);assert.equal(detail.ownerId,'bob');assert.equal(detail.inviteCode,group.inviteCode);
  await call(page,'leaveGroup',group.id);assert.equal((await call(page,'listGroups')).length,0);
  await login(page,'alice');assert.equal((await storage(page,'listRecordings')).length,1);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('피아노 설정 양방향 동기화·새로고침 복원·계정 분리·모바일 레이아웃',async()=>{
 const browser=await launchBrowser();try{
  const {page,errors}=await setup(browser);
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('slider',{name:'피아노 음량',exact:true}).fill('30');
  await page.getByRole('switch',{name:'피아노 음소거',exact:true}).click();
  await page.getByRole('button',{name:'🎵 음표',exact:true}).click();
  assert.equal(await page.getByRole('slider',{name:/음량/}).inputValue(),'30');
  await page.getByRole('slider',{name:/음량/}).fill('75');
  await page.getByRole('button',{name:'설정',exact:true}).click();assert.equal(await page.getByRole('slider',{name:'피아노 음량',exact:true}).inputValue(),'75');assert.equal(await page.getByRole('switch',{name:'피아노 음소거',exact:true}).getAttribute('aria-checked'),'true');
  await page.reload();await page.getByRole('button',{name:'설정',exact:true}).click();assert.equal(await page.getByRole('slider',{name:'피아노 음량',exact:true}).inputValue(),'75');
  await login(page,'bob');await page.getByRole('button',{name:'설정',exact:true}).click();assert.equal(await page.getByRole('slider',{name:'피아노 음량',exact:true}).inputValue(),'55');assert.equal(await page.getByRole('switch',{name:'피아노 음소거',exact:true}).getAttribute('aria-checked'),'false');
  await page.setViewportSize({width:390,height:844});
  await page.locator('.bottom button').filter({hasText:'친구'}).click();await page.getByRole('heading',{name:'친구',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('.mobile button[aria-label="그룹 열기"]').click();await page.getByRole('heading',{name:'그룹',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('친구 조회 오류 재시도·설정 저장 실패 보존·다른 탭 사용자 전환·로그아웃',async()=>{
 const browser=await launchBrowser();try{
  const {page,context,errors}=await setup(browser);
  const record=await save(page,'Alice의 기록');
  await page.getByRole('button',{name:'녹음 듣기 →',exact:true}).click();
  await page.locator('.sc-saved-card audio').waitFor();
  const other=await context.newPage();await other.goto(BASE_URL);
  await other.evaluate(()=>localStorage.setItem('soundcapsule:session',JSON.stringify({id:'bob',name:'bob'})));
  await page.waitForFunction(()=>document.querySelector('.me small')?.textContent==='@bob');
  await page.waitForFunction(()=>document.querySelectorAll('.sc-saved-card').length===0);
  await assert.rejects(()=>storage(page,'getRecordingAudio',record.id),/조회 권한/);
  await page.evaluate(()=>{
   const original=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(stores,...args){if(Array.from(stores).includes('communityFriends')&&!window.allowFriends)throw new Error('검증용 친구 조회 실패');return original.call(this,stores,...args);};
  });
  await page.getByRole('button',{name:'친구',exact:true}).click();
  await page.getByText('검증용 친구 조회 실패',{exact:true}).waitFor();
  await page.evaluate(()=>{window.allowFriends=true;});await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.getByText('아직 친구가 없어요. 등록된 계정에 요청을 보내보세요.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.evaluate(()=>{
   const original=Storage.prototype.setItem;
   Storage.prototype.setItem=function(key,...args){if(key.startsWith('soundcapsule:piano-settings:'))throw new DOMException('검증용 할당량 부족','QuotaExceededError');return original.call(this,key,...args);};
  });
  await page.getByRole('slider',{name:'피아노 음량',exact:true}).fill('20');
  await page.getByText('설정을 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('slider',{name:'피아노 음량',exact:true}).inputValue(),'55');
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('button',{name:'로그인',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
