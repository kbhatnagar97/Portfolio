import type { TFlowKind } from '../data';
import { reducedMotion } from '../smooth';
import { audio } from './engine';
import { coarse, db, debugEvent, guarded, heardAt, later, loops, reap, seeded, voices, type IBus, type IVoice } from './core';
import { music } from './music';
import { anchor, degree, hop, hz, inChord, modeUp, nearest, rung, step as chordStep, toneIn } from './themes';

export type TNodeKind = TFlowKind;
export type TTone = 'go' | 'alt' | 'drop' | 'ok' | 'sys';
export type TSfxId =
  | 'click'
  | 'hover'
  | 'toggleOn'
  | 'toggleOff'
  | 'navigate'
  | 'pickup'
  | 'dropThud'
  | 'zoomIn'
  | 'zoomOut'
  | 'detent'
  | 'bonk'
  | 'nudge'
  | 'nudgeHeavy'
  | 'focusTick'
  | 'turn'
  | 'stamp'
  | 'fit'
  | 'irisOpen'
  | 'irisClose'
  | 'puff'
  | 'whoosh'
  | 'teletype'
  | 'confirm'
  | 'powerUp'
  | 'powerDown'
  | 'nodePop'
  | 'shimmer'
  | 'latch'
  | 'runStart'
  | 'arrive'
  | 'typeTick'
  | 'alert'
  | 'reroute'
  | 'crash'
  | 'clank'
  | 'reboot'
  | 'snap'
  | 'visor'
  | 'coin'
  | 'ratchet'
  | 'reset';
export type TStinger = 'yes' | 'no' | 'mission' | 'missionBig' | 'complete' | 'chaosComplete' | 'rankUp' | 'clearance';
export type TLoopId = 'scrub' | 'dragServo' | 'wheels';

export interface IPlayOpts {
  pan?: number;
  intensity?: number;
  at?: number;
  kind?: TNodeKind;
  tone?: TTone | string;
  step?: number;
  quiet?: number;
  // recipe extras: shimmer and powerUp length, clank part, ladder rung, whoosh end pan
  dur?: number;
  part?: string;
  k?: number;
  p1?: number;
  beat?: number;
}

// the harmony a recipe reads at its onset
export interface IHarmony {
  chord: readonly number[];
  r: number;
  root: number;
  scale: readonly number[];
}

export interface IHandle {
  stop(): void;
  cancel(): void;
}
const NOOP: IHandle = { stop: () => undefined, cancel: () => undefined };

// #region Levels
// dB trims that put each recipe on its LK target; tuned with the offline render check
export const LV: Record<TSfxId, number> = {
  click: -20.2,
  hover: -13.7,
  toggleOn: -24.6,
  toggleOff: -24.6,
  navigate: -22.7,
  pickup: -19.4,
  dropThud: -23.7,
  zoomIn: -23.5,
  zoomOut: -23.2,
  detent: -26.4,
  bonk: -21.1,
  nudge: -21.9,
  nudgeHeavy: -22.1,
  focusTick: -14.4,
  turn: -33.5,
  stamp: -23.8,
  fit: -24.2,
  irisOpen: -16.3,
  irisClose: -19.5,
  puff: -24.3,
  whoosh: -25.8,
  teletype: -22.5,
  confirm: -26.8,
  powerUp: -34.8,
  powerDown: -26.8,
  nodePop: -27.6,
  shimmer: -32,
  latch: -26.4,
  runStart: -21.1,
  arrive: -29.4,
  typeTick: -39.4,
  alert: -27.4,
  reroute: -25.8,
  crash: -20.2,
  clank: -23.2,
  reboot: -31.9,
  snap: -24.5,
  visor: -22.1,
  coin: -30.4,
  ratchet: -30.9,
  reset: -34.4,
};
export const LV_STING: Record<string, number> = {
  yes: -26,
  no: -24.8,
  mission: -24.6,
  missionBig: -22.4,
  complete: -22.3,
  completeShort: -26.7,
  chaosComplete: -23,
  rankUp: -27.8,
  clearance: -19.7,
};
// #endregion

// #region Voice builder
const rel = (v: number) => db(v);
// round robin: noise centre, partial balance and decay, never pitch
const RR = [
  { nk: 1, bal: 0, dk: 1 },
  { nk: 1.2, bal: 2, dk: 1.15 },
  { nk: 0.8, bal: -2, dk: 0.85 },
];

export class VB {
  c: BaseAudioContext;
  bus: IBus;
  t: number;
  out: GainNode;
  kill: GainNode;
  nodes: AudioNode[] = [];
  srcs: AudioScheduledSourceNode[] = [];
  end: number;
  notes: number[] = [];
  rnd: () => number;
  nk: number;
  bal: number;
  dk: number;
  min: number;
  // effects decay over twice their nominal length, so they are heard for it: 40 dB below their peak lands on the spec duration
  stretch = 1;

  constructor(c: BaseAudioContext, bus: IBus, t: number, o: { level: number; pan?: number; send?: number; rr?: number; rnd: () => number; dest?: AudioNode }) {
    this.c = c;
    this.bus = bus;
    this.t = t;
    this.end = t;
    this.rnd = o.rnd;
    const v = RR[(o.rr ?? 0) % 3];
    this.nk = v.nk;
    this.bal = v.bal;
    this.dk = v.dk;
    // a trimmed start may sit in the past; sources never start before now
    this.min = c.currentTime;
    this.out = c.createGain();
    this.out.gain.value = Number.isFinite(o.level) ? o.level : 0;
    this.kill = c.createGain();
    this.out.connect(this.kill);
    this.nodes.push(this.out);
    let tail: AudioNode = this.kill;
    const pan = o.pan ?? 0;
    if (pan && Number.isFinite(pan)) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      this.kill.connect(p);
      this.nodes.push(p);
      tail = p;
    }
    tail.connect(o.dest ?? bus.sfxIn);
    if (o.send) tail.connect(this.g(o.send, bus.sendIn));
  }

  g(v = 1, to: AudioNode | AudioParam = this.out) {
    const g = this.c.createGain();
    g.gain.value = v;
    if (to instanceof AudioParam) g.connect(to);
    else g.connect(to);
    this.nodes.push(g);
    return g;
  }

  f(type: BiquadFilterType, freq: number, q = 0.7, to: AudioNode = this.out) {
    const b = this.c.createBiquadFilter();
    b.type = type;
    b.frequency.value = freq;
    b.Q.value = q;
    b.connect(to);
    this.nodes.push(b);
    return b;
  }

  pan(p: number, to: AudioNode = this.out) {
    const n = this.c.createStereoPanner();
    n.pan.value = p;
    n.connect(to);
    this.nodes.push(n);
    return n;
  }

  private run(s: AudioScheduledSourceNode, t0: number, t1: number, offset?: number) {
    const start = Math.max(t0, this.min);
    if (s instanceof AudioBufferSourceNode) s.start(start, offset ?? 0);
    else s.start(start);
    s.stop(Math.max(t1, start + 0.01));
    this.srcs.push(s);
    this.nodes.push(s);
    this.end = Math.max(this.end, t1);
  }

  osc(type: OscillatorType, f: number, to: AudioNode, t0: number, t1: number) {
    const o = this.c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    o.connect(to);
    this.run(o, t0, t1);
    return o;
  }

  nz(to: AudioNode, t0: number, t1: number) {
    const s = this.c.createBufferSource();
    s.buffer = this.bus.noise;
    s.loop = true;
    s.connect(to);
    this.run(s, t0, t1, this.rnd() * 1.9);
    return s;
  }

  // exponential attack and decay; the source stops 20 ms after the floor
  env(p: AudioParam, t0: number, peak: number, a: number, d: number) {
    const pk = Math.max(peak, 0.0001);
    p.setValueAtTime(0.0001, t0);
    p.exponentialRampToValueAtTime(pk, t0 + Math.max(a, 0.001));
    p.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a, 0.001) + d);
    return t0 + Math.max(a, 0.001) + d + 0.02;
  }

  // one oscillator through its own envelope
  tone(o: { type?: OscillatorType; f: number; f1?: number; glide?: number; peak?: number; a: number; d: number; t0?: number; to?: AudioNode; note?: number }) {
    const t0 = o.t0 ?? this.t;
    const g = this.g(0, o.to ?? this.out);
    const d = o.d * this.dk * this.stretch;
    const end = this.env(g.gain, t0, o.peak ?? 1, o.a, d);
    const s = this.osc(o.type ?? 'sine', o.f, g, t0, end);
    if (o.f1 !== undefined) s.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t0 + (o.glide ?? o.a + d));
    if (o.note !== undefined) this.notes.push(o.note);
    return s;
  }

  noise(o: { type: BiquadFilterType; f0: number; f1?: number; q?: number; peak?: number; a: number; d: number; t0?: number; to?: AudioNode }) {
    const t0 = o.t0 ?? this.t;
    const g = this.g(0, o.to ?? this.out);
    const bq = this.f(o.type, o.f0 * this.nk, o.q ?? 0.7, g);
    const d = o.d * this.dk * this.stretch;
    const end = this.env(g.gain, t0, o.peak ?? 1, o.a, d);
    bq.frequency.setValueAtTime(o.f0 * this.nk, t0);
    if (o.f1 !== undefined) bq.frequency.exponentialRampToValueAtTime(o.f1 * this.nk, t0 + o.a + d);
    this.nz(bq, t0, end);
    return bq;
  }

  // FM: carrier f, modulator f times ratio, index decaying to 0.05 over 60% of dur
  fm(o: { f: number; ratio: number; i0: number; dur: number; peak?: number; a?: number; d?: number; t0?: number; to?: AudioNode; note?: number }) {
    const t0 = o.t0 ?? this.t;
    const g = this.g(0, o.to ?? this.out);
    const d = (o.d ?? o.dur) * this.dk * this.stretch;
    const end = this.env(g.gain, t0, o.peak ?? 1, o.a ?? 0.002, d);
    const car = this.osc('sine', o.f, g, t0, end);
    const mg = this.g(0, car.frequency);
    mg.gain.setValueAtTime(o.f * o.i0, t0);
    mg.gain.exponentialRampToValueAtTime(Math.max(o.f * 0.05, 0.001), t0 + o.dur * 0.6);
    this.osc('sine', o.f * o.ratio, mg, t0, end);
    if (o.note !== undefined) this.notes.push(o.note);
    return car;
  }
}
// #endregion

// #region Recipes
interface IP extends IHarmony {
  A: number;
  step: number;
  k: number;
  dur: number;
  kind: TNodeKind;
  tone: TTone;
  pan: number;
  p1: number;
  intensity: number;
  part: string;
  beat?: number;
}

type TRecipe = (b: VB, p: IP) => void;

const ARRIVE_TRIM: Record<TNodeKind, number> = { trigger: 4.3, source: 3.8, rule: 6.2, ai: -0.6, human: -1.7, output: 1.5, drop: 3 };

const clickBody = (b: VB, n: number, t0: number, d = 0.06, peak = 1) => {
  const f = hz(n);
  b.tone({ f, f1: f * 0.94, glide: 0.04, a: 0.002, d, t0, peak, note: n });
  b.tone({ f: f * 2.76, a: 0.002, d: d / 2, t0, peak: peak * rel(-12 + b.bal) });
};
const snap = (b: VB, t0: number, peak = rel(-6)) => b.noise({ type: 'bandpass', f0: 5500, q: 3, a: 0.001, d: 0.005, t0, peak: peak * rel(b.bal) });
const click = (b: VB, n: number, t0 = b.t, d = 0.06) => {
  clickBody(b, n, t0, d);
  snap(b, t0);
};
const fmRing = (b: VB, f: number, i0: number, dur: number, peak: number, t0 = b.t, to?: AudioNode) => b.fm({ f, ratio: 1.41, i0, dur, peak, t0, to });

const shimmer = (b: VB, p: IP, dur: number, peak = 1, t0 = b.t) => {
  const hp = b.f('highpass', 2000, 0.7, b.out);
  const env = b.g(0, hp);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.5);
  // the tail runs past dur so the shimmer is still heard at dur, 40 dB below its peak
  const end = t0 + dur * 1.25;
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  const trem = b.g(0.5, env);
  b.osc('sine', 8, b.g(0.5, trem.gain), t0, end + 0.02);
  const top: number[] = [];
  for (let m = p.r + 67; m >= p.r + 48 && top.length < 4; m--) if (inChord(p.chord, m)) top.push(m);
  top.forEach((m) => {
    b.osc('sine', hz(m), b.g(0.25, trem), t0, end + 0.02);
    b.notes.push(m);
  });
};

type TShape = 'inOut' | 'out' | 'in';
const whoosh = (b: VB, o: { dur: number; shape: TShape; p0: number; p1: number; lo: number; hi: number; q?: number; fEnd?: number; peak?: number; t0?: number }) => {
  const t0 = o.t0 ?? b.t;
  const tp = Math.max(0.04, o.shape === 'inOut' ? o.dur * 0.5 : o.shape === 'out' ? Math.max(0.06, o.dur * 0.15) : o.dur - 0.01);
  const end = o.dur + (o.shape === 'out' ? 0.15 : 0.04);
  const pn = b.pan(o.p0);
  pn.pan.setValueAtTime(o.p0, t0);
  pn.pan.linearRampToValueAtTime(o.p1, t0 + o.dur);
  const g = b.g(0, pn);
  g.gain.setValueAtTime(0.0001, t0);
  if (o.shape === 'in') g.gain.exponentialRampToValueAtTime(o.peak ?? 1, t0 + tp);
  else g.gain.linearRampToValueAtTime(o.peak ?? 1, t0 + tp);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);
  const bp = b.f('bandpass', o.lo, o.q ?? 1.6, g);
  bp.frequency.setValueAtTime(o.lo, t0);
  bp.frequency.exponentialRampToValueAtTime(o.hi, t0 + tp);
  bp.frequency.exponentialRampToValueAtTime(o.fEnd ?? o.lo, t0 + end);
  b.nz(bp, t0, t0 + end + 0.02);
  if (!coarse) {
    const air = b.f('highpass', 6000, 0.7, b.g(rel(-12), g));
    b.nz(air, t0, t0 + end + 0.02);
  }
};

const powerDown = (b: VB, t0: number, peak = 1) => {
  const lp = b.f('lowpass', 3000, 0.7, b.out);
  lp.frequency.setValueAtTime(3000, t0);
  lp.frequency.exponentialRampToValueAtTime(300, t0 + 0.3);
  b.tone({ f: 600, f1: 80, glide: 0.3, a: 0.005, d: 0.3, t0, to: lp, peak });
  b.tone({ f: 1200, f1: 160, glide: 0.3, a: 0.005, d: 0.3, t0, to: lp, peak: peak * rel(-8) });
  for (let i = 0; i < 3; i++) b.noise({ type: 'highpass', f0: 4000, a: 0.001, d: 0.004, t0: t0 + b.rnd() * 0.2, peak: peak * rel(-18) });
};

const confirm = (b: VB, p: IP, n: number, t0 = b.t) => {
  const n2 = nearest(p.chord, n + 7);
  [
    [n, t0],
    [n2, t0 + 0.055],
  ].forEach(([m, t]) => {
    b.tone({ type: 'triangle', f: hz(m), a: 0.004, d: 0.12, t0: t, note: m });
    b.tone({ f: hz(m) * 2.76, a: 0.004, d: 0.06, t0: t, peak: rel(-18 + b.bal) });
  });
};

const bell = (b: VB, n: number, i0: number, dur: number, t0 = b.t, peak = 1) => b.fm({ f: hz(n), ratio: 3.5, i0, dur, t0, peak, note: n });

const R: Record<TSfxId, TRecipe> = {
  click: (b, p) => click(b, chordStep(p.chord, p.A, p.step)),
  hover: (b) => b.noise({ type: 'bandpass', f0: 5000, q: 8, a: 0.002, d: 0.016 }),
  toggleOn: (b, p) => {
    click(b, p.A);
    clickBody(b, chordStep(p.chord, p.A, 2), b.t + 0.06);
  },
  toggleOff: (b, p) => {
    click(b, chordStep(p.chord, p.A, 2));
    clickBody(b, p.A, b.t + 0.06);
  },
  navigate: (b, p) => click(b, chordStep(p.chord, p.A, 1)),
  pickup: (b, p) => {
    const n = p.A - 12;
    b.tone({ type: 'triangle', f: hz(n), f1: hz(chordStep(p.chord, n, 2)), glide: 0.06, a: 0.003, d: 0.08, note: n });
    snap(b, b.t);
  },
  dropThud: (b) => {
    b.noise({ type: 'highpass', f0: 2000, a: 0.001, d: 0.004, peak: rel(-20) });
    b.tone({ f: 360, f1: 180, glide: 0.06, a: 0.002, d: 0.2 });
    b.tone({ f: 720, f1: 360, glide: 0.06, a: 0.002, d: 0.2, peak: rel(-6) });
    fmRing(b, 1200, 3, 0.25, rel(-16 + b.bal));
  },
  zoomIn: (b, p) => {
    const n = chordStep(p.chord, p.A, p.step);
    const f = hz(n);
    b.tone({ f, f1: hz(chordStep(p.chord, n, 1)), glide: 0.08, a: 0.004, d: 0.08, note: n });
    b.tone({ f: f * 2.76, a: 0.004, d: 0.05, peak: rel(-18 + b.bal) });
  },
  zoomOut: (b, p) => {
    const n = chordStep(p.chord, p.A, -p.step);
    const f = hz(n);
    b.tone({ f, f1: hz(chordStep(p.chord, n, -1)), glide: 0.08, a: 0.004, d: 0.08, note: n });
    b.tone({ f: f * 2.76, a: 0.004, d: 0.05, peak: rel(-18 + b.bal) });
  },
  detent: (b, p) => clickBody(b, rung(p.chord, p.r, p.k), b.t, 0.02),
  bonk: (b, p) => {
    let n = p.r + 12;
    while ((((n - p.root) % 12) + 12) % 12 !== 0) n++;
    const lp = b.f('lowpass', 1200, 1, b.out);
    b.tone({ type: 'triangle', f: hz(n), a: 0.003, d: 0.09, to: lp, note: n });
    b.tone({ f: hz(n) * 2, a: 0.003, d: 0.09, to: lp, peak: rel(-3) });
    b.tone({ f: hz(n) * 3, a: 0.003, d: 0.07, to: lp, peak: rel(-10 + b.bal) });
  },
  nudge: (b, p) => clickBody(b, p.A, b.t, 0.035),
  nudgeHeavy: (b, p) => {
    clickBody(b, chordStep(p.chord, p.A, -1), b.t, 0.05);
    fmRing(b, 1200, 2, 0.1, rel(-6 + b.bal));
  },
  focusTick: (b) => b.noise({ type: 'bandpass', f0: 4000, q: 6, a: 0.001, d: 0.011 }),
  turn: (b, p) => clickBody(b, nearest(p.chord, p.A + 7), b.t, 0.025),
  stamp: (b, p) => {
    click(b, p.A - 12);
    b.fm({ f: hz(p.A - 12), ratio: 1.41, i0: 2, dur: 0.08, peak: rel(-8 + b.bal) });
  },
  fit: (b, p) => {
    click(b, p.A);
    shimmer(b, p, 0.3, rel(-8));
  },
  irisOpen: (b, p) => {
    whoosh(b, { dur: 1.0, shape: 'inOut', p0: p.pan, p1: 0, lo: 250, hi: 4000, q: 1.2 });
    const t0 = b.t + 0.2;
    const g = b.g(0, b.out);
    b.env(g.gain, t0, rel(-4), 0.08, 0.6);
    const bp = b.f('bandpass', 300, 8, g);
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(4000, t0 + 0.6);
    const s = b.osc('sawtooth', 300, bp, t0, t0 + 0.72);
    s.frequency.exponentialRampToValueAtTime(4000, t0 + 0.6);
  },
  irisClose: (b, p) => {
    whoosh(b, { dur: 0.6, shape: 'in', p0: 0, p1: p.pan, lo: 3000, hi: 600, q: 1.2 });
    b.tone({ f: 440, f1: 110, glide: 0.6, a: 0.4, d: 0.2, peak: rel(-3) });
    b.tone({ f: 880, f1: 220, glide: 0.6, a: 0.4, d: 0.2, peak: rel(-9) });
    const t = b.t + 0.6;
    const k = rel(-4);
    b.noise({ type: 'highpass', f0: 2000, a: 0.001, d: 0.004, t0: t, peak: k * rel(-20) });
    b.tone({ f: 360, f1: 180, glide: 0.06, a: 0.002, d: 0.12, t0: t, peak: k });
    b.tone({ f: 720, f1: 360, glide: 0.06, a: 0.002, d: 0.12, t0: t, peak: k * rel(-6) });
    fmRing(b, 1200, 3, 0.25, k * rel(-16), t);
  },
  puff: (b) => b.noise({ type: 'bandpass', f0: 1800, f1: 3200, q: 1.2, a: 0.04, d: 0.11 }),
  whoosh: (b, p) => {
    const drop = p.tone === 'drop';
    whoosh(b, { dur: p.dur, shape: 'inOut', p0: p.pan, p1: p.p1, lo: 500, hi: drop ? 2000 : 2350, fEnd: drop ? 300 : 500 });
  },
  teletype: (b, p) => {
    const n = chordStep(p.chord, p.A, p.step);
    b.tone({ type: 'triangle', f: hz(n), a: 0.002, d: 0.02, to: b.f('lowpass', 3000), note: n });
  },
  confirm: (b, p) => confirm(b, p, p.A),
  powerUp: (b, p) => {
    const t = b.t;
    const dur = p.dur;
    const lp = b.f('lowpass', 300, 2, b.out);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.setTargetAtTime(4000, t, 0.12);
    const g = b.g(0, lp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.005);
    g.gain.setTargetAtTime(0.0001, t + 0.3, dur / 8);
    const stop = t + 0.3 + (7 * dur) / 8;
    const saw = b.osc('sawtooth', 110, g, t, stop);
    saw.frequency.setTargetAtTime(440, t, 0.1);
    const sine = b.osc('sine', 110, b.g(rel(-6), g), t, stop);
    sine.frequency.setTargetAtTime(440, t, 0.1);
    b.tone({ f: 80, f1: 50, glide: 0.25, a: 0.003, d: 0.25, peak: rel(-6) });
    b.tone({ f: 160, f1: 100, glide: 0.25, a: 0.003, d: 0.25, peak: rel(-12) });
    const n = toneIn(p.chord, p.r + 24, p.r + 35);
    b.fm({ f: hz(n), ratio: 2, i0: 3, dur: Math.min(1.6, dur + 0.2), peak: rel(-12 + b.bal), note: n });
  },
  powerDown: (b) => powerDown(b, b.t),
  nodePop: (b, p) => {
    const n = rung(p.chord, p.r, p.k) - 12;
    b.tone({ f: hz(n), a: 0.003, d: 0.06, note: n });
    b.tone({ f: hz(n) * 2.76, a: 0.003, d: 0.04, peak: rel(-16 + b.bal) });
  },
  shimmer: (b, p) => shimmer(b, p, p.dur),
  latch: (b) => {
    fmRing(b, 1800, 2, 0.12, 1);
    b.noise({ type: 'highpass', f0: 3000, a: 0.001, d: 0.004, peak: rel(-12) });
    b.tone({ type: 'sawtooth', f: 660, f1: 440, glide: 0.25, a: 0.005, d: 0.25, to: b.f('lowpass', 1200, 6), peak: rel(-10 + b.bal) });
  },
  runStart: (b, p) => {
    click(b, p.A);
    const lp = b.f('lowpass', 800, 0.7, b.out);
    lp.frequency.setValueAtTime(800, b.t);
    lp.frequency.exponentialRampToValueAtTime(3000, b.t + 0.35);
    const s = b.tone({ type: 'sawtooth', f: 220, a: 0.005, d: 0.35, to: lp, peak: rel(-10) });
    s.frequency.setTargetAtTime(660, b.t, 0.08);
    const beat = p.beat;
    if (beat === undefined || beat - b.t <= 0.2) return;
    // the swell hard stops on the beat through its own kill gain
    const kill = b.g(1, b.out);
    kill.gain.setValueAtTime(1, beat);
    kill.gain.setTargetAtTime(0, beat + 0.002, 0.002);
    const g = b.g(0, kill);
    g.gain.setValueAtTime(0.0001, b.t);
    g.gain.linearRampToValueAtTime(rel(-8), beat);
    const bp = b.f('bandpass', 400, 3, g);
    bp.frequency.setValueAtTime(400, b.t);
    bp.frequency.exponentialRampToValueAtTime(4000, beat);
    b.nz(bp, b.t, beat + 0.03);
  },
  arrive: (b, p) => {
    const n = rung(p.chord, p.r, p.k);
    const alt = p.tone === 'alt';
    // each timbre carries a different crest, so every kind lands on the same loudness
    b.out.gain.value *= db(p.tone === 'drop' || p.kind === 'drop' ? 3 : ARRIVE_TRIM[p.kind]);
    if (p.tone === 'drop' || p.kind === 'drop') {
      const lo = n - 12;
      const lp = b.f('lowpass', 1200, 0.7, b.out);
      b.tone({ type: 'triangle', f: hz(lo), f1: hz(chordStep(p.chord, lo, -1)), glide: 0.185, a: 0.005, d: 0.18, to: lp, note: lo });
      b.tone({ f: hz(lo) * 2, f1: hz(chordStep(p.chord, lo, -1)) * 2, glide: 0.185, a: 0.005, d: 0.18, to: lp, peak: rel(-6) });
    } else if (p.kind === 'trigger') clickBody(b, n, b.t, 0.09);
    else if (p.kind === 'source') b.tone({ type: 'triangle', f: hz(n), a: 0.003, d: 0.14, to: b.f('lowpass', 5000), note: n });
    else if (p.kind === 'rule') b.tone({ f: hz(n), a: 0.002, d: 0.06, note: n });
    else if (p.kind === 'ai') bell(b, n, alt ? 3 : 1.5, 0.3);
    else if (p.kind === 'human') {
      const lp = b.f('lowpass', 2500, 0.7, b.out);
      [n, chordStep(p.chord, n, 1), chordStep(p.chord, n, 2)].forEach((m) => b.tone({ type: 'triangle', f: hz(m), a: 0.01, d: 0.35, to: lp, peak: 0.6, note: m }));
    } else confirm(b, p, n);
    if (p.tone === 'ok') b.tone({ f: hz(n + 12), a: 0.003, d: 0.12, peak: rel(-10 + b.bal), note: n + 12 });
    // the deliberate rub; exempt from the chord check
    if (alt) b.tone({ type: 'triangle', f: hz(modeUp(p.scale, p.r, n)), a: 0.003, d: 0.1, peak: rel(-8) });
    b.noise({ type: 'highpass', f0: 6000, a: 0.001, d: 0.02, peak: rel(-12) });
  },
  typeTick: (b, p) => {
    b.noise({ type: 'bandpass', f0: 3000, q: 3, a: 0.001, d: 0.008, peak: rel(-6) });
    bell(b, p.A + 12, 1, 0.4, b.t + 0.35);
  },
  alert: (b, p) => {
    bell(b, nearest(p.chord, p.A + 7), 1.5, 0.35);
    bell(b, p.A, 1.5, 0.35, b.t + 0.15);
  },
  reroute: (b, p) => {
    const lp = b.f('lowpass', 2500, 0.7, b.out);
    const up = modeUp(p.scale, p.r, p.A);
    [p.A, up, p.A, up].forEach((m, i) => b.fm({ f: hz(m), ratio: 1.41, i0: 2, dur: 0.07, a: 0.003, d: 0.07, t0: b.t + i * 0.09, to: lp }));
  },
  crash: (b) => {
    const t = b.t;
    [0, 0.03, 0.07, 0.12].forEach((o, i) => b.noise({ type: 'highpass', f0: 4000, a: 0.001, d: 0.02, t0: t + o, to: b.pan(i % 2 ? 0.2 : -0.2), peak: rel(-16) }));
    b.tone({ f: 180, f1: 60, glide: 0.2, a: 0.002, d: 0.6 });
    b.tone({ f: 360, f1: 120, glide: 0.2, a: 0.002, d: 0.6, peak: rel(-6) });
    const lp = b.f('lowpass', 900, 4, b.out);
    b.tone({ type: 'sawtooth', f: 150, a: 0.005, d: 0.35, to: lp, peak: rel(-10) });
    b.tone({ type: 'sawtooth', f: 155, a: 0.005, d: 0.35, to: lp, peak: rel(-10) });
    for (let i = 0, n = coarse ? 6 : 10; i < n; i++) {
      const at = t + 0.3 * b.rnd() ** 2;
      b.tone({ type: b.rnd() < 0.5 ? 'sine' : 'triangle', f: 2200 + b.rnd() * 4300, a: 0.001, d: 0.04 + b.rnd() * 0.1, t0: at, to: b.pan((b.rnd() - 0.5) * 0.8), peak: rel(-24) });
    }
    powerDown(b, t + 0.1, rel(-6));
  },
  clank: (b, p) => {
    const base = { chassis: 500, head: 900, arm: 1600, antenna: 2200 }[p.part] ?? 1200;
    const k = Math.max(0, Math.min(1, p.intensity));
    const f = base * 2 ** ((2 * k) / 12);
    const lv = rel(-16 + 16 * k);
    fmRing(b, f, 3 * Math.max(k, 0.2), 0.15, lv);
    b.tone({ f: f / 2, a: 0.002, d: 0.08, peak: lv * rel(-6) });
    b.noise({ type: 'highpass', f0: 2000, a: 0.001, d: 0.002, peak: lv * rel(-12) });
  },
  reboot: (b, p) => {
    b.tone({ type: 'triangle', f: hz(p.A - 24), f1: hz(p.A - 12), glide: 0.35, a: 0.02, d: 0.35, note: p.A - 24 });
    b.tone({ f: hz(p.A - 24) * 2, f1: hz(p.A - 12) * 2, glide: 0.35, a: 0.02, d: 0.35, peak: rel(-8) });
  },
  snap: (b, p) => click(b, p.A, b.t, 0.04),
  visor: (b, p) => {
    const n = nearest(p.chord, p.A + (p.step > 0 ? 12 : 7));
    b.tone({ type: 'triangle', f: hz(n), a: 0.002, d: 0.02, to: b.f('lowpass', 3000), note: n });
  },
  coin: (b, p) => {
    bell(b, nearest(p.chord, p.A + 7), 1, 0.08);
    bell(b, p.A + 12, 1, 0.3, b.t + 0.08);
  },
  ratchet: (b, p) => {
    for (let j = 0; j < 8; j++) clickBody(b, rung(p.chord, p.r, j), b.t + j * 0.1, 0.03);
  },
  reset: (b, p) => {
    const bp = b.f('bandpass', 3000, 8, b.out);
    bp.frequency.setValueAtTime(3000, b.t);
    bp.frequency.exponentialRampToValueAtTime(300, b.t + 0.5);
    b.tone({ type: 'sawtooth', f: 3000, f1: 300, glide: 0.5, a: 0.01, d: 0.48, to: bp, peak: 2 });
    shimmer(b, p, 0.5, rel(-8));
  },
};
// #endregion

// #region Play
// ticks yield to everything, so a full pool steals them first
const PRI: Partial<Record<TSfxId, number>> = { hover: 0, focusTick: 0, typeTick: 0, turn: 0, irisOpen: 2, irisClose: 2, crash: 2, alert: 2 };
const INPUT = new Set<TSfxId>(['click', 'hover', 'toggleOn', 'toggleOff', 'navigate', 'pickup', 'dropThud', 'zoomIn', 'zoomOut', 'detent', 'bonk', 'nudge', 'nudgeHeavy', 'focusTick', 'stamp', 'fit', 'runStart']);
const priOf = (id: TSfxId) => PRI[id] ?? (INPUT.has(id) ? 3 : 1);
// cooldown in seconds; effect driven ids keep 300 ms so a StrictMode double effect stays single
const COOL: Partial<Record<TSfxId, number>> = {
  hover: 0.12,
  focusTick: 0.06,
  turn: 0.1,
  toggleOn: 0.1,
  toggleOff: 0.1,
  navigate: 0.06,
  zoomIn: 0.06,
  zoomOut: 0.06,
  fit: 0.25,
  reset: 0.3,
  powerDown: 0.3,
  powerUp: 0.3,
  crash: 0.3,
  clank: 0.06,
  detent: 0.03,
  nudge: 0.07,
  nudgeHeavy: 0.07,
  nodePop: 0.04,
  reboot: 0.3,
  coin: 0.3,
  ratchet: 0.3,
  stamp: 0.3,
  alert: 0.3,
  reroute: 0.3,
  irisOpen: 0.5,
  irisClose: 0.5,
  latch: 0.5,
};
const POOL = coarse ? 10 : 16;
const PER_ID = 3;
const last = new Map<string, number>();
let gov: { t: number; pri: number; v: IVoice }[] = [];
const rr = new Map<TSfxId, number>();

export { seeded };

const levelOf = (id: TSfxId, o: IPlayOpts) => {
  const i = o.intensity === undefined ? 1 : Math.max(0, Math.min(1, o.intensity));
  const dI = id === 'clank' ? 0 : id === 'dropThud' ? -4 * (1 - i) : -12 * (1 - i);
  return db(LV[id] + dI + (o.quiet ?? 0));
};

export const harmonyAt = (t: number): IHarmony => music.harmonyAt(t);

// renders one recipe into any context; the offline check calls this with a fixed seed
export function render(c: BaseAudioContext, bus: IBus, id: TSfxId, t: number, o: IPlayOpts, h: IHarmony, rnd: () => number, round = 0) {
  const b = new VB(c, bus, t, { level: levelOf(id, o), pan: id === 'whoosh' || id === 'irisOpen' || id === 'irisClose' ? 0 : o.pan, send: id === 'alert' ? rel(-4) : 0, rr: round, rnd });
  const p: IP = {
    ...h,
    A: anchor(h.chord, h.r),
    step: o.step ?? 0,
    k: o.k ?? 0,
    dur: o.dur ?? (id === 'powerUp' ? 1.4 : id === 'shimmer' ? 1 : hop().travel),
    kind: o.kind ?? 'rule',
    tone: (['go', 'alt', 'drop', 'ok', 'sys'].includes(o.tone ?? '') ? o.tone : 'go') as TTone,
    pan: o.pan ?? 0,
    p1: o.p1 ?? 0,
    intensity: o.intensity ?? 1,
    part: o.part ?? '',
    beat: o.beat,
  };
  b.stretch = 2;
  R[id](b, p);
  return b;
}

function begin(c: BaseAudioContext, bus: IBus, id: TSfxId, o: IPlayOpts, flags: { exempt?: boolean; trim?: boolean } = {}): IHandle {
  own(c);
  const now = c.currentTime;
  const t = flags.trim && o.at !== undefined ? o.at : Math.max(o.at ?? now, now + 0.003);
  const pri = priOf(id);
  if (!flags.exempt) {
    const key = id === 'clank' ? `clank:${o.part}` : id;
    const cd = COOL[id];
    const prev = last.get(key);
    if (cd && prev !== undefined && Math.abs(t - prev) < cd) return NOOP;
    last.set(key, t);
    // governor: live system starts are capped at 3 per 250 ms
    if (o.at === undefined && !INPUT.has(id)) {
      gov = gov.filter((g) => now - g.t < 0.25);
      if (gov.length >= 3) {
        const low = gov.reduce((a, g) => (g.pri < a.pri ? g : a));
        if (low.pri >= pri) return NOOP;
        voices.steal(low.v);
        gov.splice(gov.indexOf(low), 1);
      }
    }
  }
  const live = voices.at(t);
  const same = live.filter((v) => v.id === id);
  if (same.length >= PER_ID) voices.steal(same[0]);
  else if (live.length >= POOL) {
    const victim = live.filter((v) => v.pri <= pri).sort((a, b) => a.pri - b.pri || a.start - b.start)[0];
    if (!victim) return NOOP;
    voices.steal(victim);
  }
  const round = rr.get(id) ?? 0;
  rr.set(id, round + 1);
  const b = render(c, bus, id, t, o, harmonyAt(t), seeded((Math.random() * 2 ** 32) >>> 0), round);
  const v: IVoice = { id, pri, start: t, end: b.end, kill: b.kill, srcs: b.srcs, nodes: b.nodes };
  voices.add(v);
  if (!flags.exempt && o.at === undefined && !INPUT.has(id)) gov.push({ t: now, pri, v });
  later(c, t, () => !v.cancelled && debugEvent(id, t, b.notes.length ? b.notes : undefined, heardAt(c, t)));
  return { stop: () => voices.steal(v), cancel: () => voices.cancel(v) };
}

export function play(id: TSfxId, o: IPlayOpts = {}): IHandle {
  const c = audio.ctx;
  const bus = audio.bus;
  if (!c || !bus) return NOOP;
  if (id === 'crash') music.onCrash();
  if (id === 'runStart' && o.beat === undefined) o = { ...o, beat: music.grid(1) };
  if (id === 'arrive' && o.k === undefined) o = { ...o, k: ladder.next() };
  return begin(c, bus, id, o);
}
// #endregion

// #region Courier
let lastPuff = -1;
let arrivals: number[] = [];
// cooldowns and strums hold audio times, and every open starts a new context clock at 0
let owner: BaseAudioContext | undefined;
function own(c: BaseAudioContext) {
  if (c === owner) return;
  owner = c;
  last.clear();
  gov = [];
  lastPuff = -1;
  arrivals = [];
}

function courier(o: { at?: number; fromPan: number; toPan: number; kind: TNodeKind; tone: string }): { cancel(): void } {
  const c = audio.ctx;
  const bus = audio.bus;
  if (!c || !bus) return { cancel: () => undefined };
  own(c);
  const now = c.currentTime;
  const t0 = Math.max(o.at ?? now, now + 0.003);
  const rm = reducedMotion();
  const travel = rm ? 0.05 : hop().travel;
  const hs: IHandle[] = [];
  if (!rm) {
    // siblings leaving in the same tick share one puff
    if (Math.abs(t0 - lastPuff) > 0.005) {
      lastPuff = t0;
      hs.push(begin(c, bus, 'puff', { at: t0, pan: o.fromPan }, { exempt: true }));
    }
    if (o.tone === 'alt' || o.tone === 'drop') hs.push(begin(c, bus, 'whoosh', { at: t0, pan: o.fromPan, p1: o.toPan, dur: travel, tone: o.tone }, { exempt: true }));
  }
  // arrivals that land together strum 25 ms apart
  arrivals = arrivals.filter((a) => a > now - 1);
  // the arrival stays on the grid when the departure slipped by output latency; after a longer stall it follows the courier
  const lat = c instanceof AudioContext ? Math.min(c.outputLatency || c.baseLatency || 0, 0.1) : 0;
  const base = o.at !== undefined && o.at > now - lat - 0.08 ? o.at : t0;
  let ta = Math.max(base + travel, now + 0.003);
  while (arrivals.some((a) => Math.abs(a - ta) < 0.02)) ta = Math.max(...arrivals.filter((a) => Math.abs(a - ta) < 0.02)) + 0.025;
  arrivals.push(ta);
  hs.push(begin(c, bus, 'arrive', { at: ta, kind: o.kind, tone: o.tone, pan: o.toPan, k: ladder.next() }, { exempt: true }));
  return { cancel: () => hs.forEach((h) => h.cancel()) };
}

const ladder = {
  n: 0,
  reset() {
    this.n = 0;
  },
  next() {
    return this.n++;
  },
};
// #endregion

// #region Loops
interface ILoop {
  set(v: number, pan?: number): void;
  stop(): void;
}
const NOOP_LOOP: ILoop = { set: () => undefined, stop: () => undefined };
const LOOP_LV: Record<TLoopId, number> = { scrub: -34.3, dragServo: -31.7, wheels: -33.4 };

function loop(id: TLoopId): ILoop {
  if (!audio.ctx || !audio.bus) return NOOP_LOOP;
  let inst: ILoop | undefined;
  let ended = false;
  const make = () => {
    const c = audio.ctx;
    const bus = audio.bus;
    if (!c || !bus) return undefined;
    return voice(c, bus, id, () => {
      inst = undefined;
    });
  };
  inst = make();
  const h: ILoop = {
    // a loop that stopped itself after a still pointer starts again on the next move
    set(v, pan) {
      if (ended || !Number.isFinite(v)) return;
      if (!inst && v > 0) inst = make();
      inst?.set(v, pan);
    },
    stop() {
      if (ended) return;
      ended = true;
      inst?.stop();
      inst = undefined;
      loops.set.delete(h);
    },
  };
  loops.set.add(h);
  return h;
}

function voice(c: BaseAudioContext, bus: IBus, id: TLoopId, onAuto: () => void): ILoop {
  const nodes: AudioNode[] = [];
  const srcs: AudioScheduledSourceNode[] = [];
  const add = <T extends AudioNode>(n: T) => (nodes.push(n), n);
  const t = c.currentTime;
  const out = add(c.createGain());
  out.gain.value = 0;
  let pn: StereoPannerNode | undefined;
  if (id !== 'wheels' && !coarse) {
    pn = add(c.createStereoPanner());
    out.connect(pn).connect(bus.sfxIn);
  } else out.connect(bus.sfxIn);
  const flt = add(c.createBiquadFilter());
  flt.connect(out);
  let osc: OscillatorNode | undefined;
  const r = music.harmonyAt(t).r;
  if (id === 'dragServo') {
    flt.type = 'lowpass';
    flt.frequency.value = 1500;
    flt.Q.value = 0.7;
    osc = add(c.createOscillator());
    osc.type = 'triangle';
    osc.frequency.value = hz(r + 24);
    osc.connect(flt);
    const lfo = add(c.createOscillator());
    lfo.frequency.value = 6;
    const depth = add(c.createGain());
    depth.gain.value = 10;
    lfo.connect(depth).connect(osc.detune);
    srcs.push(osc, lfo);
  } else {
    flt.type = 'bandpass';
    flt.Q.value = id === 'scrub' ? 1.2 : 2;
    flt.frequency.value = id === 'scrub' ? 800 : 600;
    const s = add(c.createBufferSource());
    s.buffer = bus.noise;
    s.loop = true;
    s.connect(flt);
    srcs.push(s);
  }
  srcs.forEach((s) => (s instanceof AudioBufferSourceNode ? s.start(t, Math.random() * 1.9) : s.start(t)));
  srcs[0].onended = () => nodes.forEach((n) => n.disconnect());
  debugEvent(id, t);

  const L = db(LOOP_LV[id]);
  let ema = 0;
  let pan = 0;
  let applied = -1;
  let lastSet = performance.now();
  let raf = 0;
  let stopped = false;
  const apply = () => {
    raf = 0;
    if (stopped) return;
    const now = c.currentTime;
    const k = id === 'scrub' ? clamp01((ema - 1200) / 2000) : id === 'dragServo' ? clamp01((ema - 40) / 1460) : clamp01(ema / 20);
    // changes under 2% are not worth an automation event, but the final zero is always written once
    if (k === applied || (Math.abs(k - applied) < 0.02 && k !== 0)) return;
    applied = k;
    out.gain.setTargetAtTime(k * L, now, 0.03);
    if (id === 'scrub') flt.frequency.setTargetAtTime(800 + 2400 * k, now, 0.03);
    else if (id === 'wheels') flt.frequency.setTargetAtTime(600 + 1200 * k, now, 0.03);
    else osc?.frequency.setTargetAtTime(hz(r + 24 + 7 * k), now, 0.03);
    if (pn && Number.isFinite(pan)) pn.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.03);
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  // a pointer held still fires no moves, so the speed decays here and the loop ends itself
  const dog = window.setInterval(() => {
    const idle = performance.now() - lastSet;
    if (idle > 250) {
      stop();
      onAuto();
    } else if (idle > 50) {
      ema *= 0.5;
      queue();
    }
  }, 50);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(dog);
    cancelAnimationFrame(raf);
    const now = c.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.015);
    srcs.forEach((s) => {
      try {
        s.stop(now + 0.12);
      } catch {
        // context already closed
      }
    });
    debugEvent(`${id}:stop`, now);
  };
  return {
    set(v, p) {
      if (stopped || !Number.isFinite(v)) return;
      ema += 0.3 * (Math.abs(v) - ema);
      if (p !== undefined) pan = p;
      lastSet = performance.now();
      queue();
    },
    stop,
  };
}
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
// #endregion

// #region Zoom
const LO = 0.3;
const HI = 2.2;
let zoomArmed = true;
let btn = { t: 0, n: 0, dir: 0 };
const step10 = (k: number) => Math.floor(Math.log(k) / Math.log(1.1) + 1e-9);

function zoom(kOld: number, kNew: number, source: 'button' | 'wheel' | 'pinch') {
  if (!Number.isFinite(kOld) || !Number.isFinite(kNew)) return;
  const pinned = kNew <= LO + 1e-6 || kNew >= HI - 1e-6;
  if (pinned && Math.abs(kNew - kOld) < 1e-6) {
    // every button press is its own gesture, so each one at the limit bonks
    if (zoomArmed || source === 'button') play('bonk', { intensity: 0.5 });
    zoomArmed = false;
    return;
  }
  if (!pinned) zoomArmed = true;
  if (source === 'button') {
    const dir = kNew > kOld ? 1 : -1;
    const now = performance.now();
    btn = now - btn.t < 400 && btn.dir === dir ? { t: now, n: btn.n + 1, dir } : { t: now, n: 0, dir };
    play(dir > 0 ? 'zoomIn' : 'zoomOut', { step: btn.n % 4 });
    return;
  }
  const a = step10(kOld);
  const b = step10(kNew);
  if (a !== b) play('detent', { k: b });
}
// #endregion

// #region Boot
function boot(o: { nodes: number; edges: number; originPan: number; startPerf: number }): { stop(): void } {
  const c = audio.ctx;
  const bus = audio.bus;
  if (!c || !bus) return { stop: () => undefined };
  const id = audio.themeId;
  const short = audio.opens > 1;
  const hs: IHandle[] = [];
  let raf = 0;
  let dead = false;
  const t0 = performance.now();
  const go = () => {
    raf = 0;
    if (dead) return;
    const ts = c instanceof AudioContext && c.getOutputTimestamp ? c.getOutputTimestamp() : undefined;
    const ok = !!ts && !!ts.contextTime && !!ts.performanceTime;
    // iOS spins the output up late; wait up to 300 ms for a real timestamp
    if (!ok && performance.now() - t0 < 300 && c.state !== 'running') {
      raf = requestAnimationFrame(go);
      return;
    }
    const lat = c instanceof AudioContext ? Math.min(c.outputLatency || c.baseLatency || 0, 0.1) : 0;
    const T = ok ? ts.contextTime! + (o.startPerf - ts.performanceTime!) / 1000 : c.currentTime - lat - (performance.now() - o.startPerf) / 1000;
    const now = c.currentTime;
    const at = (id: TSfxId, dt: number, x: IPlayOpts = {}) => {
      if (T + dt < now) return;
      hs.push(begin(c, bus, id, { ...x, at: T + dt }, { exempt: true }));
    };
    hs.push(begin(c, bus, 'irisOpen', { at: Math.max(T, now - 0.9, 0), pan: o.originPan }, { exempt: true, trim: true }));
    if (!short) {
      at('teletype', 0.35, { step: 0 });
      at('teletype', 0.51, { step: 1 });
      at('confirm', 0.67);
      at('powerUp', 0.4, { dur: 1.4 });
      for (let i = 0; i < o.nodes; i++) at('nodePop', 1.05 + 0.05 * i, { k: i });
      at('shimmer', 1.1, { dur: Math.max(0, o.edges - 1) * 0.04 + 1 });
    }
    at('latch', 1.2);
    music.start(id, { at: T + 1.2, fadeIn: 2 });
  };
  go();
  return {
    stop: () => {
      dead = true;
      cancelAnimationFrame(raf);
      hs.forEach((h) => h.cancel());
    },
  };
}
// #endregion

// #region Stingers
interface INote {
  d?: number;
  m?: number;
  s: number;
  h?: number;
}
export interface ISting {
  notes: INote[];
  len: number;
  tri?: boolean;
  kick?: number[];
  swell?: boolean;
  spin?: boolean;
  cymbal?: number;
  lead?: number;
  lv: string;
}
const COIN: INote[] = [
  { d: 4, s: 0, h: 0.5 },
  { d: 7, s: 0.5, h: 0.5 },
];
const SHORT = [
  [4, 7],
  [2, 7],
  [9, 7],
];
export const stingOf = (id: TStinger, full: boolean, variant: number, r: number, scale: readonly number[]): ISting => {
  switch (id) {
    case 'yes':
      return { notes: [4, 5, 7, 9].map((d, i) => ({ d, s: i, h: i === 3 ? 4 : 1 })), len: 4, swell: true, lv: 'yes' };
    case 'no':
      return { notes: [3, 2, 0].map((d, i) => ({ d, s: i * 2, h: i === 2 ? 4 : 2 })), len: 6, tri: true, lv: 'no' };
    case 'mission':
      return { notes: [...COIN, { d: 7, s: 1, h: 1 }, { d: 11, s: 1.5, h: 2 }], len: 2, lv: 'mission' };
    case 'missionBig':
      return { notes: [...COIN, ...[4, 7, 9, 11].map((d, i) => ({ d, s: 1 + i * 0.75, h: i === 3 ? 3 : 1 }))], len: 4, kick: [0], lv: 'missionBig' };
    case 'rankUp':
      return { notes: [...[0, 4, 7].map((d) => ({ d, s: 4, h: 4 })), ...COIN.map((n) => ({ d: (n.d ?? 0) + 7, s: n.s + 4, h: 3 }))], len: 8, lead: 4, swell: true, lv: 'rankUp' };
    case 'clearance':
      return {
        notes: [...[0, 2, 4, 6, 7, 9, 11, 14].map((d, i) => ({ d, s: i, h: i === 7 ? 8 : 1 }))],
        len: 32,
        kick: [0, 4, 8],
        cymbal: 8,
        swell: true,
        lv: 'clearance',
      };
    case 'chaosComplete':
      if (full)
        return {
          notes: [...[0, 2, 4, 7].map((d, i) => ({ d, s: i })), { m: degree(scale, r, 7) + 1, s: 4, h: 2 }, { d: 7, s: 6, h: 2 }],
          len: 8,
          kick: [0],
          swell: true,
          spin: true,
          lv: 'chaosComplete',
        };
      break;
    case 'complete':
      if (full) return { notes: [0, 2, 4, 7, 8].map((d, i) => ({ d, s: i, h: i === 4 ? 6 : 1 })), len: 6, kick: [0], swell: true, spin: true, lv: 'complete' };
      break;
  }
  return { notes: SHORT[variant % 3].map((d, i) => ({ d, s: i, h: i ? 2 : 1 })), len: 2, spin: true, lv: 'completeShort' };
};

const kick = (b: VB, t: number, peak = 1) => {
  const g = b.g(0, b.out);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  const o = b.osc('sine', 150, g, t, t + 0.32);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
  const o2 = b.osc('sine', 300, b.g(rel(-10), g), t, t + 0.32);
  o2.frequency.exponentialRampToValueAtTime(90, t + 0.08);
  b.noise({ type: 'highpass', f0: 3000, a: 0.001, d: 0.007, t0: t, peak: peak * rel(-18) });
};

// the stinger voice on the effects side, so it survives a music fade; returns its end time
export function renderSting(c: BaseAudioContext, bus: IBus, s: ISting, t: number, spb: number, h: IHarmony, rnd: () => number) {
  const b = new VB(c, bus, t, { level: db(LV_STING[s.lv] ?? -24), send: rel(-2), rnd });
  const s16 = spb / 4;
  const lp = s.tri ? b.f('lowpass', 1500, 0.7, b.out) : undefined;
  s.notes.forEach((n) => {
    const m = n.m ?? degree(h.scale, h.r, n.d ?? 0);
    const at = t + n.s * s16;
    if (lp) b.tone({ type: 'triangle', f: hz(m), a: 0.004, d: (n.h ?? 1) * s16 + 0.2, t0: at, to: lp, note: m });
    else b.fm({ f: hz(m), ratio: 3.5, i0: 2, dur: 1, d: 0.6 + (n.h ?? 1) * s16, t0: at, peak: 0.7, note: m });
  });
  s.kick?.forEach((k) => kick(b, t + k * s16, rel(-4)));
  if (s.cymbal !== undefined) b.noise({ type: 'highpass', f0: 5000, a: 0.002, d: 1.2, t0: t + s.cymbal * s16, peak: rel(-12) });
  if (s.lead) {
    const g = b.g(0, b.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rel(-10), t + s.lead * s16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s.lead * s16 + 0.05);
    const bp = b.f('bandpass', 400, 3, g);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(4000, t + s.lead * s16);
    b.nz(bp, t, t + s.lead * s16 + 0.08);
  }
  if (s.spin) {
    const at = t + Math.max(0, s.len - 2) * s16;
    const sl = b.f('lowpass', 3000, 0.7, b.out);
    sl.frequency.setValueAtTime(3000, at);
    sl.frequency.exponentialRampToValueAtTime(600, at + 0.4);
    b.tone({ type: 'sawtooth', f: 660, f1: 220, glide: 0.4, a: 0.005, d: 0.4, t0: at, to: sl, peak: rel(-14) });
  }
  const v: IVoice = { id: `sting:${s.lv}`, pri: 2, start: t, end: b.end, kill: b.kill, srcs: b.srcs, nodes: b.nodes };
  if (c === audio.ctx) voices.add(v);
  else reap(b.srcs, [...b.nodes, b.kill]);
  return { end: t + s.len * s16, tail: b.end, notes: b.notes };
}
// #endregion

export const sfx = guarded(
  {
    play,
    courier,
    loop,
    zoom,
    boot,
    ladder,
    panOf: (clientX: number) => Math.max(-1, Math.min(1, (clientX / Math.max(innerWidth, 1)) * 2 - 1)) * 0.6,
  },
  { play: () => NOOP, courier: () => NOOP, loop: () => NOOP_LOOP, boot: () => NOOP, panOf: () => 0 },
);
guarded(ladder, { next: () => 0 });
