import test from 'node:test';
import assert from 'node:assert/strict';
import { PIANO_TONES, currentLocalMonth, lockedKeyMessage, nextWeekdayDate, shiftMonth } from '../src/features/piano/presentation.js';
import { createPianoAudio } from '../src/features/piano/audio.js';

test('7개 음높이와 키보드 단축키는 C4~B4 오름차순이다', () => {
  assert.deepEqual(PIANO_TONES.map(tone => tone.code), ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ']);
  assert.deepEqual(PIANO_TONES.map(tone => tone.noteId), ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
  assert.equal(PIANO_TONES[5].frequency, 440);
  assert(PIANO_TONES.slice(1).every((tone, index) => tone.frequency > PIANO_TONES[index].frequency));
});
test('월 이동은 연도 경계를 넘으며 허용 범위 밖으로 나가지 않는다', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('0001-01', -1), '0001-01'); assert.equal(shiftMonth('9999-12', 1), '9999-12');
  assert.equal(currentLocalMonth(new Date(2026, 10, 6)), '2026-11');
});
test('다음 같은 요일은 다음 주이며 잠금 안내는 과거에 소급 녹음을 유도하지 않는다', () => {
  const now = new Date(2026, 10, 2, 10);
  assert.equal(nextWeekdayDate(1, now).getDate(), 9);
  const key = { weekday: 1, label: '월요일', note: '도', uniqueDateCount: 1 };
  assert.match(lockedKeyMessage(key, '2026-11', '2026-11', now), /하루만 더/);
  assert.match(lockedKeyMessage({ ...key, uniqueDateCount: 0 }, '2026-11', '2026-11', now), /2일 더/);
  assert.match(lockedKeyMessage(key, '2026-10', '2026-11', now), /과거 월에는 새 달성을 추가할 수 없어요/);
});

class Param {
  value = 0;
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class Node {
  gain = new Param(); frequency = new Param(); disconnected = false;
  connect() {} disconnect() { this.disconnected = true; }
}
class FakeContext {
  state = 'running'; currentTime = 1; destination = {}; oscillators = [];
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createDynamicsCompressor() { return { ...new Node(), threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param(), connect() {}, disconnect() {} }; }
  createOscillator() { const oscillator = new Node(); oscillator.start = () => {}; oscillator.stop = () => { oscillator.stopped = true; }; this.oscillators.push(oscillator); return oscillator; }
  async close() { this.state = 'closed'; }
  async resume() { this.state = 'running'; }
}
test('오디오 초기화는 연주 시에만 발생하며 서로 다른 음을 동시에 생성한다', async () => {
  let created = 0; const context = new FakeContext();
  const piano = createPianoAudio({ createContext: () => { created++; return context; } });
  assert.equal(created, 0); piano.setVolume(.5, false); assert.equal(created, 0);
  await Promise.all([piano.play(1), piano.play(5)]);
  assert.equal(created, 1); assert.equal(context.oscillators.length, 8);
  assert.equal(context.oscillators[0].frequency.value, PIANO_TONES[0].frequency);
  assert.equal(context.oscillators[4].frequency.value, PIANO_TONES[4].frequency);
  piano.dispose(); assert.equal(context.state, 'closed'); assert(context.oscillators.every(node => node.disconnected && node.stopped));
});
test('음소거/음량 0에서는 자동 초기화나 새 소리가 없다', async () => {
  let created = 0; const piano = createPianoAudio({ createContext: () => { created++; return new FakeContext(); } });
  piano.setVolume(.5, true); assert.equal(await piano.play(1), false);
  piano.setVolume(0, false); assert.equal(await piano.play(1), false); assert.equal(created, 0); piano.dispose();
});
test('resume 대기 중 화면 이동/월 이동은 뒤늦은 소리 생성을 막는다', async () => {
  const context = new FakeContext(); context.state = 'suspended'; let resolve;
  context.resume = () => new Promise(done => { resolve = () => { context.state = 'running'; done(); }; });
  const piano = createPianoAudio({ createContext: () => context });
  const playing = piano.play(1); piano.stopAll(); resolve();
  assert.equal(await playing, false); assert.equal(context.oscillators.length, 0); piano.dispose();
});
test('오디오 생성 실패는 호출자에게 전달되고 닫힌 엔진은 새 소리를 만들지 않는다', async () => {
  const piano = createPianoAudio({ createContext: () => { throw new Error('denied'); } });
  await assert.rejects(piano.play(1), /denied/); piano.dispose(); assert.equal(await piano.play(1), false);
});
