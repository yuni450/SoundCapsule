import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMonthlyPiano, createCompletionEvent, localDateAt, PIANO_KEYS, validateWeekday, validateYearMonth } from '../src/domain/piano/model.js';

const achievement = (localDate, userId = 'alice') => ({ userId, localDate, yearMonth: localDate.slice(0, 7) });
const summarize = (days) => aggregateMonthlyPiano(days.map((day) => achievement(day)), '2026-11', 'alice');

test('월~일 음계와 파스텔 색상 매핑은 고정되어 있다', () => {
  assert.deepEqual(PIANO_KEYS.map((key) => key.weekday), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(PIANO_KEYS.map((key) => key.pitch), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  assert.deepEqual(PIANO_KEYS.map((key) => key.note), ['도', '레', '미', '파', '솔', '라', '시']);
  assert(PIANO_KEYS.every((key) => /^#[A-F0-9]{6}$/.test(key.color) && Object.isFrozen(key)));
});

test('월요일 고유 날짜 0~5개는 0~4칸/25% 단위이며 2일부터 활성화한다', () => {
  const mondays = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'];
  for (let count = 0; count <= 5; count++) {
    const result = summarize(mondays.slice(0, count)).weekdays[0];
    assert.equal(result.uniqueDateCount, count);
    assert.equal(result.filledSlots, Math.min(count, 4));
    assert.equal(result.percent, Math.min(count, 4) * 25);
    assert.equal(result.isUnlocked, count >= 2);
  }
});

test('같은 날짜 중복과 다른 사용자/월은 집계하지 않는다', () => {
  const result = aggregateMonthlyPiano([achievement('2026-11-02'), achievement('2026-11-02'), achievement('2026-11-09', 'bob'), achievement('2026-12-07')], '2026-11', 'alice');
  assert.equal(result.weekdays[0].uniqueDateCount, 1);
  assert.equal(result.unlockedKeyCount, 0);
});

test('모든 건반 활성화와 모든 게이지 100%는 다르다', () => {
  const dates = (count) => Array.from({ length: count }, (_, index) => `2026-11-${String(index + 2).padStart(2, '0')}`);
  const unlocked = summarize(dates(14));
  assert.equal(unlocked.unlockedKeyCount, 7); assert.equal(unlocked.allKeysUnlocked, true); assert.equal(unlocked.monthlyComplete, false);
  const complete = summarize(dates(28));
  assert.equal(complete.allKeysUnlocked, true); assert.equal(complete.monthlyComplete, true);
});

test('선택한 월만 계산하며 입력 원장을 변경하지 않는다', () => {
  const records = [achievement('2026-11-02'), achievement('2026-11-09')];
  const before = structuredClone(records);
  assert.equal(aggregateMonthlyPiano(records, '2026-12', 'alice').unlockedKeyCount, 0);
  assert.deepEqual(records, before);
  assert.equal(aggregateMonthlyPiano(records, '2026-11', 'alice').weekdays[0].percent, 50);
});

test('시작 시각과 무관하게 저장 완료 시각의 현지 날짜/월을 캡처한다', () => {
  const event = createCompletionEvent({ id: 'one', userId: 'alice', duration: 3, recordedAt: '2026-11-30T14:59:00.000Z' }, '2026-11-30T15:01:00.000Z', 'Asia/Seoul');
  assert.equal(event.localDate, '2026-12-01'); assert.equal(event.yearMonth, '2026-12');
  assert.equal(localDateAt(event.savedAt, 'America/Los_Angeles'), '2026-11-30');
  assert.equal(event.localDate, '2026-12-01');
  assert.equal(event.timeZone, 'Asia/Seoul');
});

test('3초 미만, 잘못된 날짜/월/요일/시간대는 거절한다', () => {
  assert.throws(() => createCompletionEvent({ id: 'one', userId: 'alice', duration: 2.99 }, '2026-11-06T00:00:00.000Z', 'UTC'));
  for (const value of ['2026-00', '2026-13', '26-11', '0000-11']) assert.throws(() => validateYearMonth(value));
  for (const value of [0, 8, '1', 2.5]) assert.throws(() => validateWeekday(value));
  assert.throws(() => localDateAt('2026-02-30T00:00:00.000Z', 'UTC'));
  assert.throws(() => localDateAt('2026-11-06T00:00:00.000Z', 'Invalid/Timezone'));
});
