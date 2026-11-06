import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, launchBrowser } from './helpers.js';

const message = '최소 3초 이상 녹음해야 저장할 수 있어요!';

for (const screen of ['홈', '캘린더']) {
  test(`${screen}: 실제 2초 녹음은 버리고 3초 이상 녹음만 저장한다`, { timeout: 60_000 }, async () => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage({ timezoneId: 'Asia/Seoul' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async options => {
          const stream = await original(options); window.testStream = stream; return stream;
        };
      });
      await page.clock.setFixedTime(new Date('2026-11-06T03:00:00.000Z'));
      await page.goto(BASE_URL);
      if (screen === '캘린더') await page.getByRole('button', { name: '캘린더', exact: true }).click();
      const records = () => page.evaluate(async () => (await import('/src/storage/recordings.js')).listRecordings());
      await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
      await page.getByText('지금, 소리를 담고 있어요').waitFor();
      await page.waitForTimeout(2100);
      // 표시 숫자가 길어 보여도 저장 판정은 실제 경과 시간을 사용해야 합니다.
      await page.locator('.sc-timer').evaluate(timer => { timer.textContent = '00:10'; });
      await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
      await page.getByText(message, { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '소리 저장하기', exact: true }).count(), 0);
      assert.equal(await page.locator('form.sc-draft, audio').count(), 0);
      assert.equal((await records()).length, 0);
      const emptyPiano = await page.evaluate(async () => (await import('/src/domain/piano/index.js')).getMonthlyPiano('2026-11'));
      assert.equal(emptyPiano.weekdays.reduce((sum, day) => sum + day.uniqueDateCount, 0), 0);
      assert.equal(await page.evaluate(() => window.testStream.getTracks().every(track => track.readyState === 'ended')), true);

      // 표시 타이머 업데이트를 멈춰도 실제 3초 이상이면 정상 초안이어야 합니다.
      await page.evaluate(() => {
        const interval = window.setInterval;
        window.setInterval = (callback, delay, ...args) => interval(delay === 250 ? () => {} : callback, delay, ...args);
      });
      await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
      await page.getByText('지금, 소리를 담고 있어요').waitFor();
      await page.waitForTimeout(3200);
      assert.equal(await page.locator('.sc-timer').innerText(), '00:00');
      await page.getByRole('button', { name: '녹음 종료', exact: true }).click();
      await page.getByLabel('제목 필수').fill(`${screen} 3초 녹음`);
      await page.getByRole('button', { name: '소리 저장하기', exact: true }).click();
      await page.getByRole('heading', { name: `${screen} 3초 녹음`, exact: true }).waitFor();
      const saved = await records();
      assert.equal(saved.length, 1); assert(saved[0].duration >= 3);
      const piano = await page.evaluate(async userId => (await import('/src/domain/piano/index.js')).getMonthlyPiano('2026-11', { userId }), saved[0].userId);
      assert.equal(piano.weekdays[4].uniqueDateCount, 1);
      assert.equal(await page.getByText(message, { exact: true }).count(), 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('저장 API 직접 호출도 3초 미만이면 DB에 정보를 남기지 않는다', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); await page.goto(BASE_URL);
    const result = await page.evaluate(async () => {
      const storage = await import('/src/storage/recordings.js');
      const rejected = [];
      for (const duration of [2, 2.999, NaN, Infinity]) {
        try {
          await storage.saveRecording({ blob: new Blob(['test'], { type: 'audio/webm' }), title: '짧은 녹음', duration, recordedAt: new Date().toISOString() });
          rejected.push(null);
        } catch (error) { rejected.push(error.message); }
      }
      const before = await storage.listRecordings();
      await storage.saveRecording({ blob: new Blob(['test'], { type: 'audio/webm' }), title: '정확히 3초', duration: 3, recordedAt: new Date().toISOString() });
      const after = await storage.listRecordings();
      return { rejected, before, after };
    });
    assert.deepEqual(result.rejected, [message, message, message, message]);
    assert.equal(result.before.length, 0); assert.equal(result.after.length, 1); assert.equal(result.after[0].duration, 3);
  } finally { await browser.close(); }
});
