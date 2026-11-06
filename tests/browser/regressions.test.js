import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, BASE_URL } from './helpers.js';

async function seed(page, memo = '') {
  return page.evaluate(async memo => (await import('/src/storage/recordings.js')).saveRecording({
    blob: new Blob(['test fixture'], { type: 'audio/webm' }), title: '예외 상황 검증',
    recordedAt: new Date().toISOString(), duration: 3, memo,
  }), memo);
}

test('탭 간 알림이 차단되어도 홈/캘린더와 같은 탭 변경 알림은 동작한다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.BroadcastChannel = class { constructor() { throw new DOMException('blocked', 'SecurityError'); } }; });
    await page.goto(BASE_URL);
    await page.getByRole('heading', { name: '담아둔 소리', exact: true }).waitFor();
    await seed(page);
    await page.getByText('1개의 순간', { exact: true }).waitFor();
    await page.getByRole('button', { name: '캘린더', exact: true }).click();
    await page.getByRole('heading', { name: '예외 상황 검증', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('종료 API가 계속 실패해도 마이크가 해제되고 안내 후 재시도할 수 있다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => { const stream = await original(options); window.testStream = stream; return stream; };
      window.realStop = MediaRecorder.prototype.stop;
      MediaRecorder.prototype.stop = function () { throw new DOMException('stop failure', 'UnknownError'); };
    });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === 'ended')), true);
    assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).isEnabled(), true);
    await page.evaluate(() => { MediaRecorder.prototype.stop = window.realStop; });
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
    await page.getByLabel('제목 필수').waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('녹음 중 화면 이동 정리에서도 종료 API 실패가 앱을 중단하지 않는다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async options => { const stream = await original(options); window.testStream = stream; return stream; };
      MediaRecorder.prototype.stop = function () { throw new Error('stop failure'); };
    });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '캘린더', exact: true }).click();
    await page.getByRole('heading', { name: '소리로 돌아보는 하루', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === 'ended')), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('메모 저장 후 목록 재조회가 늦어도 새 값 유지, 다른 탭 변경과 편집 중 값 보호', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    const recording = await seed(page, '이전 메모');
    await page.getByRole('button', { name: '캘린더', exact: true }).click();
    const input = page.getByLabel('이 순간의 메모', { exact: true });
    await input.fill('  새로 저장한 메모  ');
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
      window.delayList = true;
      window.pendingLists = [];
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = original.apply(this, args);
        Object.defineProperty(tx, 'oncomplete', { configurable: true, set(handler) {
          descriptor.set.call(tx, function (event) {
            if (window.delayList && tx.mode === 'readonly' && tx.objectStoreNames.length === 1 && tx.objectStoreNames.contains('recordings')) window.pendingLists.push(() => handler.call(tx, event));
            else handler.call(tx, event);
          });
        } });
        return tx;
      };
    });
    await page.getByRole('button', { name: '메모 저장', exact: true }).click();
    await page.getByText('메모를 저장했어요.', { exact: true }).waitFor();
    assert.equal(await input.inputValue(), '새로 저장한 메모');
    await page.waitForFunction(() => window.pendingLists.length > 0);
    await input.fill('다음 편집 중 메모');
    await page.evaluate(() => { window.delayList = false; window.pendingLists.splice(0).forEach(done => done()); });
    assert.equal(await input.inputValue(), '다음 편집 중 메모');
    await page.evaluate(async id => (await import('/src/storage/recordings.js')).updateRecordingMemo(id, '외부 메모'), recording.id);
    await page.getByText('기억을 불러오는 중…').waitFor({ state: 'hidden' });
    assert.equal(await input.inputValue(), '다음 편집 중 메모');
    await page.getByRole('button', { name: '메모 저장', exact: true }).click();
    await page.getByText('메모를 저장했어요.', { exact: true }).waitFor();
    assert.equal(await input.inputValue(), '다음 편집 중 메모');
  } finally { await browser.close(); }
});

test('손상된 오디오도 화면을 중단하지 않고 재생 오류를 안내한다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE_URL); await seed(page);
    await page.getByRole('button', { name: '녹음 듣기 →' }).click();
    await page.getByText('오디오를 재생하지 못했어요.', { exact: false }).waitFor();
    assert.equal(await page.locator('.sc-saved-card').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('빠른 연속 시작·종료·저장과 새로고침 취소에서도 녹음은 한 번만 저장된다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: '녹음 시작', exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    page.once('dialog', async dialog => { assert.equal(dialog.type(), 'beforeunload'); await dialog.dismiss(); });
    await page.reload({ timeout: 3000 }).catch(error => { assert.match(error.message, /ERR_ABORTED|Timeout/); });
    assert.equal(await page.getByRole('button', { name: '녹음 종료', exact: true }).count(), 1);
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: '녹음 종료', exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.getByLabel('제목 필수').fill('연속 입력');
    await page.locator('form.sc-draft').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole('heading', { name: '연속 입력', exact: true }).waitFor();
    assert.equal(await page.locator('.sc-saved-card').count(), 1);
    const records = await page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings());
    assert.equal(records.length, 1);
    await page.reload();
    await page.getByRole('heading', { name: '연속 입력', exact: true }).waitFor();
    await page.getByRole('button', { name: '녹음 듣기 →' }).click();
    await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  } finally { await browser.close(); }
});

test('모바일 터치·긴 제목/메모·사진 보기와 반복 화면 이동 후 리소스 정리', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 740 } });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.text()} (${message.location().url})`); });
    await page.addInitScript(() => {
      window.activeUrls = new Set();
      window.changeListeners = new Set();
      const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
      URL.createObjectURL = function (blob) { const url = create.call(this, blob); window.activeUrls.add(url); return url; };
      URL.revokeObjectURL = function (url) { window.activeUrls.delete(url); return revoke.call(this, url); };
      const add = window.addEventListener, remove = window.removeEventListener;
      window.addEventListener = function (name, callback, ...args) { if (name === 'soundcapsule:recordings-changed') window.changeListeners.add(callback); return add.call(this, name, callback, ...args); };
      window.removeEventListener = function (name, callback, ...args) { if (name === 'soundcapsule:recordings-changed') window.changeListeners.delete(callback); return remove.call(this, name, callback, ...args); };
    });
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: '녹음 시작', exact: true }).tap();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: '녹음 종료', exact: true }).tap();
    const title = '긴'.repeat(100);
    await page.getByLabel('제목 필수').fill(title);
    await page.getByLabel('메모 선택').fill('메'.repeat(500));
    await page.getByRole('button', { name: '소리 저장하기', exact: true }).tap();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.waitForFunction(() => window.activeUrls.size === 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: `${title} 메뉴`, exact: true }).tap();
    assert.equal(await page.getByRole('menu').count(), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '녹음 듣기 →' }).tap();
    await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
    await page.getByRole('button', { name: '캘린더', exact: true }).tap();
    await page.getByLabel('이 순간의 메모', { exact: true }).waitFor();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZsFAAAAAASUVORK5CYII=', 'base64');
    await page.getByLabel(`${title} 사진 선택`).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => document.querySelector('.sc-cal-photo img')?.naturalWidth > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const popupReady = page.waitForEvent('popup');
    await page.getByRole('link', { name: '첨부 사진 크게 보기', exact: true }).tap();
    const popup = await popupReady; await popup.waitForLoadState();
    assert.equal(await popup.locator('img').evaluate(img => img.naturalWidth), 1);
    await popup.close();
    await page.locator('.sc-cal-grid button:not([aria-current="date"])').first().tap();
    await page.waitForFunction(() => window.activeUrls.size === 0);
    for (let index = 0; index < 3; index++) {
      await page.getByRole('button', { name: '홈 · 녹음', exact: true }).tap();
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.getByRole('button', { name: '캘린더', exact: true }).tap();
      await page.getByLabel('이 순간의 메모', { exact: true }).waitFor();
    }
    await page.getByRole('button', { name: '홈 · 녹음', exact: true }).tap();
    await page.waitForFunction(() => window.activeUrls.size === 0);
    assert.equal(await page.evaluate(() => window.changeListeners.size), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
