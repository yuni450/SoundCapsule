import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, BASE_URL } from './helpers.js';

test('로컬 계정의 비밀번호 변경·재설정과 로그인 세션이 동작한다', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', 'null'));
    await page.reload();

    await page.getByLabel('이름').fill('디버그 사용자');
    await page.getByLabel('아이디').fill('debug.user');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '계정 만들기' }).click();
    await page.getByRole('heading', { name: /지나가는 순간을/ }).waitFor();

    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('button', { name: '보안 및 세션' }).click();
    await page.getByLabel('현재 비밀번호').fill('1234');
    await page.getByLabel('새 비밀번호').fill('5678');
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    await page.getByText('비밀번호를 변경했어요', { exact: true }).waitFor();
    await page.getByText('현재 브라우저', { exact: true }).waitFor();
    await page.getByRole('button', { name: '로그아웃' }).click();

    await page.getByLabel('아이디').fill('debug.user');
    await page.getByLabel('비밀번호').fill('5678');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('heading', { name: /지나가는 순간을/ }).waitFor();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('button', { name: '로그아웃' }).click();

    await page.getByRole('button', { name: '비밀번호를 잊으셨나요?' }).click();
    await page.getByLabel('아이디').fill('debug.user');
    await page.getByLabel('비밀번호').fill('9012');
    await page.getByRole('button', { name: '비밀번호 변경' }).click();
    await page.getByLabel('비밀번호').fill('9012');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('heading', { name: /지나가는 순간을/ }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('저장한 녹음을 그룹에 공유하고 메시지 삭제 시 공유를 취소한다', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(BASE_URL);
    const recordingId = await page.evaluate(async () => {
      const { saveRecording } = await import('/src/storage/recordings.js');
      const result = await saveRecording({
        blob: new Blob(['debug audio'], { type: 'audio/webm' }),
        recordedAt: new Date().toISOString(),
        duration: 8,
        title: '그룹 공유 디버그 소리',
        userId: 'local.user',
      });
      return result.id;
    });

    await page.getByRole('button', { name: '그룹 열기', exact: true }).click();
    await page.getByRole('button', { name: /여름 바다 여행/ }).click();
    await page.getByRole('button', { name: '♫ 그룹 공유 디버그 소리' }).click();
    const message = page.locator('.message.mine').filter({ hasText: '그룹 공유 디버그 소리' });
    await message.waitFor();
    const shared = await page.evaluate(async (id) => (await (await import('/src/storage/recordings.js')).listRecordings()).find((item) => item.id === id), recordingId);
    assert.equal(shared.visibility, 'group');
    assert.equal(shared.groupId, '1');

    await message.getByRole('button', { name: '삭제' }).click();
    const cancelled = await page.evaluate(async (id) => (await (await import('/src/storage/recordings.js')).listRecordings()).find((item) => item.id === id), recordingId);
    assert.equal(cancelled.visibility, 'private');
    assert.equal(cancelled.groupId, null);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('프로필 사진·아이디 변경과 현재 세션 종료가 다른 탭에도 반영된다', { timeout: 90_000 }, async () => {
  const browser=await launchBrowser();
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
    await page.goto(BASE_URL);await page.evaluate(()=>localStorage.setItem('soundcapsule:session','null'));await page.reload();
    await page.getByLabel('이름').fill('작업자 비');await page.getByLabel('아이디').fill('worker.b');await page.getByLabel('비밀번호').fill('1234');await page.getByRole('button',{name:'계정 만들기'}).click();
    await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'프로필',exact:true}).click();
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({name:'profile.png',mimeType:'image/png',buffer:Buffer.from('profile-image')});
    await page.getByLabel('이름').fill('새 작업자');await page.getByLabel('아이디').fill('worker.new');await page.getByRole('button',{name:'저장',exact:true}).click();
    await page.getByText('프로필과 계정 정보를 저장했어요',{exact:true}).waitFor();await page.getByRole('button',{name:'친구',exact:true}).click();await page.getByText(/내 아이디 @worker\.new/).waitFor();
    const second=await context.newPage();await second.goto(BASE_URL);await second.getByRole('heading',{name:/지나가는 순간을/}).waitFor();
    await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByRole('button',{name:'보안 및 세션'}).click();await page.getByRole('button',{name:'현재 세션 종료'}).click();
    await second.getByRole('heading',{name:'다시 만나 반가워요'}).waitFor();
    await page.getByLabel('아이디').fill('worker.new');await page.getByLabel('비밀번호').fill('1234');await page.getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('heading',{name:/지나가는 순간을/}).waitFor();
  }finally{await browser.close()}
});

test('캘린더에서 기존 녹음의 공개 그룹을 변경하고 공유를 취소한다', { timeout:90_000 }, async()=>{
  const browser=await launchBrowser();
  try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(BASE_URL);const id=await page.evaluate(async()=>{const {saveRecording}=await import('/src/storage/recordings.js');return(await saveRecording({blob:new Blob(['share'],{type:'audio/webm'}),recordedAt:new Date().toISOString(),duration:3,title:'공유 관리 소리',userId:'local.user'})).id});
    await page.getByRole('button',{name:'캘린더',exact:true}).click();const card=page.locator('.sc-cal-record').filter({hasText:'공유 관리 소리'});await card.waitFor();await card.getByLabel('공유 관리 소리 공개 범위').selectOption('group');await card.getByLabel('공유 관리 소리 공개 그룹').selectOption('1');await card.getByRole('button',{name:'변경 저장'}).click();await card.getByText('공개 범위를 변경했어요.').waitFor();
    let record=await page.evaluate(async id=>(await(await import('/src/storage/recordings.js')).listRecordings()).find(item=>item.id===id),id);assert.equal(record.visibility,'group');assert.equal(record.groupId,'1');await card.getByRole('button',{name:'공유 취소'}).click();await card.getByText('공유를 취소했어요.').waitFor();record=await page.evaluate(async id=>(await(await import('/src/storage/recordings.js')).listRecordings()).find(item=>item.id===id),id);assert.equal(record.visibility,'private');
  }finally{await browser.close()}
});

test('그룹 초대 링크와 공유 파일 용량 제한·저장·삭제가 동작한다', {timeout:90_000},async()=>{
  const browser=await launchBrowser();
  try{const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.__inviteLink=value}}})});const page=await context.newPage();await page.goto(BASE_URL);await page.getByRole('button',{name:'그룹 열기',exact:true}).click();await page.getByRole('button',{name:/여름 바다 여행/}).click();
    const fileInput=page.locator('.chat>footer input[type="file"]');await fileInput.setInputFiles({name:'too-large.wav',mimeType:'audio/wav',buffer:Buffer.alloc(10*1024*1024+1)});await page.getByText('공유 파일은 10MB 이하여야 해요.').waitFor();await page.getByRole('button',{name:'취소',exact:true}).click();
    await fileInput.setInputFiles({name:'memory.wav',mimeType:'audio/wav',buffer:Buffer.from('audio-file')});const message=page.locator('.message.mine').filter({hasText:'memory.wav'});await message.waitFor();let keys=await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('soundcapsule');open.onsuccess=()=>{const db=open.result,request=db.transaction('chatFiles').objectStore('chatFiles').getAllKeys();request.onsuccess=()=>{db.close();resolve(request.result)}}}));assert.equal(keys.length,1);await message.getByRole('button',{name:'삭제'}).click();await page.waitForTimeout(100);keys=await page.evaluate(()=>new Promise(resolve=>{const open=indexedDB.open('soundcapsule');open.onsuccess=()=>{const db=open.result,request=db.transaction('chatFiles').objectStore('chatFiles').getAllKeys();request.onsuccess=()=>{db.close();resolve(request.result)}}}));assert.equal(keys.length,0);
    await page.getByRole('button',{name:'멤버'}).click();await page.getByRole('button',{name:'＋ 초대 링크 복사'}).click();const link=await page.evaluate(()=>window.__inviteLink);assert.match(link,/groupInvite=/);const invited=await context.newPage();await invited.goto(link);await invited.getByRole('button',{name:'그룹 열기',exact:true}).click();await invited.locator('.group-invite').filter({hasText:'여름 바다 여행'}).waitFor();
  }finally{await browser.close()}
});
