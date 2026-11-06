import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launchBrowser, BASE_URL } from './helpers.js';
import { audioFilename } from '../../src/features/home/downloadAudio.js';

test('홈 녹음·저장·재생·할당량 실패 및 재시도', { timeout: 90_000 }, async () => {

const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(BASE_URL);
  await page.getByText('첫 번째 순간을 녹음해 보세요.').waitFor();
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').fill('브라우저 자동 검증');
  await page.getByLabel('장소 선택').fill('검증 환경');
  await page.getByLabel('메모 선택').fill('저장 검증');
  await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  // 오디오 저장 실패를 주입하여 원자적 롤백과 초안 유지 확인
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'audio' && !window.allowSave) throw new DOMException('test quota', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '소리 저장하기' }).click();
  await page.getByText('저장 공간이 부족해요.', { exact: false }).waitFor();
  assert.equal(await page.locator('audio').count(), 1);
  const count = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('soundcapsule');
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction('recordings').objectStore('recordings').count();
      req.onsuccess = () => { resolve(req.result); db.close(); };
      req.onerror = () => reject(req.error);
    };
  }));
  assert.equal(count, 0, 'failed audio write must roll back metadata');
  await page.evaluate(() => { window.allowSave = true; });
  await page.getByRole('button', { name: '소리 저장하기' }).click();
  await page.getByText('이 브라우저에 소중한 소리를 저장했어요.').waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '브라우저 자동 검증' }).waitFor();
  await page.getByRole('button', { name: '녹음 듣기 →' }).click();
  await page.locator('audio').waitFor();
  await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  const persisted = await page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('soundcapsule');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['recordings', 'audio']);
      let result;
      tx.objectStore('recordings').getAll().onsuccess = ({ target }) => {
        const record = target.result[0];
        tx.objectStore('audio').get(record.id).onsuccess = ({ target: audio }) => {
          result = { record, size: audio.result.size, type: audio.result.type, count: target.result.length };
        };
      };
      tx.oncomplete = () => { resolve(result); db.close(); };
    };
  }));
  assert.equal(persisted.count, 1);
  assert(persisted.size > 0);
  assert(persisted.record.audioUrl.startsWith('indexeddb://'));
  assert.equal(persisted.record.visibility, 'private');
  assert(persisted.record.userId.startsWith('local-'));
  assert.equal(persisted.record.location.latitude, null);
  assert.equal(persisted.record.memo, '저장 검증');
  assert(persisted.record.duration >= 1);
  // 다시 녹음 확인 창 취소/확인과 마이크 트랙 정리
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => { const stream = await original(options); window.lastStream = stream; return stream; };
  });
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').fill('유지할 제목');
  assert.equal(await page.evaluate(() => window.lastStream.getTracks().every(track => track.readyState === 'ended')), true);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '다시 녹음하기' }).click();
  assert.equal(await page.getByLabel('제목 필수').inputValue(), '유지할 제목');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '다시 녹음하기' }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').waitFor();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(pageErrors, []);
  console.log('PASS: real MediaRecorder with simulated microphone, preview playback, quota failure and rollback, retry save, reload persistence and playback, retry confirmation, track cleanup, responsive widths, no React/browser errors');

  const denied = await context.newPage();
  await denied.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
  });
  await denied.goto(BASE_URL);
  await denied.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await denied.getByText('마이크 사용을 허용해 주세요.', { exact: false }).waitFor();
  assert.equal(await denied.getByRole('button', { name: '녹음 시작', exact: true }).isEnabled(), true);
  console.log('PASS: permission rejection feedback and retry enabled');
} finally {
  await browser.close();
}
});

test('메뉴 키보드·다운로드 원본 일치·레이아웃', { timeout: 90_000 }, async () => {
assert.equal(audioFilename('비 / 소리?', 'audio/mp4;codecs=mp4a.40.2'), '비 _ 소리_.m4a');
assert.equal(audioFilename('...', 'audio/webm'), 'SoundCapsule.webm');
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(BASE_URL);
  await page.getByText('첫 번째 순간을 녹음해 보세요.').waitFor();
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  const title = '비 오는 / 골목: 기억?';
  await page.getByLabel('제목 필수').fill(title);
  await page.getByRole('button', { name: '소리 저장하기' }).click();
  const trigger = page.getByRole('button', { name: `${title} 메뉴`, exact: true });
  await trigger.waitFor();
  const snapshot = () => page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('soundcapsule');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['recordings', 'audio']);
      let record, blob;
      tx.objectStore('recordings').getAll().onsuccess = ({ target }) => {
        record = target.result[0];
        tx.objectStore('audio').get(record.id).onsuccess = ({ target }) => { blob = target.result; };
      };
      tx.oncomplete = async () => { db.close(); resolve({ record, type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] }); };
    };
  }));
  const before = await snapshot();
  await trigger.click();
  await page.getByRole('menu').waitFor();
  assert.equal(await page.getByRole('menuitem', { name: '다운로드', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.getByRole('menuitem', { name: '삭제', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(), 0);
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  await trigger.click();
  await page.locator('.sc-brand').click();
  assert.equal(await page.getByRole('menu').count(), 0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    await trigger.click();
    await page.getByRole('menu').waitFor();
    const bounds = await page.getByRole('menu').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    assert(bounds.y >= 0 && bounds.y + bounds.height <= 600);
    await page.keyboard.press('Escape');
  }
  console.log('PASS: keyboard navigation, Escape focus return, outside click, menu viewport bounds at mobile and desktop widths');
  await trigger.click();
  const fileReady = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '다운로드', exact: true }).click();
  const file = await fileReady;
  assert.equal(file.suggestedFilename(), audioFilename(title, before.type));
  assert.deepEqual([...await readFile(await file.path())], before.bytes);
  const downloaded = [...await readFile(await file.path())];
  await page.evaluate(async ({ bytes, type }) => {
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type }));
    const audio = new Audio(url);
    try { await audio.play(); audio.pause(); }
    finally { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
  }, { bytes: downloaded, type: before.type });
  assert.deepEqual(await snapshot(), before);
  assert.equal(await page.getByRole('menu').count(), 0);
  console.log('PASS: title-based filename and correct extension, downloaded bytes equal original Blob, metadata/audio unchanged');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'audio' && !window.allowAudio) throw new Error('test read failure');
      return original.apply(this, args);
    };
  });
  await trigger.click();
  await page.getByRole('menuitem', { name: '다운로드', exact: true }).click();
  await page.getByText('녹음을 다운로드하지 못했어요. 다시 시도해 주세요.').waitFor();
  assert.equal(await trigger.isEnabled(), true);
  await page.evaluate(() => { window.allowAudio = true; });
  assert.deepEqual(await snapshot(), before);
  await page.getByRole('button', { name: '녹음 듣기 →' }).click();
  await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  assert.deepEqual(errors, []);
  console.log('PASS: failed download feedback, original preserved, playback still works, no browser errors');
} finally { await browser.close(); }
});

test('삭제 취소·롤백·다른 기록 보존', { timeout: 90_000 }, async () => {
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(BASE_URL);
  await page.getByText('첫 번째 순간을 녹음해 보세요.').waitFor();
  for (const title of ['첫 번째 녹음', '두 번째 녹음']) {
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
    await page.getByLabel('제목 필수').fill(title);
    await page.getByRole('button', { name: '소리 저장하기' }).click();
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  }
  const snapshot = () => page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('soundcapsule');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['recordings', 'audio', 'settings']);
      const result = {};
      const audio = [];
      tx.objectStore('recordings').getAll().onsuccess = event => { result.records = event.target.result; };
      tx.objectStore('settings').get('localUserId').onsuccess = event => { result.userId = event.target.result; };
      tx.objectStore('audio').openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) return;
        audio.push({ id: cursor.key, blob: cursor.value });
        cursor.continue();
      };
      tx.oncomplete = async () => {
        db.close();
        result.audio = await Promise.all(audio.map(async ({ id, blob }) => ({ id, type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())] })));
        resolve(result);
      };
    };
  }));
  const before = await snapshot();
  assert.equal(before.records.length, 2);
  assert.equal(before.audio.length, 2);
  page.once('dialog', async dialog => {
    assert.equal(dialog.message(), '이 녹음을 삭제하시겠습니까?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '첫 번째 녹음 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click();
  assert.deepEqual(await snapshot(), before);
  assert.equal(await page.locator('.sc-saved-card').count(), 2);
  console.log('PASS: exact confirmation text and cancel preserves both recordings');

  // 오디오 삭제 실패 시 먼저 요청한 메타데이터 삭제도 롤백되어야 합니다.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      if (this.name === 'audio' && !window.allowDelete) throw new DOMException('test failure', 'UnknownError');
      return original.apply(this, args);
    };
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '첫 번째 녹음 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click();
  await page.getByText('녹음을 삭제하지 못했어요. 다시 시도해 주세요.').waitFor();
  assert.deepEqual(await snapshot(), before);
  assert.equal(await page.getByRole('button', { name: '첫 번째 녹음 메뉴', exact: true }).isEnabled(), true);
  console.log('PASS: failure rolls back metadata and audio and enables retry');

  const firstCard = page.locator('.sc-saved-card').filter({ has: page.getByRole('heading', { name: '첫 번째 녹음', exact: true }) });
  await firstCard.getByRole('button', { name: '녹음 듣기 →' }).click();
  await firstCard.locator('audio').evaluate(async audio => { window.deletedPlayer = audio; await audio.play(); });
  const playingUrl = await firstCard.locator('audio').getAttribute('src');
  await page.evaluate(() => {
    window.revokedUrls = [];
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = function (url) { window.revokedUrls.push(url); return original.call(this, url); };
    window.allowDelete = true;
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '첫 번째 녹음 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click();
  await page.getByText('녹음을 삭제했어요.', { exact: true }).waitFor();
  assert.equal(await page.locator('.sc-saved-card').count(), 1);
  await page.getByText('1개의 순간', { exact: true }).waitFor();
  assert.equal(await page.evaluate(url => window.revokedUrls.includes(url), playingUrl), true);
  assert.equal(await page.evaluate(() => window.deletedPlayer.paused && !window.deletedPlayer.hasAttribute('src')), true);
  const after = await snapshot();
  const deletedId = before.records.find(record => record.title === '첫 번째 녹음').id;
  assert.deepEqual(after, { records: before.records.filter(record => record.id !== deletedId), userId: before.userId, audio: before.audio.filter(audio => audio.id !== deletedId) });
  console.log('PASS: only selected audio and metadata removed, count updated, playback URL released, other recording unchanged');

  await page.reload();
  await page.getByRole('heading', { name: '두 번째 녹음', exact: true }).waitFor();
  assert.equal(await page.locator('.sc-saved-card').count(), 1);
  await page.getByRole('button', { name: '녹음 듣기 →' }).click();
  await page.locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '두 번째 녹음 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click();
  await page.getByText('첫 번째 순간을 녹음해 보세요.').waitFor();
  await page.getByText('0개의 순간', { exact: true }).waitFor();
  const empty = await snapshot();
  assert.equal(empty.records.length, 0);
  assert.equal(empty.audio.length, 0);
  assert.equal(empty.userId, before.userId);
  await page.reload();
  await page.getByText('첫 번째 순간을 녹음해 보세요.').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: reload retains deletion, remaining audio playable, last deletion shows empty state, no browser errors');
} finally { await browser.close(); }
});

test('DB 마이그레이션·사진·메모·탭 동기화', { timeout: 90_000 }, async () => {
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.seedPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open('soundcapsule', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('recordings', { keyPath: 'id' });
        open.result.createObjectStore('audio'); open.result.createObjectStore('settings');
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['recordings', 'audio', 'settings'], 'readwrite');
        const now = new Date().toISOString();
        tx.objectStore('recordings').put({ id: 'legacy', userId: 'local-legacy', title: '기존 DB 녹음', audioUrl: 'indexeddb://soundcapsule/audio/legacy', recordedAt: now, duration: 1, location: { name: '', latitude: null, longitude: null }, photoUrls: [], memo: '기존 메모', visibility: 'private', groupId: null, createdAt: now, updatedAt: now });
        tx.objectStore('audio').put(new Blob(['legacy-bytes'], { type: 'audio/webm' }), 'legacy');
        tx.objectStore('settings').put('local-legacy', 'localUserId');
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  await page.route('**/src/main.jsx', route => route.fulfill({ contentType: 'application/javascript', body: 'await window.seedPromise; await import("/src/main.jsx?seeded");' }));
  await page.goto(BASE_URL);
  await page.getByRole('heading', { name: '기존 DB 녹음', exact: true }).waitFor();
  // 초기 시드 스크립트는 이후 새로고침에서 실행하지 않습니다.
  await page.unroute('**/src/main.jsx');
  await page.evaluate(() => { window.seedPromise = null; });
  const snapshot = () => page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('soundcapsule');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['recordings', 'audio', 'photos', 'settings']);
      const result = { version: db.version }; let legacyBlob;
      tx.objectStore('recordings').getAll().onsuccess = ({ target }) => { result.records = target.result; };
      tx.objectStore('audio').getAllKeys().onsuccess = ({ target }) => { result.audioIds = target.result; };
      tx.objectStore('audio').get('legacy').onsuccess = ({ target }) => { legacyBlob = target.result; };
      tx.objectStore('photos').getAllKeys().onsuccess = ({ target }) => { result.photoIds = target.result; };
      tx.objectStore('settings').get('localUserId').onsuccess = ({ target }) => { result.userId = target.result; };
      tx.oncomplete = async () => { db.close(); result.legacyAudio = legacyBlob ? await legacyBlob.text() : null; resolve(result); };
    };
  }));
  let data = await snapshot();
  assert.equal(data.version, 4); assert.equal(data.legacyAudio, 'legacy-bytes'); assert.equal(data.userId, 'local-legacy'); assert.equal(data.records[0].memo, '기존 메모');
  console.log('PASS: v1 -> v4 migration preserves metadata, audio bytes and local identity');
  assert.equal(data.version, 5); assert.equal(data.legacyAudio, 'legacy-bytes'); assert.equal(data.userId, 'local-legacy'); assert.equal(data.records[0].memo, '기존 메모'); assert.equal(data.records[0].savedAt, data.records[0].createdAt);
  console.log('PASS: v1 -> v5 migration preserves metadata, audio bytes and local identity and adds savedAt');
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor(); await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').fill('캘린더 실제 녹음');
  await page.getByRole('button', { name: '소리 저장하기' }).click();
  await page.getByRole('heading', { name: '캘린더 실제 녹음', exact: true }).waitFor();
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page.getByRole('heading', { name: '소리로 돌아보는 하루', exact: true }).waitFor();
  await page.getByText('2개의 소리', { exact: true }).waitFor();
  const today = page.locator('.sc-cal-grid button[aria-current="date"]');
  assert.equal(await today.count(), 1); assert.equal(await today.locator('.sc-cal-dot').count(), 1);
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await page.getByText('이날은 담아둔 소리가 없어요.', { exact: true }).waitFor();
  await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await page.getByText('2개의 소리', { exact: true }).waitFor();
  const card = () => page.locator('.sc-cal-record').filter({ has: page.getByRole('heading', { name: '캘린더 실제 녹음', exact: true }) });
  await card().getByRole('button', { name: '녹음 듣기', exact: true }).click();
  await card().locator('audio').evaluate(async audio => { await audio.play(); audio.pause(); });
  await card().getByLabel('이 순간의 메모').fill('달력에서 남긴 기억');
  await card().getByRole('button', { name: '메모 저장', exact: true }).click();
  await card().getByText('메모를 저장했어요.', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.sc-cal-record').length === 2);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZsFAAAAAASUVORK5CYII=', 'base64');
  await card().getByLabel('캘린더 실제 녹음 사진 선택').setInputFiles([{ name: 'one.png', mimeType: 'image/png', buffer: png }, { name: 'two.png', mimeType: 'image/png', buffer: png }]);
  await card().getByText('사진을 저장했어요.', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.sc-cal-photo img').length === 2 && [...document.querySelectorAll('.sc-cal-photo img')].every(img => img.naturalWidth > 0));
  data = await snapshot();
  const actual = data.records.find(record => record.title === '캘린더 실제 녹음');
  assert.equal(actual.memo, '달력에서 남긴 기억'); assert.equal(actual.photoUrls.length, 2); assert.equal(data.photoIds.length, 2); assert(actual.photoUrls.every(url => url.startsWith('indexeddb://soundcapsule/photos/')));
  const initialPhotos = [...actual.photoUrls];
  console.log('PASS: local-date dot/list, month navigation, empty state, shared audio playback, memo and photo add/preview');
  // 새로고침에는 v1 시드 실행이 필요 없으므로 새 페이지를 사용합니다.
  const fresh = await context.newPage();
  await fresh.goto(BASE_URL);
  await fresh.getByRole('button', { name: '캘린더', exact: true }).click();
  const freshCard = fresh.locator('.sc-cal-record').filter({ has: fresh.getByRole('heading', { name: '캘린더 실제 녹음', exact: true }) });
  await freshCard.getByLabel('이 순간의 메모').waitFor();
  assert.equal(await freshCard.getByLabel('이 순간의 메모').inputValue(), '달력에서 남긴 기억');
  assert.equal(await freshCard.locator('.sc-cal-photo').count(), 2);
  // 편집 중 날짜/화면 이동 취소
  await freshCard.getByLabel('이 순간의 메모').fill('저장 전 메모');
  fresh.once('dialog', dialog => dialog.dismiss()); await fresh.getByRole('button', { name: '이전 달', exact: true }).click();
  assert.equal(await freshCard.getByLabel('이 순간의 메모').inputValue(), '저장 전 메모');
  fresh.once('dialog', dialog => dialog.dismiss()); await fresh.getByRole('button', { name: '홈 · 녹음', exact: true }).click();
  assert.equal(await freshCard.count(), 1);
  await freshCard.getByLabel('이 순간의 메모').fill('달력에서 남긴 기억');
  await freshCard.getByRole('button', { name: '메모 저장', exact: true }).click();
  await freshCard.getByText('메모를 저장했어요.', { exact: true }).waitFor();
  // 사진 삭제 실패의 원자적 롤백
  await fresh.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'recordings' && !window.allowWrite) throw new Error('검증용 저장 실패'); return original.apply(this, args); };
  });
  fresh.once('dialog', dialog => dialog.accept()); await freshCard.getByRole('button', { name: '사진 삭제', exact: true }).first().click();
  await freshCard.getByText('검증용 저장 실패', { exact: true }).waitFor();
  data = await snapshot(); assert.equal(data.photoIds.length, 2); assert.deepEqual(data.records.find(record => record.id === actual.id).photoUrls, initialPhotos);
  await fresh.evaluate(() => { window.allowWrite = true; });
  fresh.once('dialog', dialog => dialog.accept()); await freshCard.getByRole('button', { name: '사진 삭제', exact: true }).first().click();
  await freshCard.getByText('사진을 삭제했어요.', { exact: true }).waitFor();
  await fresh.waitForFunction(() => document.querySelectorAll('.sc-cal-photo').length === 1);
  data = await snapshot(); assert.equal(data.photoIds.length, 1); assert.equal(data.records.find(record => record.id === actual.id).photoUrls.length, 1);
  console.log('PASS: memo/photo persistence, unsaved navigation guards, atomic photo delete rollback and successful retry');
  await fresh.evaluate(() => { window.allowWrite = false; });
  await freshCard.getByLabel('이 순간의 메모').fill('저장 실패한 메모');
  await freshCard.getByRole('button', { name: '메모 저장', exact: true }).click();
  await freshCard.getByText('검증용 저장 실패', { exact: true }).waitFor();
  assert.equal(await freshCard.getByLabel('이 순간의 메모').inputValue(), '저장 실패한 메모');
  data = await snapshot(); assert.equal(data.records.find(record => record.id === actual.id).memo, '달력에서 남긴 기억');
  await fresh.evaluate(() => { window.allowWrite = true; });
  await freshCard.getByLabel('이 순간의 메모').fill('달력에서 남긴 기억');
  await freshCard.getByRole('button', { name: '메모 저장', exact: true }).click();
  await freshCard.getByText('메모를 저장했어요.', { exact: true }).waitFor();
  // 다른 탭 수정 알림으로 현재 캘린더 갱신
  await page.evaluate(async id => { const storage = await import('/src/storage/recordings.js'); await storage.updateRecordingMemo(id, '다른 탭에서 수정'); }, actual.id);
  await fresh.waitForFunction(() => [...document.querySelectorAll('textarea')].some(input => input.value === '다른 탭에서 수정'));
  await fresh.reload();
  await fresh.getByRole('button', { name: '캘린더', exact: true }).click();
  await freshCard.getByLabel('이 순간의 메모').waitFor();
  assert.equal(await freshCard.getByLabel('이 순간의 메모').inputValue(), '다른 탭에서 수정');
  assert.equal(await freshCard.locator('.sc-cal-photo').count(), 1);
  console.log('PASS: memo failure retains edited text and previous stored value; real reload retains saved memo and remaining photo');
  for (const width of [320, 390, 1440]) { await fresh.setViewportSize({ width, height: 900 }); assert.equal(await fresh.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  await fresh.setViewportSize({ width: 390, height: 844 });
  await fresh.getByRole('button', { name: '홈 · 녹음', exact: true }).click();
  await fresh.getByRole('button', { name: '캘린더 실제 녹음 메뉴', exact: true }).click();
  fresh.once('dialog', dialog => dialog.accept()); await fresh.getByRole('menuitem', { name: '삭제', exact: true }).click();
  await fresh.getByText('녹음을 삭제했어요.', { exact: true }).waitFor();
  await fresh.getByRole('button', { name: '캘린더', exact: true }).click();
  await fresh.getByText('1개의 소리', { exact: true }).waitFor();
  data = await snapshot(); assert.equal(data.photoIds.length, 0); assert.deepEqual(data.audioIds, ['legacy']); assert.equal(data.records[0].memo, '기존 메모');
  assert.deepEqual(errors, []);
  console.log('PASS: cross-tab refresh, responsive layouts, home deletion reflected in calendar, attached photo cleanup and other recording preserved');
} finally { await browser.close(); }
});

test('실시간 시각·자정·과거/미래 제한', { timeout: 90_000 }, async () => {
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-06T05:00:00.000Z'));
  await page.goto(BASE_URL);
  const recordings = () => page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings());
  const record = async (title) => {
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByText('지금, 소리를 담고 있어요').waitFor();
    await page.waitForTimeout(3200);
    await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
    await page.getByLabel('제목 필수').fill(title);
    await page.getByLabel('장소 선택').fill('기록한 순간의 장소');
    assert.equal(await page.locator('input[type="date"],input[type="time"],input[type="datetime-local"]').count(), 0);
  };
  await record('홈 시작 시각');
  await page.clock.setFixedTime(new Date('2026-11-06T06:00:00.000Z'));
  await page.getByRole('button', { name: '소리 저장하기', exact: true }).click();
  await page.getByRole('heading', { name: '홈 시작 시각', exact: true }).waitFor();
  const preserved = (await recordings())[0];
  assert.equal(preserved.recordedAt, '2026-11-06T05:00:00.000Z');
  assert.equal(preserved.savedAt, '2026-11-06T06:00:00.000Z');
  assert.equal(preserved.createdAt, '2026-11-06T06:00:00.000Z');
  assert.equal(preserved.location.name, '기록한 순간의 장소');
  const localDisplay = await page.locator('.sc-saved-card time').innerText();
  assert(localDisplay.includes('3:00:00'), localDisplay);
  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page.getByText('1개의 소리', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 1);
  for (const day of [5, 7]) {
    await page.getByRole('button', { name: new RegExp(`^2026년 11월 ${day}일,`) }).click();
    assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('제목 필수').count(), 0);
  }
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await record('달력 시작 시각');
  const firstDraftTimestamp = await page.locator('.sc-draft time').getAttribute('datetime');
  assert.equal(firstDraftTimestamp, '2026-11-06T06:00:00.000Z');
  await page.clock.setFixedTime(new Date('2026-11-06T06:10:00.000Z'));
  await page.getByRole('button', { name: '소리 저장하기', exact: true }).click();
  await page.getByRole('heading', { name: '달력 시작 시각', exact: true }).waitFor();
  await page.getByText('2개의 소리', { exact: true }).waitFor();
  assert.equal((await recordings()).find(record => record.title === '달력 시작 시각').recordedAt, firstDraftTimestamp);
  assert.equal(await page.locator('.sc-cal-grid [aria-current="date"] .sc-cal-dot').count(), 1);
  await page.getByRole('button', { name: '홈 · 녹음', exact: true }).click();
  await page.getByText('2개의 순간', { exact: true }).waitFor();
  assert.deepEqual((await recordings()).find(record => record.id === preserved.id), preserved);
  console.log('PASS: shared home/calendar recording, automatic savedAt and local display, past/future blocked, home/calendar immediate sync, existing record preserved');

  await page.getByRole('button', { name: '캘린더', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-11-06T14:59:58.000Z'));
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: /^2026년 11월 5일,/ }).click();
  assert.equal(await page.getByRole('button', { name: '녹음 종료', exact: true }).count(), 1);
  await page.clock.setFixedTime(new Date('2026-11-06T15:00:03.000Z'));
  await page.getByText('날짜가 바뀌었어요. 진행 중인 녹음은 저장을 완료한 날짜에 표시됩니다.', { exact: false }).waitFor();
  await page.getByText('날짜가 바뀌었어요. 진행 중인 녹음은 시작한 날짜에 저장됩니다.', { exact: false }).waitFor();
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').fill('자정을 넘긴 소리');
  assert.equal(await page.getByRole('button', { name: '다시 녹음하기', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('.sc-draft time').getAttribute('datetime'), '2026-11-06T14:59:58.000Z');
  await page.clock.setFixedTime(new Date('2026-11-06T15:10:00.000Z'));
  await page.getByRole('button', { name: '소리 저장하기', exact: true }).click();
  await page.getByRole('heading', { name: '자정을 넘긴 소리', exact: true }).waitFor();
  await page.getByText('1개의 소리', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 1);
  const midnightRecord = (await recordings()).find(record => record.title === '자정을 넘긴 소리');
  assert.equal(midnightRecord.recordedAt, '2026-11-06T14:59:58.000Z');
  assert.equal(midnightRecord.savedAt, '2026-11-06T15:10:00.000Z');
  assert.equal(midnightRecord.createdAt, '2026-11-06T15:10:00.000Z');
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 1);
  await page.getByText('1개의 소리', { exact: true }).waitFor();
  assert.equal(await page.locator('.sc-cal-grid [aria-current="date"] .sc-cal-dot').count(), 1);
  await page.getByRole('button', { name: /^2026년 11월 6일,/ }).click();
  await page.getByText('2개의 소리', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).count(), 0);
  assert.deepEqual((await recordings()).find(record => record.id === preserved.id), preserved);
  console.log('PASS: recording spanning local midnight is shown on save date; previous date cannot start/retry; new today is recordable; unsaved navigation cancellation');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '오늘', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(errors, []);

  const raceContext = await browser.newContext({ timezoneId: 'Asia/Seoul' });
  const race = await raceContext.newPage();
  await race.clock.setFixedTime(new Date('2026-11-06T14:59:58.000Z'));
  await race.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => {
      await new Promise(resolve => { window.resolvePermission = resolve; });
      const stream = await original(options); window.requestStream = stream; return stream;
    };
  });
  await race.goto(BASE_URL);
  await race.getByRole('button', { name: '캘린더', exact: true }).click();
  await race.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await race.getByRole('button', { name: '권한 요청 대기 취소', exact: true }).waitFor();
  await race.clock.setFixedTime(new Date('2026-11-06T15:00:03.000Z'));
  await race.evaluate(() => window.resolvePermission());
  await race.waitForFunction(() => window.requestStream?.getTracks().every(track => track.readyState === 'ended'));
  await race.getByText('새 녹음은 오늘 날짜에서만 남길 수 있어요.', { exact: true }).waitFor();
  assert.equal(await race.getByRole('button', { name: '녹음 종료', exact: true }).count(), 0);
  assert.equal(await race.locator('.sc-cal-record').count(), 0);
  console.log('PASS: permission resolving after midnight does not record into the previously selected day, microphone released, responsive bounds and no browser errors');
} finally { await browser.close(); }
});

test('권한 취소·미지원 API·저장소 차단', { timeout: 90_000 }, async () => {
const browser = await launchBrowser();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let calls = 0;
    navigator.mediaDevices.getUserMedia = async options => {
      calls++;
      if (calls === 1) {
        await new Promise(resolve => { window.finishPermission = resolve; });
        const stream = await original(options);
        window.lateStream = stream;
        return stream;
      }
      const stream = await original(options);
      window.activeStream = stream;
      return stream;
    };
  });
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByRole('button', { name: '권한 요청 대기 취소' }).click();
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await page.getByText('지금, 소리를 담고 있어요').waitFor();
  await page.evaluate(() => window.finishPermission());
  await page.waitForFunction(() => window.lateStream?.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(await page.evaluate(() => window.activeStream.getTracks().every(track => track.readyState === 'live')), true);
  await page.waitForTimeout(3200);
  await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await page.getByLabel('제목 필수').waitFor();
  console.log('PASS: cancel pending permission, retry, and release late permission stream without disrupting active recording');
  const unsupported = await context.newPage();
  await unsupported.addInitScript(() => { window.MediaRecorder = undefined; });
  await unsupported.goto(BASE_URL);
  await unsupported.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await unsupported.getByText('이 브라우저는 녹음을 지원하지 않아요.', { exact: false }).waitFor();
  console.log('PASS: unsupported MediaRecorder feedback');
  const blocked = await context.newPage();
  await blocked.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get: () => undefined }); });
  await blocked.goto(BASE_URL);
  await blocked.getByText('저장한 기록을 불러오지 못했어요.', { exact: false }).waitFor();
  await blocked.getByRole('button', { name: '녹음 시작', exact: true }).click();
  await blocked.getByText('지금, 소리를 담고 있어요').waitFor();
  await blocked.waitForTimeout(3200);
  await blocked.getByRole('button', { name: '녹음 종료', exact: true }).click();
  await blocked.getByLabel('제목 필수').fill('저장소 실패 검증');
  await blocked.getByRole('button', { name: '소리 저장하기' }).click();
  await blocked.getByText('저장하지 못했어요.', { exact: false }).waitFor();
  assert.equal(await blocked.locator('audio').count(), 1);
  console.log('PASS: unavailable IndexedDB feedback and retained audio draft');
} finally { await browser.close(); }
});
