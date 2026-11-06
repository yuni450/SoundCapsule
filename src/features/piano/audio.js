import { PIANO_TONES } from './presentation.js';

export function createPianoAudio({ createContext = () => {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) throw new Error('Web Audio를 지원하지 않는 브라우저입니다.');
  return new Context();
} } = {}) {
  let context, master, compressor;
  let volume = 0.55, muted = false, disposed = false, generation = 0;
  const voices = new Set();
  const stopAll = () => {
    generation++;
    for (const voice of [...voices]) voice.dispose();
  };
  const setVolume = (next, nextMuted) => {
    volume = Math.max(0, Math.min(1, Number(next) || 0)); muted = Boolean(nextMuted);
    if (muted || volume === 0) stopAll();
    if (master && context?.state !== 'closed') master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.015);
  };
  const play = async (weekday) => {
    const tone = PIANO_TONES[weekday - 1];
    if (!tone || disposed || muted || volume === 0) return false;
    const current = generation;
    if (!context) {
      context = createContext();
      try {
        master = context.createGain(); master.gain.value = muted ? 0 : volume;
        compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -12; compressor.knee.value = 18; compressor.ratio.value = 6;
        compressor.attack.value = 0.004; compressor.release.value = 0.18;
        master.connect(compressor); compressor.connect(context.destination);
      } catch (error) { void context.close().catch(() => {}); context = null; throw error; }
    }
    // 사용자 조작의 같은 호출 안에서 resume을 시작합니다.
    if (context.state !== 'running') await context.resume();
    if (disposed || current !== generation || muted || volume === 0) return false;
    if (context.state !== 'running') throw new Error('브라우저에서 오디오 재개를 허용하지 않았습니다.');
    while (voices.size >= 24) voices.values().next().value.dispose();
    const nodes = [], oscillators = [];
    const voice = { dispose() {
      if (!voices.delete(voice)) return;
      for (const oscillator of oscillators) { oscillator.onended = null; try { oscillator.stop(); } catch { /* 이미 종료됨 */ } }
      for (const node of nodes) node.disconnect();
    } };
    voices.add(voice);
    try {
      const now = context.currentTime;
      const envelope = context.createGain(); nodes.push(envelope);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.30, now + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.10, now + 0.22);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
      const filter = context.createBiquadFilter(); nodes.push(filter);
      filter.type = 'lowpass'; filter.frequency.value = 4200;
      envelope.connect(filter); filter.connect(master);
      [[1, .65], [2.001, .23], [3.005, .08], [4.012, .04]].forEach(([ratio, amplitude]) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillators.push(oscillator); nodes.push(oscillator, gain);
        oscillator.type = 'sine'; oscillator.frequency.value = tone.frequency * ratio;
        gain.gain.value = amplitude; oscillator.connect(gain); gain.connect(envelope);
        oscillator.start(now); oscillator.stop(now + 1.7);
      });
      oscillators[0].onended = () => voice.dispose();
      return true;
    } catch (error) { voice.dispose(); throw error; }
  };
  const dispose = () => {
    disposed = true; stopAll(); master?.disconnect(); compressor?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
  return { play, setVolume, stopAll, dispose };
}
