import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { groupByLocalDate, localDateKey, monthCells } from '../src/features/calendar/calendarDates.js';

test('윤년과 평년의 월 길이, 시작 요일, 빈 칸을 계산한다', () => {
  const leap = monthCells(2024, 1);
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap.findIndex(Boolean), 4);
  assert.equal(leap.length % 7, 0);
  assert.equal(monthCells(2025, 1).filter(Boolean).length, 28);
  assert.equal(monthCells(2026, 10).filter(Boolean).length, 30);
});

test('연도 경계를 넘는 월도 Date의 달력 규칙을 따른다', () => {
  assert.equal(monthCells(2026, 12).find(Boolean).getFullYear(), 2027);
  assert.equal(monthCells(2026, -1).find(Boolean).getMonth(), 11);
});

test('현지 날짜별 그룹화와 유효하지 않은 시각을 처리한다', () => {
  const first = { id: 'one', recordedAt: new Date(2026, 10, 6, 0, 30).toISOString() };
  const second = { id: 'two', recordedAt: new Date(2026, 10, 6, 23, 30).toISOString() };
  const groups = groupByLocalDate([first, second, { recordedAt: 'invalid' }]);
  assert.deepEqual(groups.get('2026-11-06'), [first, second]);
  assert.equal(groups.size, 1);
  assert.equal(localDateKey('invalid'), null);
});

test('자정을 넘겨 저장해도 생성/수정 시각 대신 녹음 시작 날짜로 분류한다', () => {
  const beforeMidnight = {
    id: 'before',
    recordedAt: new Date(2026, 10, 6, 23, 59, 58).toISOString(),
    createdAt: new Date(2026, 10, 7, 0, 10).toISOString(),
    updatedAt: new Date(2026, 10, 8, 12).toISOString(),
  };
  const afterMidnight = { id: 'after', recordedAt: new Date(2026, 10, 7, 0, 0, 1).toISOString() };
  const groups = groupByLocalDate([beforeMidnight, afterMidnight]);
  assert.deepEqual(groups.get('2026-11-06'), [beforeMidnight]);
  assert.deepEqual(groups.get('2026-11-07'), [afterMidnight]);
});

test('연말 자정에도 이전 해에 시작한 녹음의 날짜를 유지한다', () => {
  const recording = { recordedAt: new Date(2026, 11, 31, 23, 59, 59).toISOString(), createdAt: new Date(2027, 0, 1, 0, 1).toISOString() };
  assert.deepEqual(groupByLocalDate([recording]).get('2026-12-31'), [recording]);
});

test('UTC 자정이 아닌 현지 자정을 기준으로 날짜를 분류한다', () => {
  const moduleUrl = new URL('../src/features/calendar/calendarDates.js', import.meta.url).href;
  for (const [timezone, expected] of [['Asia/Seoul', '2026-11-07'], ['America/Los_Angeles', '2026-11-06']]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {localDateKey} from ${JSON.stringify(moduleUrl)}; process.stdout.write(localDateKey('2026-11-06T16:30:00.000Z'));`], { env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});
