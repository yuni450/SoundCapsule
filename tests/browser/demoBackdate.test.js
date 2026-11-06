import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launchBrowser } from './helpers.js';

test('시연용 과거 날짜 저장이 캘린더와 음표에 반영되고 미래 날짜는 차단된다', { timeout: 60_000 }, async () => {
  const browser=await launchBrowser();
  try {
    const context=await browser.newContext({timezoneId:'Asia/Seoul',viewport:{width:1280,height:900}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-11-30T03:00:00.000Z'));
    await page.goto(BASE_URL);
    await page.getByRole('button',{name:'녹음 시작',exact:true}).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(3200);
    await page.getByRole('button',{name:'녹음 종료',exact:true}).click();
    await page.getByLabel('제목 필수').fill('시연용 지난 월요일');
    await page.getByLabel('시연용 과거 날짜 지정').check();
    await page.getByLabel('기록 날짜와 시간 시연 종료 후 삭제 예정').fill('2026-11-02T12:34');
    await page.getByRole('button',{name:'소리 저장하기',exact:true}).click();
    await page.getByRole('heading',{name:'시연용 지난 월요일',exact:true}).waitFor();

    const result=await page.evaluate(async()=>{
      const storage=await import('/src/storage/recordings.js');
      const piano=await import('/src/domain/piano/index.js');
      const [recording]=await storage.listRecordings();
      const month=await piano.getMonthlyPiano('2026-11');
      let futureError='';
      try{await storage.saveRecording({blob:new Blob(['future'],{type:'audio/webm'}),title:'미래 기록',duration:3,recordedAt:new Date().toISOString(),demoSavedAt:'2026-12-01T00:00:00.000Z'})}catch(error){futureError=error.message}
      return {savedAt:recording.savedAt,recordedAt:recording.recordedAt,monday:month.weekdays[0].uniqueDateCount,futureError};
    });
    assert.equal(result.savedAt,'2026-11-02T03:34:00.000Z');
    assert.equal(result.recordedAt,result.savedAt);
    assert.equal(result.monday,1);
    assert.match(result.futureError,/과거 시각/);

    await page.getByRole('button',{name:'캘린더',exact:true}).click();
    const day=page.getByRole('button',{name:/^2026년 11월 2일/});
    await day.waitFor();
    assert.equal(await day.locator('.sc-cal-dot').count(),1);
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
