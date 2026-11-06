import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launchBrowser } from './helpers.js';

async function setup(browser, options = {}) {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul', viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.audioMetrics = { contexts: [], starts: [], closed: 0 };
    const Native = window.AudioContext;
    if (Native) window.AudioContext = class extends Native {
      constructor() { super(); this.testGains = []; window.audioMetrics.contexts.push(this); }
      createGain() { const gain = super.createGain(); this.testGains.push(gain); return gain; }
      createOscillator() {
        const node = super.createOscillator(), start = node.start.bind(node);
        node.start = (...args) => { window.audioMetrics.starts.push(node.frequency.value); return start(...args); };
        return node;
      }
      close() { window.audioMetrics.closed++; return super.close(); }
    };
  });
  await page.clock.setFixedTime(new Date('2026-11-30T03:00:00.000Z'));
  await page.goto(BASE_URL);
  await page.getByRole('heading', { name: '담아둔 소리', exact: true }).waitFor();
  return { page, context, errors };
}

async function saveAt(page, date) {
  await page.clock.setFixedTime(new Date(`${date}T03:00:00.000Z`));
  return page.evaluate(async () => (await import('/src/storage/recordings.js')).saveRecording({ blob: new Blob(['piano ui fixture'], { type: 'audio/webm' }), title: '피아노 화면 테스트', duration: 3, recordedAt: new Date().toISOString() }));
}

async function seedCounts(page, counts, previous = [0, 0, 0, 0, 0, 0, 0]) {
  const records = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const dates = Array.from({ length: 30 }, (_, index) => index + 1).filter(day => ((new Date(Date.UTC(2026, 10, day)).getUTCDay() + 6) % 7 + 1) === weekday);
    for (const day of dates.slice(previous[weekday - 1], counts[weekday - 1])) records.push(await saveAt(page, `2026-11-${String(day).padStart(2, '0')}`));
  }
  await page.clock.setFixedTime(new Date('2026-11-30T03:00:00.000Z'));
  return records;
}

async function openPiano(page) {
  await page.getByRole('button', { name: '🎵 음표', exact: true }).click();
  await page.getByRole('heading', { name: '🎵 나의 음표', exact: true }).waitFor();
  await page.getByText('음표 기록을 불러오는 중…', { exact: true }).waitFor({ state: 'hidden' });
}
const starts = page => page.evaluate(() => window.audioMetrics.starts.length);

test('6개 탭·빈 화면·잠금 안내·월 이동·기존 그룹/지도/친구/설정 경로', async () => {
  const browser = await launchBrowser();
  try {
    const { page, errors } = await setup(browser);
    assert.deepEqual(await page.locator('.sidebar nav button').allTextContents(), ['홈 · 녹음', '캘린더', '지도', '🎵 음표', '친구', '설정']);
    await openPiano(page);
    assert.equal(await page.locator('.piano-key').count(), 7);
    assert.deepEqual(await page.locator('.piano-key-name').allTextContents(), ['월', '화', '수', '목', '금', '토', '일']);
    assert.equal(await page.locator('.piano-key[aria-disabled="true"]').count(), 7);
    await page.locator('.piano-key').first().evaluate(button => button.click());
    await page.locator('.piano-guidance').filter({ hasText: '월요일에 2일 더 녹음하면 도 건반을 연주할 수 있어요!' }).waitFor();
    assert.equal(await page.evaluate(() => window.audioMetrics.contexts.length), 0);
    await page.getByRole('button', { name: '다음 달 음표', exact: true }).click();
    await page.getByRole('heading', { name: '2026년 12월', exact: true }).waitFor();
    await page.getByText('음표 기록을 불러오는 중…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.piano-key.is-unlocked').count(), 0);
    await page.getByRole('button', { name: '현재 달', exact: true }).click();
    await page.getByRole('heading', { name: '2026년 11월', exact: true }).waitFor();
    await page.getByRole('button', { name: '그룹 열기', exact: true }).click();
    await page.locator('.groups').waitFor();
    await page.getByRole('button', { name: '친구', exact: true }).click();
    await page.getByRole('heading', { name: '친구', exact: true }).waitFor();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
    await page.getByRole('button', { name: '지도', exact: true }).click();
    await page.getByRole('heading', { name: '나의 소리 지도', exact: true }).waitFor();
    await page.getByRole('button', { name: '캘린더', exact: true }).click();
    await page.getByRole('heading', { name: '소리로 돌아보는 하루', exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('게이지·키보드·동시/연속 연주·음량/음소거·달성 갱신·삭제 유지·오디오 정리', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { page, errors } = await setup(browser);
    await seedCounts(page, [2, 1, 2, 3, 4, 4, 0]);
    await openPiano(page);
    assert.deepEqual(await page.getByRole('progressbar').evaluateAll(items => items.map(item => item.getAttribute('aria-valuenow'))), ['2', '1', '2', '3', '4', '4', '0']);
    assert.equal(await page.locator('.piano-summary strong').innerText(), '5/7');
    assert.equal(await page.locator('.piano-key').nth(1).evaluate(button => button.style.getPropertyValue('--key-fill')), '25%');
    assert.equal(await page.evaluate(() => window.audioMetrics.contexts.length), 0);
    await page.locator('.piano-key').nth(1).evaluate(button => button.click());
    await page.locator('.piano-guidance').filter({ hasText: '화요일에 하루만 더 녹음하면 레 건반이 열려요!' }).waitFor();
    assert.equal(await starts(page), 0);
    await page.locator('.piano-key').first().click();
    await page.waitForFunction(() => window.audioMetrics.starts.length === 4);
    assert(Math.abs(await page.evaluate(() => window.audioMetrics.starts[0]) - 261.625565) < .01);
    await page.keyboard.down('a'); await page.keyboard.down('d'); await page.keyboard.up('a'); await page.keyboard.up('d');
    await page.waitForFunction(() => window.audioMetrics.starts.length === 12);
    await page.locator('.piano-key').nth(3).dispatchEvent('pointerdown', { pointerId: 11, pointerType: 'touch', button: 0 });
    await page.locator('.piano-key').nth(4).dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', button: 0 });
    await page.waitForFunction(() => window.audioMetrics.starts.length === 20);
    const volume = page.getByLabel('음량', { exact: false });
    await volume.focus(); await volume.press('Home');
    assert.equal(await volume.inputValue(), '0');
    const before = await starts(page); await page.locator('.piano-key').first().click(); assert.equal(await starts(page), before);
    await volume.focus(); await volume.press('End'); assert.equal(await volume.inputValue(), '100');
    await page.keyboard.press('a'); assert.equal(await starts(page), before); // 입력 필드의 단축키는 무시
    await page.getByRole('button', { name: '음소거', exact: true }).click();
    await page.locator('.piano-key').first().click(); assert.equal(await starts(page), before);
    await page.getByRole('button', { name: '음소거 해제', exact: true }).click();
    await page.locator('.piano-key').first().click(); await page.waitForFunction(count => window.audioMetrics.starts.length > count, before);
    const recording = await saveAt(page, '2026-11-16');
    await page.waitForFunction(() => document.querySelector('[aria-label="월요일 기록 진행도"]').getAttribute('aria-valuenow') === '3');
    await page.evaluate(async id => (await import('/src/storage/recordings.js')).deleteRecording(id), recording.id);
    assert.equal(await page.getByRole('progressbar', { name: '월요일 기록 진행도' }).getAttribute('aria-valuenow'), '3');
    await page.getByRole('button', { name: '홈 · 녹음', exact: true }).click();
    await page.waitForFunction(() => window.audioMetrics.contexts.every(context => context.state === 'closed'));
    assert.equal(await page.evaluate(() => window.audioMetrics.closed), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('과거 월 연주·모든 건반 축하와 월간 100% 구분·5일 상한·줄인 동작', { timeout: 90_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { page } = await setup(browser);
    await seedCounts(page, [2, 2, 2, 2, 2, 2, 2]);
    await saveAt(page, '2026-10-05'); await saveAt(page, '2026-10-12');
    await page.clock.setFixedTime(new Date('2026-11-30T03:00:00.000Z'));
    await openPiano(page);
    await page.getByText('🎶 모든 음을 연주할 수 있어요!', { exact: true }).waitFor();
    assert.equal(await page.getByText('🌈 이번 달 피아노 완성!', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '이전 달 음표', exact: true }).click();
    await page.getByText('음표 기록을 불러오는 중…', { exact: true }).waitFor({ state: 'hidden' });
    await page.locator('.piano-key').first().click(); await page.waitForFunction(() => window.audioMetrics.starts.length === 4);
    await page.getByRole('button', { name: '현재 달', exact: true }).click();
    await seedCounts(page, [5, 4, 4, 4, 4, 4, 4], [2, 2, 2, 2, 2, 2, 2]);
    await page.getByText('🌈 이번 달 피아노 완성!', { exact: true }).waitFor();
    assert.equal(await page.getByRole('progressbar', { name: '월요일 기록 진행도' }).getAttribute('aria-valuenow'), '4');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.piano-celebration.is-complete').evaluate(element => getComputedStyle(element).animationName), 'none');
  } finally { await browser.close(); }
});

test('조회 실패 재시도·미확정 기록 안내·오디오 초기화 실패 복구', async () => {
  const browser = await launchBrowser();
  try {
    const { page, errors } = await setup(browser); await seedCounts(page, [2, 0, 0, 0, 0, 0, 0]);
    await page.evaluate(() => { window.realOpen = indexedDB.open.bind(indexedDB); indexedDB.open = () => { throw new Error('test unavailable'); }; });
    await openPiano(page);
    await page.getByText('음표 기록을 불러오지 못했어요.', { exact: false }).waitFor();
    await page.evaluate(() => { indexedDB.open = window.realOpen; });
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.piano-key').getAttribute('aria-disabled') === 'false');
    await page.evaluate(() => { window.goodAudio = window.AudioContext; window.AudioContext = class { constructor() { throw new Error('test denied'); } }; });
    await page.locator('.piano-key').first().click();
    await page.getByText('소리를 시작하지 못했어요.', { exact: false }).waitFor();
    await page.evaluate(() => { window.AudioContext = window.goodAudio; });
    await page.locator('.piano-key').first().click(); await page.waitForFunction(() => window.audioMetrics.starts.length === 4);
    await page.evaluate(async () => {
      const piano = await import('/src/domain/piano/index.js');
      const current = await piano.getMonthlyPiano('2026-11');
      const { runTransaction } = await import('/src/storage/database.js');
      await runTransaction(['pianoEvents'], 'readwrite', tx => tx.objectStore('pianoEvents').add(piano.createSaveIntent({ id: 'lost-completion-ui-test', userId: current.userId, duration: 3 })));
      window.dispatchEvent(new Event('focus'));
    });
    await page.getByText('복구 확인이 필요해요.', { exact: false }).waitFor();
    await page.getByRole('button', { name: '기록 다시 확인', exact: true }).click();
    await page.getByText('복구 확인이 필요해요.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('progressbar', { name: '월요일 기록 진행도' }).getAttribute('aria-valuenow'), '2');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('모바일 6탭·실제 터치 경로·좁은 화면·로그인 제한·작성 중 화면 이동 확인', { timeout: 60_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { page, context, errors } = await setup(browser, { isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
    await seedCounts(page, [2, 0, 0, 0, 0, 0, 0]);
    await openPiano(page);
    assert.deepEqual(await page.locator('.bottom button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['홈 · 녹음', '캘린더', '지도', '🎵 음표', '친구', '설정']);
    await page.locator('.piano-key').first().tap(); await page.waitForFunction(() => window.audioMetrics.starts.length === 4);
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
    if (process.env.PIANO_SCREENSHOT) await page.screenshot({ path: process.env.PIANO_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.piano-scroll').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.PIANO_MOBILE_SCREENSHOT) { await page.waitForTimeout(150); await page.screenshot({ path: process.env.PIANO_MOBILE_SCREENSHOT, fullPage: true }); }
    await page.getByRole('button', { name: '그룹 열기', exact: true }).tap(); await page.locator('.groups').waitFor();
    await page.getByRole('button', { name: '홈 · 녹음', exact: true }).tap();
    await page.getByRole('button', { name: '녹음 시작', exact: true }).tap(); await page.getByText('지금, 소리를 담고 있어요').waitFor();
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '🎵 음표', exact: true }).tap();
    assert.equal(await page.getByRole('button', { name: '녹음 종료', exact: true }).count(), 1);
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '🎵 음표', exact: true }).tap();
    await page.getByRole('heading', { name: '🎵 나의 음표', exact: true }).waitFor();
    const locked = await context.newPage();
    await locked.addInitScript(() => localStorage.setItem('soundcapsule:session', 'null'));
    await locked.goto(BASE_URL);
    assert.equal(await locked.locator('.piano-page').count(), 0);
    assert.equal(await locked.getByRole('button', { name: '🎵 음표', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('다른 탭에서 로그인 사용자가 바뀌면 이전 사용자의 건반 상태를 보여주지 않는다', async () => {
  const browser = await launchBrowser();
  try {
    const { page, context } = await setup(browser);
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'piano-alice', name: 'Alice' })));
    await page.reload();
    await seedCounts(page, [2, 0, 0, 0, 0, 0, 0]);
    await openPiano(page);
    assert.equal(await page.locator('.piano-key.is-unlocked').count(), 1);
    await page.locator('.piano-key').first().click(); await page.waitForFunction(() => window.audioMetrics.starts.length === 4);
    const other = await context.newPage(); await other.goto(BASE_URL);
    await other.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'piano-bob', name: 'Bob' })));
    await page.waitForFunction(() => document.querySelectorAll('.piano-key.is-unlocked').length === 0);
    await page.getByText('음표 기록을 불러오는 중…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('progressbar', { name: '월요일 기록 진행도' }).getAttribute('aria-valuenow'), '0');
    await assert.rejects(() => page.evaluate(async () => (await import('/src/domain/piano/index.js')).getMonthlyPiano('2026-11', { userId: 'piano-alice' })), /조회 권한/);
    await page.evaluate(() => localStorage.setItem('soundcapsule:session', JSON.stringify({ id: 'piano-alice', name: 'Alice' })));
    const alice = await page.evaluate(async () => (await import('/src/domain/piano/index.js')).getMonthlyPiano('2026-11'));
    assert.equal(alice.weekdays[0].uniqueDateCount, 2);
  } finally { await browser.close(); }
});
