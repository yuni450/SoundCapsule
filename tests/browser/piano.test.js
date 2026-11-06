import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launchBrowser } from './helpers.js';

async function setup(browser, savedAt = '2026-11-02T03:00:00.000Z') {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(savedAt));
  await page.goto(BASE_URL);
  return { context, page };
}

async function save(page, overrides = {}) {
  return page.evaluate(async overrides => (await import('/src/storage/recordings.js')).saveRecording({
    title: '피아노 통합 검증', blob: new Blob(['test audio'], { type: 'audio/webm' }), recordedAt: new Date().toISOString(), duration: 3, ...overrides,
  }), overrides);
}

async function month(page, yearMonth = '2026-11', userId) {
  return page.evaluate(async ({ yearMonth, userId }) => (await import('/src/domain/piano/index.js')).getMonthlyPiano(yearMonth, { userId }), { yearMonth, userId });
}

test('동일 날짜 병렬 저장·멱등 API·모든 파일 삭제·두 번째 월요일·과거 월 보존', async () => {
  const browser = await launchBrowser();
  try {
    const { page } = await setup(browser);
    await page.evaluate(async () => {
      window.changes = [];
      window.stopPiano = (await import('/src/domain/piano/index.js')).subscribePianoProgress(change => window.changes.push(change));
    });
    const records = await Promise.all([save(page), save(page), save(page)]);
    const owner = records[0].userId;
    let result = await month(page);
    assert.equal(result.weekdays[0].uniqueDateCount, 1); assert.equal(result.weekdays[0].percent, 25);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.changes.length), 1);
    const receipt = await page.evaluate(async recording => {
      const piano = await import('/src/domain/piano/index.js');
      const event = { userId: recording.userId, recordingId: recording.id, duration: recording.duration, savedAt: '2026-12-01T00:00:00.000Z', timeZone: 'UTC' };
      return Promise.all([piano.recordSuccessfulRecordingDay(event), piano.recordSuccessfulRecordingDay(event)]);
    }, records[0]);
    assert.deepEqual(receipt[0], receipt[1]); assert.equal(receipt[0].localDate, '2026-11-02');
    await page.evaluate(async ids => {
      const storage = await import('/src/storage/recordings.js');
      await Promise.all(ids.map(id => storage.deleteRecording(id)));
    }, records.map(record => record.id));
    result = await month(page); assert.equal(result.weekdays[0].percent, 25);
    assert.equal(await page.evaluate(() => window.changes.length), 1);
    await page.clock.setFixedTime(new Date('2026-11-09T03:00:00.000Z'));
    const secondDay = await save(page);
    const flags = await page.evaluate(async () => {
      const piano = await import('/src/domain/piano/index.js');
      return { day: await piano.getWeekdayProgress('2026-11', 1), unlocked: await piano.isKeyUnlocked('2026-11', 1), all: await piano.isAllKeysUnlocked('2026-11'), complete: await piano.isMonthlyPianoComplete('2026-11') };
    });
    assert.equal(flags.day.uniqueDateCount, 2); assert.equal(flags.day.percent, 50); assert.equal(flags.unlocked, true); assert.equal(flags.all, false); assert.equal(flags.complete, false);
    await page.evaluate(async id => (await import('/src/storage/recordings.js')).deleteRecording(id), secondDay.id);
    assert.equal((await month(page)).weekdays[0].isUnlocked, true);
    await page.waitForTimeout(150); assert.equal(await page.evaluate(() => window.changes.length), 2);
    assert.equal((await month(page, '2026-12')).unlockedKeyCount, 0);
    await page.reload();
    result = await month(page, '2026-11', owner); assert.equal(result.weekdays[0].percent, 50);
    assert.equal((await page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings())).length, 0);
  } finally { await browser.close(); }
});

test('시작·createdAt은 월말이어도 commit 완료가 다음 달이면 다음 달 달성, 시간대 변경 후 불변', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser, '2026-11-30T14:59:00.000Z');
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
      window.holdCommit = true;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = original.apply(this, args);
        if (tx.mode === 'readwrite' && tx.objectStoreNames.contains('audio') && tx.objectStoreNames.contains('pianoEvents')) {
          Object.defineProperty(tx, 'oncomplete', { set(handler) {
            descriptor.set.call(tx, event => {
              if (window.holdCommit) window.finishCommit = () => handler.call(tx, event);
              else handler.call(tx, event);
            });
          } });
        }
        return tx;
      };
    });
    const saving = save(page);
    await page.waitForFunction(() => typeof window.finishCommit === 'function');
    await page.clock.setFixedTime(new Date('2026-11-30T15:01:00.000Z'));
    await page.evaluate(() => { window.holdCommit = false; window.finishCommit(); });
    const recording = await saving;
    assert.equal(recording.createdAt, '2026-11-30T14:59:00.000Z');
    assert.equal(recording.recordedAt, '2026-11-30T14:59:00.000Z');
    assert.equal((await month(page, '2026-11')).weekdays.reduce((sum, day) => sum + day.uniqueDateCount, 0), 0);
    const december = await month(page, '2026-12'); assert.equal(december.weekdays[1].uniqueDateCount, 1);
    // Playwright가 소유한 시간대 override를 덮어쓰지 않고 같은 저장 상태를 새 시간대에서 엽니다.
    const westContext = await browser.newContext({ timezoneId: 'America/Los_Angeles', storageState: await context.storageState({ indexedDB: true }) });
    const west = await westContext.newPage(); await west.goto(BASE_URL);
    const retry = await west.evaluate(async recording => (await import('/src/domain/piano/index.js')).recordSuccessfulRecordingDay({ userId: recording.userId, recordingId: recording.id, duration: 3, savedAt: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), recording);
    assert.equal(retry.localDate, '2026-12-01'); assert.equal(retry.achievement.timeZone, 'Asia/Seoul');
    assert.equal(retry.achievement.firstAchievedAt, '2026-11-30T15:01:00.000Z');
    assert.equal((await month(west, '2026-12')).weekdays[1].uniqueDateCount, 1);
  } finally { await browser.close(); }
});

test('피아노 쓰기 실패 후 녹음은 성공, 파일 삭제·새로고침·다음 달 재시도에도 원래 날짜 복구', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser, '2026-11-06T03:00:00.000Z');
    await context.addInitScript(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'pianoAchievements' && localStorage.getItem('test-block-piano') === 'yes') throw new DOMException('quota test', 'QuotaExceededError');
        return original.apply(this, args);
      };
    });
    await page.reload();
    await page.evaluate(() => localStorage.setItem('test-block-piano', 'yes'));
    const recording = await save(page);
    let result = await month(page); assert.equal(result.weekdays[4].uniqueDateCount, 0); assert.equal(result.recovery.pending, 1);
    await page.evaluate(async id => (await import('/src/storage/recordings.js')).deleteRecording(id), recording.id);
    await page.clock.setFixedTime(new Date('2026-12-10T03:00:00.000Z'));
    await page.reload();
    result = await month(page, '2026-11'); assert.equal(result.recovery.pending, 1);
    const pending = await page.evaluate(async () => (await import('/src/domain/piano/index.js')).getPendingPianoEvents());
    assert.equal(pending[0].localDate, '2026-11-06'); assert.equal(pending[0].status, 'pending');
    await page.evaluate(() => localStorage.removeItem('test-block-piano'));
    const recovery = await page.evaluate(async () => (await import('/src/domain/piano/index.js')).retryPendingPianoEvents());
    assert.equal(recovery.errors.length, 0);
    result = await month(page, '2026-11'); assert.equal(result.weekdays[4].uniqueDateCount, 1);
    assert.equal((await month(page, '2026-12')).unlockedKeyCount, 0);
    assert.equal((await page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings())).length, 0);
  } finally { await browser.close(); }
});

test('실패 저장·3초 미만·과거 녹음·위조 이벤트는 달성하지 않는다', async () => {
  const browser = await launchBrowser();
  try {
    const { page } = await setup(browser);
    const rejected = await page.evaluate(async () => {
      const storage = await import('/src/storage/recordings.js');
      const piano = await import('/src/domain/piano/index.js');
      const original = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) { if (this.name === 'audio') throw new DOMException('quota', 'QuotaExceededError'); return original.apply(this, args); };
      const attempt = async duration => {
        try { await storage.saveRecording({ duration, recordedAt: new Date().toISOString(), title: 'failed', blob: new Blob(['test']) }); return false; }
        catch { return true; }
      };
      const failed = await attempt(3); const short = await attempt(2);
      IDBObjectStore.prototype.add = original;
      let forged;
      try { await piano.recordSuccessfulRecordingDay({ userId: 'alice', recordingId: 'missing', duration: 3, savedAt: new Date().toISOString(), timeZone: 'Asia/Seoul' }); forged = false; } catch { forged = true; }
      return { failed, short, forged, records: await storage.listRecordings(), result: await piano.getMonthlyPiano('2026-11') };
    });
    assert.equal(rejected.failed, true); assert.equal(rejected.short, true); assert.equal(rejected.forged, true); assert.equal(rejected.records.length, 0);
    assert.equal(rejected.result.weekdays.reduce((sum, day) => sum + day.uniqueDateCount, 0), 0);
    // 이미 존재하던 녹음에는 성공 intent가 없으므로 길이가 길어도 소급하지 않습니다.
    await page.evaluate(async () => {
      const model = await import('/src/models/recording.js');
      const db = await (await import('/src/storage/database.js')).openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['recordings', 'audio'], 'readwrite');
        const recording = model.createRecording({ id: 'legacy-only', userId: 'alice', title: '기존 파일', audioUrl: 'indexeddb://soundcapsule/audio/legacy-only', recordedAt: '2026-11-02T00:00:00.000Z', duration: 10 });
        tx.objectStore('recordings').add(recording); tx.objectStore('audio').add(new Blob(['old']), recording.id);
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
      }); db.close();
    });
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'alice', name: 'Alice' })));
    assert.equal((await month(page, '2026-11', 'alice')).weekdays[0].uniqueDateCount, 0);
  } finally { await browser.close(); }
});

test('로그인 소유자 분리와 다른 탭의 사용자/월 필터 변경 이벤트', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser);
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'alice', name: 'Alice' })));
    const observer = await context.newPage(); await observer.goto(BASE_URL);
    await observer.evaluate(async () => {
      window.updates = [];
      (await import('/src/domain/piano/index.js')).subscribePianoProgress(change => window.updates.push(change), { userId: 'alice', yearMonth: '2026-11' });
    });
    const alice = await save(page); assert.equal(alice.userId, 'alice');
    await observer.waitForFunction(() => window.updates.length === 1);
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'bob', name: 'Bob' })));
    const bob = await save(page); assert.equal(bob.userId, 'bob');
    assert.equal((await month(page)).userId, 'bob');
    await assert.rejects(() => month(page, '2026-11', 'alice'), /조회 권한/);
    assert.equal((await month(page, '2026-11', 'bob')).weekdays[0].uniqueDateCount, 1);
    await page.waitForTimeout(200);
    assert.equal(await observer.evaluate(() => window.updates.length), 1);
    const cannotSteal = await page.evaluate(async recording => {
      try { await (await import('/src/domain/piano/index.js')).recordSuccessfulRecordingDay({ userId: 'bob', recordingId: recording.id, duration: 3, savedAt: new Date().toISOString(), timeZone: 'Asia/Seoul' }); return false; } catch { return true; }
    }, alice);
    assert.equal(cannotSteal, true);
  } finally { await browser.close(); }
});

test('완료 이벤트의 IDB 쓰기 실패도 동기 저널로 삭제·재시작 후 복구한다', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser, '2026-11-06T03:00:00.000Z');
    await context.addInitScript(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'pianoEvents' && localStorage.getItem('test-block-event') === 'yes') throw new DOMException('event quota', 'QuotaExceededError');
        return original.apply(this, args);
      };
    });
    await page.reload();
    await page.evaluate(() => localStorage.setItem('test-block-event', 'yes'));
    const recording = await save(page);
    const pending = await page.evaluate(async () => (await import('/src/domain/piano/index.js')).getPendingPianoEvents());
    assert.equal(pending[0].status, 'awaiting-completion');
    await page.evaluate(async id => (await import('/src/storage/recordings.js')).deleteRecording(id), recording.id);
    await page.clock.setFixedTime(new Date('2026-12-10T03:00:00.000Z'));
    await page.reload();
    await page.evaluate(() => localStorage.removeItem('test-block-event'));
    const result = await month(page, '2026-11');
    assert.equal(result.weekdays[4].uniqueDateCount, 1); assert.equal(result.recovery.unresolved.length, 0);
  } finally { await browser.close(); }
});

test('DB와 완료 저널이 모두 실패하고 종료되면 날짜를 추정하지 않고 미확정 상태를 노출한다', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser);
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'pianoEvents') throw new DOMException('event quota', 'QuotaExceededError');
        return put.apply(this, args);
      };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('soundcapsule:piano-completion:')) throw new DOMException('journal quota', 'QuotaExceededError');
        return set.call(this, key, value);
      };
    });
    await page.reload();
    const recording = await save(page);
    await page.reload();
    const result = await month(page);
    assert.equal(result.recovery.unresolved.length, 1);
    assert.equal(result.weekdays[0].uniqueDateCount, 0);
    assert.equal((await page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings()))[0].id, recording.id);
  } finally { await browser.close(); }
});

test('randomUUID 미지원 환경에서도 피아노 모듈이 앱 초기 로드를 중단하지 않는다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
      localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'alice', name: 'Alice' }));
    });
    await page.goto(BASE_URL);
    await page.getByRole('heading', { name: '담아둔 소리', exact: true }).waitFor();
    assert.equal((await month(page)).unlockedKeyCount, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
