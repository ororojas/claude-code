// All sounds are synthesized, so there are no audio files to load.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastClick = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ctx.destination);

    const roll = ctx.createBufferSource();
    roll.buffer = buf;
    roll.loop = true;
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'bandpass';
    this.rollFilter.frequency.value = 700;
    this.rollFilter.Q.value = 0.8;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    roll.connect(this.rollFilter).connect(this.rollGain).connect(this.master);
    roll.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  roll(speed, onRotor) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const level = Math.min(1, speed / 12);
    this.rollGain.gain.setTargetAtTime(level * (onRotor ? 0.05 : 0.11), t, 0.08);
    this.rollFilter.frequency.setTargetAtTime(250 + speed * 110, t, 0.1);
  }

  click(strength, kind) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    if (t - this.lastClick < 0.02) return;
    this.lastClick = t;
    const v = Math.min(1, strength / 2.5);
    if (v < 0.03) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = kind === 'deflector' ? 1800 : 3200 + Math.random() * 1800;
    f.Q.value = 5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.8, 0.08);
  }

  chip() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (const [dt, freq] of [[0, 2600], [0.045, 2100]]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = 3;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.05);
      src.connect(f).connect(g).connect(this.master);
      src.start(t + dt, Math.random() * 0.8, 0.06);
    }
  }

  win() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      const s = t + i * 0.11;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.55);
    });
  }
}
