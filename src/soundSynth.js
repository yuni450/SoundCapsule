// Web Audio API를 활용한 사운드 & 리얼 피아노 7음계 합성기
class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.activeNodes = [];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  stopAll() {
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {
        // 무시
      }
    });
    this.activeNodes = [];
  }

  // 1. 파도 소리 (Ocean Wave)
  playWave() {
    this.init();
    if (!this.ctx) return;
    this.stopAll();

    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(this.ctx.destination);

    noise.start();
    lfo.start();
    this.activeNodes.push(noise, lfo, masterGain);
  }

  // 2. 빗소리 (Rain Ambience)
  playRain() {
    this.init();
    if (!this.ctx) return;
    this.stopAll();

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = b0 + b1 + b2 + white * 0.5362;
      data[i] *= 0.11;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    this.activeNodes.push(noise, gain);
  }

  // 3. 바람 소리 (Wind Ambience)
  playWind() {
    this.init();
    if (!this.ctx) return;
    this.stopAll();

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.25, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(250, this.ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.09, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    lfo.start();
    this.activeNodes.push(noise, lfo, gain);
  }

  // 4. 차임벨 (녹음 시작/종료음)
  playChime(type = 'start') {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (type === 'start') {
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.16);
    } else {
      osc.frequency.setValueAtTime(783.99, this.ctx.currentTime);
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime + 0.1);
    }

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  // 5. 🎵 리얼 피아노 12반음계 합성음 (흰건반 7개 + 검은건반 5개)
  // 흰건반: 도(C4 261.63Hz), 레(D4 293.66Hz), 미(E4 329.63Hz), 파(F4 349.23Hz), 솔(G4 392.00Hz), 라(A4 440.00Hz), 시(B4 493.88Hz)
  // 검은건반: 도#(C#4 277.18Hz), 레#(D#4 311.13Hz), 파#(F#4 369.99Hz), 솔#(G#4 415.30Hz), 라#(A#4 466.16Hz)
  playPianoNote(keyIndex = 0, isBlack = false) {
    this.init();
    if (!this.ctx) return;

    const whiteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    const blackFreqs = [277.18, 311.13, 369.99, 415.30, 466.16];

    const freq = isBlack
      ? (blackFreqs[keyIndex] || 277.18)
      : (whiteFreqs[keyIndex] || 261.63);

    const now = this.ctx.currentTime;

    // 기음 (Fundamental - Sine)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // 2차 배음 (Harmonic Overtones for rich acoustic piano resonance)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    const masterGain = this.ctx.createGain();

    // 피아노 어택 & 감쇄 엔벨로프
    gain1.gain.setValueAtTime(isBlack ? 0.22 : 0.26, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    masterGain.gain.setValueAtTime(0.75, now);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(masterGain);
    gain2.connect(masterGain);
    masterGain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
  }
}

export const soundSynth = new SoundSynthesizer();
