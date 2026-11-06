import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, BASE_URL } from './helpers.js';

test('위치 녹음이 없어도 Google 지도는 계속 표시된다', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: '지도', exact: true }).click();
    await page.locator('.google-map-stage').waitFor();
    await page.getByRole('heading', { name: '아직 지도에 남긴 소리가 없어요' }).waitFor();
  } finally {
    await browser.close();
  }
});

test('홈에서 저장한 위치 녹음이 지도 목록과 실제 오디오에 연결된다', { timeout:90_000 }, async () => {
  const browser=await launchBrowser();
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:37.5665,longitude:126.978},permissions:['geolocation']});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(BASE_URL);
    await page.getByRole('button',{name:'녹음 시작',exact:true}).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(400);
    await page.getByRole('button',{name:'녹음 종료',exact:true}).click();
    await page.getByLabel('제목 필수').fill('지도에 남긴 소리');
    await page.getByLabel('장소 선택').fill('서울 시청');
    await page.getByLabel('지도에 위치 표시').check();
    await page.getByRole('button',{name:'현재 위치 사용',exact:true}).click();
    await page.getByText('현재 위치를 추가했어요', {exact:false}).waitFor();
    await page.getByRole('button',{name:'소리 저장하기',exact:true}).click();
    await page.getByRole('heading',{name:'지도에 남긴 소리',exact:true}).waitFor();
    const stored=await page.evaluate(async()=>{const {listRecordings}=await import('/src/storage/recordings.js');return (await listRecordings())[0]});
    assert.equal(stored.location.name,'서울 시청');
    assert.equal(stored.location.latitude,37.5665);
    assert.equal(stored.location.longitude,126.978);
    assert.match(stored.savedAt,/Z$/);
    await page.getByRole('button',{name:'지도',exact:true}).click();
    await page.getByRole('heading',{name:'나의 소리 지도',exact:true}).waitFor();
    await page.getByRole('button',{name:'장소 목록',exact:true}).click();
    await page.getByText('서울 시청',{exact:true}).waitFor();
    const card=page.locator('.map-recording-card').filter({hasText:'지도에 남긴 소리'});
    assert.equal(await card.count(),1);
    await card.locator('button').click();
    await page.waitForTimeout(200);
    assert.deepEqual(errors,[]);
  }finally{await browser.close()}
});
