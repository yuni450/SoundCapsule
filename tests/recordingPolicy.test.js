import test from 'node:test';
import assert from 'node:assert/strict';
import { isSavableRecordingDuration, MIN_RECORDING_MESSAGE, MIN_RECORDING_SECONDS } from '../src/lib/recordingPolicy.js';

test('3초 경계는 표시값이 아닌 실제 초 값으로 검사한다', () => {
  assert.equal(MIN_RECORDING_SECONDS, 3);
  assert.equal(MIN_RECORDING_MESSAGE, '최소 3초 이상 녹음해야 저장할 수 있어요!');
  for (const seconds of [0, 2, 2.999, 2.999999]) assert.equal(isSavableRecordingDuration(seconds), false);
  for (const seconds of [3, 3.000001, 10]) assert.equal(isSavableRecordingDuration(seconds), true);
});

test('음수, 무한수, NaN, 숫자가 아닌 값으로 최소 시간을 우회할 수 없다', () => {
  for (const value of [-1, Infinity, NaN, '3', null, undefined]) assert.equal(isSavableRecordingDuration(value), false);
});
