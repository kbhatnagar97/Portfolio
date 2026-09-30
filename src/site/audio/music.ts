import { reducedMotion } from '../smooth';
import { audio } from './engine';
import { coarse, db, debugEvent, guarded, heardAt, later, reap, seeded, type IBus } from './core';
import { VB, renderSting, stingOf, type IHarmony, type TStinger } from './sfx';
import { hz, sus4, theme, themeOf, toneIn, type ITheme } from './themes';

export interface IClock {
  readonly at: number | undefined;
  start(): Promise<void>;
  skip(beats: number): void;
  advance(beats: number): Promise<void>;
  resync(): void;
}

type TState = 'idle' | 'running' | 'decision';
type TTag = 'drum' | 'bass' | 'arp' | 'tonal' | 'hb';

// peak dBFS per music voice (arp is a trim on the theme's arp peak); tuned so the offline check meets the bed RMS targets
export const MV = {
  pad: -31,
  drone: -25,
  bass: -28,
  kickX: -19,
  kickx: -21,
  rim: -25,
  clap: -20,
  softRim: -20,
  hat: -26,
  ohat: -24,
  shaker: -24,
  arp: 3,
  motif: -30,
  texture: -36,
  heartbeat: -27.5,
  riser: -33,
  bed: -35,
  glitch: -33,
};

// the running state lifts the pad and drone so the bed, not the drum peaks, carries the level
const LIFT = 4.5;

// #region Persistent voices
export interface IPad {
  glide(v: readonly number[], t: number, chaos: boolean): void;
  lift(t: number, dB: number): void;
  swell(t: number, dur: number, dB: number): void;
  stop(t: number): void;
}

export function makePad(c: BaseAudioContext, bus: IBus, th: ITheme, t0: number, v: readonly number[]): IPad {
  const spb = 60 / th.bpm;
  const N = coarse ? 4 : 5;
  const det = th.pad.fm ? [-5, 5] : coarse ? [-6, 6] : [-8, 0, 8];
  const nodes: AudioNode[] = [];
  const srcs: OscillatorNode[] = [];
  const add = <T extends AudioNode>(n: T) => (nodes.push(n), n);
  const out = add(c.createGain());
  out.gain.value = db(MV.pad + (th.pad.fm ? -8 : 0)) / Math.sqrt(N * det.length);
  out.connect(bus.pump);
  const lifted = add(c.createGain());
  lifted.connect(out);
  const swell = add(c.createGain());
  swell.connect(lifted);
  // 2 bar breathe of 1.5 dB, locked to the 8 beat reactor glow
  const breathe = add(c.createGain());
  breathe.connect(swell);
  // FM at a 1:1 ratio puts a sideband at 0 Hz; this keeps that offset off the bus
  const dc = add(c.createBiquadFilter());
  dc.type = 'highpass';
  dc.frequency.value = 20;
  dc.connect(breathe);
  const lp = add(c.createBiquadFilter());
  lp.type = 'lowpass';
  lp.frequency.value = th.pad.cutoff;
  lp.Q.value = 0.7;
  lp.connect(dc);
  const osc = (type: OscillatorType, f: number, to: AudioNode | AudioParam) => {
    const o = add(c.createOscillator());
    o.type = type;
    o.frequency.value = f;
    if (to instanceof AudioParam) o.connect(to);
    else o.connect(to);
    srcs.push(o);
    return o;
  };
  // the 4 bar filter sweep sonifies the reactor ring rotation
  const sweep = add(c.createGain());
  sweep.gain.value = 300;
  sweep.connect(lp.frequency);
  osc('sine', 1 / (16 * spb), sweep);
  const swellDepth = add(c.createGain());
  swellDepth.gain.value = db(1.5) - 1;
  swellDepth.connect(breathe.gain);
  osc('sine', 1 / (8 * spb), swellDepth);

  const cars: OscillatorNode[][] = [];
  const mods: { o: OscillatorNode; g: GainNode }[][] = [];
  for (let i = 0; i < N; i++) {
    const f = hz(v[i] ?? v[0] + 12);
    cars.push([]);
    mods.push([]);
    det.forEach((d) => {
      const o = osc(th.pad.fm ? 'sine' : 'sawtooth', f, lp);
      o.detune.value = d;
      cars[i].push(o);
      if (th.pad.fm) {
        const g = add(c.createGain());
        g.gain.value = f * 0.6;
        g.connect(o.frequency);
        const m = osc('sine', f, g);
        m.detune.value = d;
        mods[i].push({ o: m, g });
      }
    });
  }
  const start = Math.max(t0, c.currentTime);
  // detuned saws start phase aligned, so the pad fades in instead of spiking
  const lvl = out.gain.value;
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(lvl, start + 0.5);
  srcs.forEach((s) => s.start(start));
  reap(srcs, nodes);
  return {
    glide(v, t, chaos) {
      for (let i = 0; i < N; i++) {
        const f = hz(v[i] ?? v[0] + 12);
        if (!Number.isFinite(f)) continue;
        cars[i].forEach((o, j) => {
          o.frequency.setTargetAtTime(f, t, 0.06);
          o.detune.setTargetAtTime(chaos ? Math.sign(det[j]) * 22 : det[j], t, 0.1);
        });
        mods[i].forEach((m, j) => {
          m.o.frequency.setTargetAtTime(f, t, 0.06);
          m.o.detune.setTargetAtTime(chaos ? Math.sign(det[j]) * 22 : det[j], t, 0.1);
          m.g.gain.setTargetAtTime(f * 0.6, t, 0.06);
        });
      }
    },
    lift(t, dB) {
      lifted.gain.setTargetAtTime(db(dB), t, 0.3);
    },
    swell(t, dur, dB) {
      swell.gain.cancelScheduledValues(t);
      swell.gain.setTargetAtTime(db(dB), t, 0.05);
      swell.gain.setTargetAtTime(1, t + dur, 0.2);
    },
    stop(t) {
      out.gain.cancelScheduledValues(c.currentTime);
      out.gain.setTargetAtTime(0, Math.max(c.currentTime, t - 0.2), 0.05);
      srcs.forEach((s) => {
        try {
          s.stop(Math.max(t, c.currentTime + 0.05));
        } catch {
          // already stopped
        }
      });
    },
  };
}

interface IDecision {
  glide(v: readonly number[], t: number): void;
  kill(t: number, tc: number): void;
}

// riser for 2 bars up and 2 down, then the sus4 bed until the choice; both behind one kill gain
export function makeDecision(c: BaseAudioContext, bus: IBus, t0: number, spb: number, h: IHarmony): IDecision {
  const b = new VB(c, bus, t0, { level: 1, rnd: Math.random, dest: bus.tone });
  const bar = 4 * spb;
  const long = t0 + 600;
  const rg = b.g(0);
  rg.gain.setValueAtTime(0.0001, t0);
  rg.gain.exponentialRampToValueAtTime(db(MV.riser), t0 + 2 * bar);
  rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 4 * bar);
  const rlp = b.f('lowpass', 500, 1, rg);
  rlp.frequency.setValueAtTime(500, t0);
  rlp.frequency.exponentialRampToValueAtTime(3000, t0 + 2 * bar);
  rlp.frequency.exponentialRampToValueAtTime(500, t0 + 4 * bar);
  [0, 1].forEach((i) => {
    const s = b.osc('sawtooth', hz(toneIn(h.chord, h.r + 12, h.r + 19, i)), rlp, t0, t0 + 4 * bar + 0.1);
    s.detune.value = i ? 10 : -10;
  });
  const nbp = b.f('bandpass', 400, 3, b.g(0.5, rg));
  nbp.frequency.setValueAtTime(400, t0);
  nbp.frequency.exponentialRampToValueAtTime(3000, t0 + 2 * bar);
  nbp.frequency.exponentialRampToValueAtTime(400, t0 + 4 * bar);
  b.nz(nbp, t0, t0 + 4 * bar + 0.1);

  const bg = b.g(0);
  bg.gain.setValueAtTime(0, t0);
  bg.gain.setValueAtTime(0, t0 + 3.5 * bar);
  bg.gain.linearRampToValueAtTime(db(MV.bed) / 3, t0 + 4 * bar);
  const blp = b.f('lowpass', 1200, 0.7, bg);
  const v = sus4(h.chord, h.root).slice(0, 4);
  const tri = v.map((n) => [-6, 6].map((d) => {
    const o = b.osc('triangle', hz(n), blp, t0, long);
    o.detune.value = d;
    return o;
  }));
  reap(b.srcs, [...b.nodes, b.kill]);
  let dead = false;
  return {
    glide(nv, t) {
      tri.forEach((pair, i) => pair.forEach((o) => o.frequency.setTargetAtTime(hz(nv[i] ?? nv[0]), t, 0.06)));
    },
    kill(t, tc) {
      if (dead) return;
      dead = true;
      const at = Math.max(t, c.currentTime);
      b.kill.gain.cancelScheduledValues(at);
      b.kill.gain.setValueAtTime(1, at);
      b.kill.gain.setTargetAtTime(0, at, tc);
      b.srcs.forEach((s) => {
        try {
          s.stop(at + tc * 7 + 0.02);
        } catch {
          // already stopped
        }
      });
    },
  };
}
// #endregion

// #region Step scheduler
// everything scheduleStep reads, so the offline check renders exactly what the live scheduler plays
export interface IStep {
  theme: ITheme;
  state: TState;
  traffic: boolean;
  chaos: boolean;
  burstUntil: number;
  transpose: number;
  thin: boolean;
  fillBar: number;
  decBar: number;
  pad?: IPad;
  dec?: IDecision;
  prevGlitch?: number;
}

export const newStep = (th: ITheme): IStep => ({ theme: th, state: 'idle', traffic: false, chaos: false, burstUntil: -1, transpose: 0, thin: false, fillBar: -1, decBar: 0 });

const mod = (n: number, m: number) => ((n % m) + m) % m;
export const harmonyOf = (th: ITheme, bar: number, tr: number, decision: boolean): IHarmony => {
  const i = mod(bar, 4);
  const root = th.bass[i] + tr;
  const chord = th.chords[i].map((n) => n + tr);
  return { chord: decision ? sus4(chord, root) : chord, r: th.root + tr, root, scale: th.scale };
};

type TSink = (b: VB, tag: TTag) => void;

let shaper: { c: BaseAudioContext; curve: Float32Array<ArrayBuffer> } | undefined;
const staircase = (c: BaseAudioContext) => {
  if (shaper?.c === c) return shaper.curve;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = (Math.min(7, Math.floor(((i / (curve.length - 1)) * 2 - 1 + 1) * 4)) - 3.5) / 3.5;
  shaper = { c, curve };
  return curve;
};

export function scheduleStep(c: BaseAudioContext, bus: IBus, st: IStep, n: number, t: number, rnd: () => number, sink?: TSink) {
  const th = st.theme;
  const spb = 60 / th.bpm;
  const s16 = spb / 4;
  const bar = Math.floor(n / 16);
  const s = mod(n, 16);
  const decision = st.state === 'decision';
  const h = harmonyOf(th, bar, st.transpose, decision);
  const R = h.r;
  const voice = (lv: number, tag: TTag, dest: AudioNode, pan?: number) => {
    const b = new VB(c, bus, t, { level: db(lv), rnd, dest, pan });
    sink?.(b, tag);
    return b;
  };
  const done = (b: VB) => reap(b.srcs, [...b.nodes, b.kill]);
  const vel = (range: number) => (rnd() * 2 - 1) * range;
  const hit = (p: string, i = s) => p[i] === 'x' || p[i] === 'X';
  const acc = (p: string, i = s) => p[i] === 'X';

  if (s === 0) {
    const v = [...h.chord];
    // the pad raises its top note an octave on every second 4 bar pass
    if (mod(Math.floor(bar / 4), 2) === 1) v[v.length - 1] += 12;
    st.pad?.glide(v, t, st.chaos);
    st.pad?.lift(t, st.state === 'running' ? LIFT : 0);
    st.dec?.glide(sus4(harmonyOf(th, bar, st.transpose, false).chord, h.root), t);
    if (!st.thin) {
      const b = voice(MV.drone + (st.state === 'running' ? LIFT : 0), 'tonal', bus.pump);
      const g = b.g(0);
      const end = t + 16 * s16;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.02);
      // crossfades into the next bar's drone instead of stacking on the bar line
      g.gain.setValueAtTime(1, end - 0.06);
      g.gain.setTargetAtTime(0, end - 0.06, 0.1);
      b.osc('sine', hz(h.root), g, t, end + 0.75);
      b.osc('triangle', hz(h.root + 12), b.g(db(-8), g), t, end + 0.75);
      done(b);
    }
    if (!st.thin && mod(bar, 4) === 0) {
      const m = th.motif[mod(Math.floor(bar / 4), 3)];
      const b = voice(MV.motif, 'tonal', bus.tone);
      m.n.forEach((iv, i) => b.fm({ f: hz(R + 12 + iv), ratio: 2, i0: 1.5, dur: 1.2, t0: t + m.s[i] * s16, peak: 1, note: R + 12 + iv }));
      done(b);
    }
  }

  // texture plays in idle only
  if (st.state === 'idle') {
    const pick = () => toneIn(h.chord, R + 12, R + 24, Math.floor(rnd() * 4));
    if (th.texture === 'teleprinter' && rnd() < 0.15) {
      const b = voice(MV.texture, 'tonal', bus.tone);
      const m = pick();
      b.tone({ type: 'triangle', f: hz(m), a: 0.002, d: 0.03, note: m });
      done(b);
    } else if (th.texture === 'ticktock' && 'X...x...x...x...'[s] !== '.') {
      const b = voice(MV.texture + (s === 0 ? 0 : -2), 'tonal', bus.tone);
      let m = R + 12;
      while (mod(m - h.root, 12) !== (s % 8 === 0 ? 7 : 0)) m++;
      b.fm({ f: hz(m), ratio: 2, i0: 0.5, dur: 0.04, a: 0.002, d: 0.04 });
      done(b);
    } else if (th.texture === 'droplet' && s === 0 && mod(bar, 2) === 1) {
      const b = voice(MV.texture + 4, 'tonal', bus.tone);
      const m = pick();
      b.fm({ f: hz(m), ratio: 2, i0: 1.5, dur: 1.2, note: m });
      done(b);
    }
  }
  if (st.thin) return;

  if (st.state === 'running') {
    const fill = mod(bar, 4) === 3 || bar === st.fillBar;
    const pb = mod(bar, 8) >= 4 ? 1 : 0;
    const breath = mod(bar, 16) === 15;
    const pd = fill ? 1 : 0;
    // traffic lifts the drums 2 dB, except the kick that already sets the peaks
    const boost = st.traffic ? 2 : 0;
    const P = th.pat;
    if (!breath && hit(P.kick[pd])) {
      const b = voice((acc(P.kick[pd]) ? MV.kickX : MV.kickx) + vel(1), 'drum', bus.musicMix);
      const g = b.g(0);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      const o = b.osc('sine', 150, g, t, t + 0.32);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      b.noise({ type: 'highpass', f0: 3000, a: 0.001, d: 0.007, peak: db(-18) });
      done(b);
      // the sustained layers dip under each kick so it reads through them
      bus.pump.gain.setValueAtTime(1, t);
      bus.pump.gain.linearRampToValueAtTime(0.7, t + 0.008);
      bus.pump.gain.setTargetAtTime(1, t + 0.01, 0.06);
    }
    if (hit(P.snare[pd])) {
      const lv = { rim: MV.rim, clap: MV.clap, softRim: MV.softRim }[th.snare] + boost + vel(1) + (acc(P.snare[pd]) ? 0 : -4);
      const b = voice(lv, 'drum', bus.musicMix);
      if (th.snare === 'rim') {
        b.noise({ type: 'bandpass', f0: 2500, q: 5, a: 0.001, d: 0.03 });
        b.tone({ type: 'triangle', f: 400, f1: 380, a: 0.001, d: 0.03, peak: 0.5 });
      } else if (th.snare === 'clap') {
        [0, 0.012, 0.024].forEach((o) => b.noise({ type: 'bandpass', f0: 1800, q: 0.9, a: 0.001, d: 0.01, t0: t + o, peak: 0.7 }));
        b.noise({ type: 'bandpass', f0: 1800, q: 0.9, a: 0.001, d: 0.12, t0: t + 0.034 });
      } else b.noise({ type: 'bandpass', f0: 3000, q: 4, a: 0.001, d: 0.02 });
      done(b);
    }
    const hatPat = st.traffic && th.traffic === 'hat16' ? 'xxXxxxXxxxXxxxXx' : st.traffic && th.traffic === 'hat8' && !fill ? 'x.X.x.X.x.X.x.X.' : P.hat[pd];
    if (hit(hatPat)) {
      const shaker = th.hat === 'shaker';
      const b = voice((shaker ? MV.shaker : MV.hat) + (acc(hatPat) ? 0 : -4) + boost + vel(1.5), 'drum', bus.musicMix);
      if (shaker) b.noise({ type: 'bandpass', f0: 6000, q: 1.5, a: 0.01, d: 0.04 });
      else b.noise({ type: 'highpass', f0: 7000, q: 0.7, a: 0.001, d: 0.03 });
      done(b);
    }
    if (hit(P.ohat[pd])) {
      const b = voice(MV.ohat + boost + vel(1.5), 'drum', bus.musicMix);
      b.noise({ type: 'highpass', f0: 7000, q: 0.7, a: 0.001, d: 0.12 });
      done(b);
    }
    const bp = P.bass[pb];
    if (bp[s] !== '.') {
      let len = 1;
      while (s + len < 16 && bp[s + len] === '.') len++;
      const m = h.root + (bp[s] === 'o' ? 12 : bp[s] === '5' ? 7 : 0);
      const b = voice(MV.bass + vel(1), 'bass', bus.pump);
      const d = s16 * 0.9 * len;
      b.tone({ f: hz(m), a: 0.005, d, note: m });
      b.tone({ type: 'triangle', f: hz(m + 12), a: 0.005, d, peak: db(-8) });
      if (th.bassSaw) b.tone({ type: 'sawtooth', f: hz(m + 12), a: 0.005, d, to: b.f('lowpass', 1200), peak: db(-10) });
      done(b);
    }
    const ap = P.arp[pb];
    if (!breath && ap[s] !== '.') arp(bus, st, h, Number(ap[s]), s, t, rnd, voice, done);
  }

  if (decision) {
    if (s === 0) {
      const b = voice(MV.bass - 6, 'bass', bus.pump);
      b.tone({ f: hz(h.root), a: 0.02, d: 16 * s16 * 0.95, note: h.root });
      b.tone({ type: 'triangle', f: hz(h.root + 12), a: 0.02, d: 16 * s16 * 0.95, peak: db(-8) });
      done(b);
    }
    const since = bar - st.decBar;
    if ((s === 0 || s === 8) && (since < 8 || mod(since, 8) === 0)) {
      const b = voice(MV.heartbeat, 'hb', bus.musicMix);
      [0, 0.15].forEach((o, i) => {
        const pk = i ? db(-3) : 1;
        b.tone({ f: 60, f1: 45, glide: 0.2, a: 0.003, d: 0.2, t0: t + o, peak: pk });
        b.tone({ f: 120, f1: 90, glide: 0.2, a: 0.003, d: 0.2, t0: t + o, peak: pk * db(-4) });
        b.noise({ type: 'bandpass', f0: 2000, q: 2, a: 0.001, d: 0.005, t0: t + o, peak: pk * db(-10) });
      });
      done(b);
    }
  }

  if (st.chaos) {
    const burst = bar < st.burstUntil;
    const stutter = (s === 7 || s === 15) && st.prevGlitch !== undefined;
    const p = burst ? 0.35 : mod(bar, 4) === 3 ? 0.08 : 0;
    if (stutter || (p && rnd() < p)) {
      const b = voice(MV.glitch, 'tonal', bus.tone);
      const ws = c.createWaveShaper();
      ws.curve = staircase(c);
      b.nodes.push(ws);
      ws.connect(b.f('bandpass', 1500, 2));
      const pool = [R + 12, R + 13, R + 18, R + 24];
      const m = stutter ? (st.prevGlitch as number) : pool[Math.floor(rnd() * 4)];
      st.prevGlitch = m;
      const hits = stutter ? [0, s16 / 2] : [0];
      hits.forEach((o) => {
        const g = b.g(0, ws);
        const end = b.env(g.gain, t + o, 1, 0.002, 0.05);
        const saw = b.osc('sawtooth', hz(m), g, t + o, end);
        saw.detune.value = (rnd() - 0.5) * 60;
      });
      done(b);
    }
  }
}

function arp(bus: IBus, st: IStep, h: IHarmony, d: number, s: number, t: number, rnd: () => number, voice: (lv: number, tag: TTag, dest: AudioNode) => VB, done: (b: VB) => void) {
  const th = st.theme;
  const ch = h.chord;
  let m = ch[d % ch.length] + 12 * Math.floor(d / ch.length);
  while (m < th.arp.low) m += 12;
  // the octave jump never leaves the arp register
  if (s === 15 && rnd() < 0.2 && m + 12 <= h.r + 30) m += 12;
  const detune = st.chaos ? 25 * Math.sin(2 * Math.PI * 0.5 * t) : 0;
  const play = (note: number, at: number, lv: number) => {
    const b = voice(lv + (rnd() * 2 - 1), 'arp', bus.tone);
    if (th.arp.kind === 'marimba') {
      const o = b.fm({ f: hz(note), ratio: 4, i0: 1.2, dur: 0.2, a: th.arp.a, d: th.arp.d, t0: at, note });
      o.detune.value = detune;
    } else {
      const lp = b.f('lowpass', 2400, th.arp.kind === 'saw' ? 3 : 0.7);
      const o = b.tone({ type: th.arp.kind === 'saw' ? 'sawtooth' : 'triangle', f: hz(note), a: th.arp.a, d: th.arp.d, t0: at, to: lp, note });
      o.detune.value = detune;
    }
    done(b);
  };
  play(m, t, th.arp.peak + MV.arp);
  if (st.traffic && th.traffic === 'echo' && m + 12 <= h.r + 30) play(m + 12, t + 60 / th.bpm / 2, th.arp.peak + MV.arp - 6);
}
// #endregion

// #region Live state
let bus: IBus | undefined;
let th: ITheme = theme();
let playing = false;
let origin = 0;
let next = 0;
let timer = 0;
let st: IStep | undefined;
let kept: { id: string; origin?: number; st?: IStep } | undefined;
let changes: { at: number; f: () => void }[] = [];
let decWin: [number, number] = [Infinity, Infinity];
let runActive = false;
let runBeat = -1;
let trs: { at: number; v: number }[] = [];
let lastPoke = 0;
let drifted = false;
let openedAt = 0;
let inspecting = false;
let layers = { chaos: false, traffic: false };
let fresh = { complete: true, chaos: true };
let shortN = 0;
let recent: { start: number; b: VB; tag: TTag }[] = [];
const waits = new Set<() => void>();
const rnd = seeded((Math.random() * 2 ** 32) >>> 0);

const ctxOf = () => bus?.c as AudioContext | undefined;
const spb = () => 60 / th.bpm;
const s16 = () => spb() / 4;
const barLen = () => 4 * spb();
const stepTime = (n: number) => origin + Math.floor(n / 2) * 2 * s16() + (n % 2) * s16() * (1 + th.swing);
const barOf = (t: number) => Math.floor((t - origin) / barLen() + 1e-6);
const stepAt = (t: number) => {
  let n = Math.max(0, Math.round((t - origin) / s16()));
  while (n > 0 && stepTime(n - 1) >= t - 1e-6) n--;
  while (stepTime(n) < t - 1e-6) n++;
  return n;
};
const transposeAt = (t: number) => trs.reduce((v, x) => (x.at <= t + 1e-6 ? x.v : v), 0);
const toneTarget = (state: TState) => {
  const f = state === 'decision' ? 900 : state === 'running' ? (st?.traffic ? 4500 : 3500) : 2600;
  return inspecting ? Math.min(f, 1600) : f;
};
const setTone = (f: number, at: number, tc = 0.1) => {
  if (!bus || !Number.isFinite(f)) return;
  bus.tone.frequency.cancelScheduledValues(at);
  bus.tone.frequency.setTargetAtTime(f, at, tc);
};
const gainTo = (g: GainNode, v: number, at: number, tc: number) => {
  const c = ctxOf();
  if (!c || !Number.isFinite(v)) return;
  const now = c.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.setTargetAtTime(v, Math.max(at, now), tc);
};

// applies f at audio time b; steps already scheduled past b are withdrawn and scheduled again
function atTime(b: number, f: () => void) {
  const c = ctxOf();
  if (!c || !st) return f();
  const lastT = next > 0 ? stepTime(next - 1) : origin - 1;
  if (b > lastT + 1e-6) {
    changes.push({ at: b, f });
    changes.sort((x, y) => x.at - y.at);
    return;
  }
  withdraw(b);
  next = stepAt(b);
  f();
}

function withdraw(b: number, tags?: TTag[]) {
  const c = ctxOf();
  if (!c) return;
  recent = recent.filter((r) => {
    if (r.start < b - 1e-6 || (tags && !tags.includes(r.tag))) return true;
    r.b.srcs.forEach((s) => {
      try {
        s.stop(0);
      } catch {
        // already stopped
      }
    });
    return false;
  });
}

function tick() {
  const c = ctxOf();
  if (!c || !bus || !st || !playing) return;
  const now = c.currentTime;
  const horizon = now + (coarse ? 0.3 : 0.25);
  recent = recent.filter((r) => r.start > now - 1);
  for (let guard = 0; guard < 256; guard++) {
    const t = stepTime(next);
    if (t > horizon) break;
    // after a stall, skip to the first future step; never burst to catch up
    if (t < now - 0.05) {
      next = stepAt(now);
      continue;
    }
    while (changes.length && changes[0].at <= t + 1e-6) changes.shift()?.f();
    st.transpose = transposeAt(t);
    scheduleStep(c, bus, st, next, Math.max(t, now + 0.003), rnd, (b, tag) => recent.push({ start: b.t, b, tag }));
    next++;
  }
  const idle = performance.now() - lastPoke;
  if (idle > 90000 && !drifted) {
    drifted = true;
    gainTo(bus.drift, db(-4), now, 4 / 3);
  }
  if (idle > 180000) st.thin = true;
}

function startTimer() {
  clearInterval(timer);
  timer = window.setInterval(tick, 25);
}
// #endregion

// #region Clock
const heard = (q: number) => {
  const c = ctxOf();
  return c ? heardAt(c, q) : performance.now();
};
const wait = (ms: number) =>
  new Promise<void>((r) => {
    const done = () => {
      clearTimeout(id);
      waits.delete(done);
      r();
    };
    const id = setTimeout(done, Math.max(0, ms));
    waits.add(done);
  });
const waitHeard = (q: number) => wait(heard(q) - performance.now());

function clock(flowId: string): IClock {
  const beat = 60 / themeOf(flowId).bpm;
  let cur: number | undefined;
  const on = () => playing && !!ctxOf() && !reducedMotion();
  return {
    get at() {
      return on() ? cur : undefined;
    },
    start() {
      const c = ctxOf();
      if (!on() || !c) {
        cur = undefined;
        return Promise.resolve();
      }
      cur = runBeat >= c.currentTime + 0.003 ? runBeat : grid(1);
      return cur === undefined ? Promise.resolve() : waitHeard(cur);
    },
    skip(b) {
      if (cur !== undefined) cur += b * beat;
    },
    advance(b) {
      const c = ctxOf();
      if (!on() || !c) {
        cur = undefined;
        return wait(reducedMotion() && b < 1 ? 0 : b * beat * 1000);
      }
      cur = cur === undefined ? grid(0.5) : cur + b * beat;
      if (cur !== undefined && cur < c.currentTime - 0.02) cur = grid(0.5);
      return cur === undefined ? wait(b * beat * 1000) : waitHeard(cur);
    },
    resync() {
      cur = on() ? grid(0.5) : undefined;
    },
  };
}
// #endregion

// #region Stinger arbiter
const SPRI: Record<TStinger, number> = { clearance: 7, rankUp: 6, missionBig: 5, chaosComplete: 4, complete: 3, mission: 2, yes: 1, no: 1 };
const EIGHTH = new Set<TStinger>(['yes', 'no', 'mission']);
let queued: { id: TStinger; land: number; timer: number } | undefined;
let sounding: { id: TStinger; end: number } | undefined;

function stinger(id: TStinger): number | undefined {
  const c = audio.ctx;
  if (!c || !audio.bus) return undefined;
  const now = c.currentTime;
  const land = grid(EIGHTH.has(id) ? 0.5 : 1, 0.06) ?? now + 0.003;
  if (queued) {
    if (SPRI[id] > SPRI[queued.id]) queued.id = id;
    queued.land = Math.max(queued.land, land);
    arm(queued);
    return queued.land;
  }
  let at = land;
  if (sounding && sounding.end > now) {
    if (SPRI[id] <= SPRI[sounding.id]) return undefined;
    at = Math.max(land, sounding.end);
  }
  queued = { id, land: at, timer: 0 };
  arm(queued);
  return at;
}

function arm(q: { id: TStinger; land: number; timer: number }) {
  const c = audio.ctx;
  clearTimeout(q.timer);
  const ms = c ? (q.land - 0.05 - c.currentTime) * 1000 : 0;
  if (ms <= 0) commit();
  else q.timer = window.setTimeout(commit, ms);
}

function commit() {
  const q = queued;
  queued = undefined;
  const c = audio.ctx;
  const b = audio.bus;
  if (!q || !c || !b) return;
  const land = Math.max(q.land, c.currentTime + 0.003);
  const full = q.id === 'complete' ? fresh.complete : q.id === 'chaosComplete' ? fresh.chaos : true;
  if (q.id === 'complete') fresh.complete = false;
  if (q.id === 'chaosComplete') fresh.chaos = false;
  const short = (q.id === 'complete' || q.id === 'chaosComplete') && !full;
  const h = harmonyAt(land);
  const s = stingOf(q.id, full, short ? shortN++ : 0, h.r, h.scale);
  const res = renderSting(c, b, s, land, playing ? spb() : 60 / theme().bpm, h, rnd);
  sounding = { id: q.id, end: res.end };
  later(c, land, () => debugEvent(`stinger:${q.id}`, land, res.notes));
  if (playing && st) {
    duck('stinger', -6, res.end - land, 0.4, land);
    if (s.swell) st.pad?.swell(land, res.end - land, q.id === 'clearance' ? 4 : 2.5);
    if (q.id === 'no' && st.pad) {
      const r = h.r;
      const sc = h.scale;
      st.pad.glide([r + sc[3], r + sc[5], r + 12, r + 12 + sc[2], r + 12 + sc[3]], land, st.chaos);
      st.pad.glide(harmonyAt(land).chord, land + spb() / 2, st.chaos);
    }
  }
  if (q.id === 'clearance') transposeBy(2, res.end);
}
// #endregion

// #region Public
function grid(division: number, minAhead = 0.03) {
  const c = ctxOf();
  if (!playing || !c) return undefined;
  const g = spb() * division;
  const n = Math.ceil((c.currentTime + minAhead - origin) / g - 1e-9);
  return origin + n * g;
}

function harmonyAt(t: number): IHarmony {
  const th0 = playing ? th : theme();
  const tr = transposeAt(t);
  if (!playing) return harmonyOf(th0, 0, tr, false);
  const dec = t >= decWin[0] - 1e-6 && t < decWin[1] - 1e-6;
  return harmonyOf(th0, barOf(t), tr, dec);
}

function transposeBy(semis: number, after?: number) {
  const c = ctxOf();
  const now = c?.currentTime ?? 0;
  const from = Math.max(after ?? now, now);
  const at = playing ? origin + Math.ceil((from - origin) / barLen() - 1e-6) * barLen() : from;
  trs.push({ at, v: transposeAt(Infinity) + semis });
}

function duck(src: 'stinger' | 'crash', dB: number, hold: number, release: number, at?: number) {
  const c = ctxOf();
  if (!c || !bus || !playing) return;
  const g = src === 'stinger' ? bus.duckStinger : bus.duckCrash;
  const now = c.currentTime;
  const t = Math.max(at ?? now, now);
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(db(dB), t + 0.02);
  g.gain.setTargetAtTime(1, t + 0.02 + Math.max(hold, 0), Math.max(release, 0.01) / 3);
}

function start(themeId: string, o: { at?: number; fadeIn?: number } = {}) {
  const b = audio.bus;
  if (!audio.musicOn || !b) {
    if (!kept || kept.id !== themeId) kept = { id: themeId };
    return;
  }
  const c = b.c;
  const now = c.currentTime;
  if (playing) {
    if (o.at !== undefined && themeId === th.id && st?.state === 'idle') {
      const at = Math.max(o.at, now + 0.003);
      withdraw(at);
      origin = at;
      next = 0;
    }
    return;
  }
  bus = b;
  th = themeOf(themeId);
  const keep = kept && kept.id === themeId && kept.origin !== undefined ? kept : undefined;
  if (keep?.origin !== undefined) {
    origin = keep.origin;
    next = stepAt(now + 0.1);
    st = keep.st ?? newStep(th);
  } else {
    origin = Math.max(o.at ?? now + 0.05, now + 0.003);
    next = 0;
    st = newStep(th);
    st.chaos = layers.chaos;
    st.traffic = layers.traffic;
    lastPoke = performance.now();
    openedAt = now;
  }
  kept = undefined;
  st.theme = th;
  const barT = origin + Math.max(0, Math.ceil((now - origin) / barLen())) * barLen();
  st.pad = makePad(c, b, th, keep ? now + 0.05 : origin, harmonyOf(th, barOf(barT), transposeAt(barT), false).chord);
  playing = true;
  const fade = o.fadeIn ?? 0.8;
  const g = b.musicGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(0.0001, now);
  // the first 10 s after open sit 3 dB lower
  const early = now - openedAt < 10;
  g.setTargetAtTime(early ? db(-3) : 1, now, Math.max(fade, 0.05) / 3);
  if (early) g.setTargetAtTime(1, openedAt + 10, 2);
  setTone(toneTarget(st.state), now, 0.05);
  startTimer();
  debugEvent('music:start', origin);
  tick();
}

function halt(fade: number) {
  const c = ctxOf();
  clearInterval(timer);
  playing = false;
  if (!c || !bus) return;
  const now = c.currentTime;
  const g = bus.musicGain.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.setTargetAtTime(0, now, Math.max(fade / 3, 0.005));
  st?.pad?.stop(now + fade + 0.3);
  st?.dec?.kill(now, 0.005);
  if (st) {
    st.pad = undefined;
    st.dec = undefined;
  }
  withdraw(now + 0.01);
  changes = [];
}

export const music = guarded({
  start,
  stop(fade: number) {
    waits.forEach((f) => f());
    if (playing) {
      halt(fade);
      debugEvent('music:stop');
    }
    st = undefined;
    kept = undefined;
    inspecting = false;
    decWin = [Infinity, Infinity];
    runActive = false;
    runBeat = -1;
  },
  pause(tc: number) {
    if (!playing) return;
    kept = { id: th.id, origin, st };
    halt(tc * 3);
    debugEvent('music:pause');
  },
  resumeOrStart(themeId: string) {
    if (!playing) start(themeId, { fadeIn: 0.8 });
  },
  clock,
  runStart() {
    runActive = true;
    const c = ctxOf();
    if (!playing || !c || !st) return;
    const b = grid(1);
    if (b === undefined) return;
    runBeat = b;
    st.fillBar = -1;
    changes = changes.filter((x) => x.at < b - 1e-6);
    if (st.state !== 'idle') return;
    // bar 1 of the progression lands on the run's first beat
    withdraw(b);
    origin = b;
    next = 0;
    st.state = 'running';
    setTone(toneTarget('running'), b, 0.05);
    later(c, b, () => debugEvent('music:state:running', b));
  },
  decide(on: boolean) {
    const c = ctxOf();
    if (!c || !playing || !st || !bus) {
      decWin = on ? [0, Infinity] : [Infinity, Infinity];
      return;
    }
    const s = st;
    const b = bus;
    if (on) {
      const at = grid(1) ?? c.currentTime;
      decWin = [at, Infinity];
      atTime(at, () => {
        s.state = 'decision';
        s.decBar = barOf(at);
        s.dec?.kill(at, 0.01);
        s.dec = makeDecision(c, b, at, spb(), harmonyAt(at));
        s.pad?.glide(harmonyAt(at).chord, at, s.chaos);
      });
      withdraw(at, ['drum', 'arp', 'bass']);
      b.tone.frequency.cancelScheduledValues(at);
      b.tone.frequency.setValueAtTime(3200, at);
      b.tone.frequency.exponentialRampToValueAtTime(900, at + 0.4);
      gainTo(b.duckDecision, db(-3), at, 0.02);
      later(c, at, () => debugEvent('music:state:decision', at));
      return;
    }
    if (decWin[1] !== Infinity) return;
    const at = grid(0.5) ?? c.currentTime;
    decWin = [decWin[0], at];
    const dec = s.dec;
    s.dec = undefined;
    dec?.kill(at, at - decWin[0] > 4 * barLen() ? 0.01 : 0.004);
    atTime(at, () => {
      s.state = runActive ? 'running' : 'idle';
      s.pad?.glide(harmonyAt(at).chord, at, s.chaos);
    });
    setTone(toneTarget(runActive ? 'running' : 'idle'), at, 0.05);
    gainTo(b.duckDecision, 1, at, 0.05);
    later(c, at, () => debugEvent('music:state:running', at));
  },
  completeRun(chaos: boolean) {
    runActive = false;
    stinger(chaos ? 'chaosComplete' : 'complete');
    const c = ctxOf();
    if (!c || !playing || !st) return;
    const s = st;
    // stopping the groove mid phrase sounds like a fault, so it holds and exits on a phrase line
    const exit = Math.ceil((barOf(c.currentTime) + 9) / 4) * 4;
    s.fillBar = exit - 1;
    const at = origin + exit * barLen();
    changes.push({
      at,
      f: () => {
        if (s.state !== 'running' || runActive) return;
        s.state = 'idle';
        s.fillBar = -1;
        setTone(toneTarget('idle'), at, 0.3);
        debugEvent('music:state:idle', at);
      },
    });
    changes.sort((x, y) => x.at - y.at);
  },
  endRun() {
    const was = runActive;
    runActive = false;
    runBeat = -1;
    const c = ctxOf();
    if (!c || !playing || !st || !bus) {
      decWin = [Infinity, Infinity];
      return was;
    }
    const now = c.currentTime;
    const s = st;
    if (decWin[0] !== Infinity && decWin[1] === Infinity) {
      s.dec?.kill(now, 0.005);
      s.dec = undefined;
      withdraw(now, ['hb']);
      decWin = [decWin[0], now];
      gainTo(bus.duckDecision, 1, now, 0.02);
    }
    changes = changes.filter((x) => x.at <= now);
    if (s.state !== 'idle') {
      const at = grid(1) ?? now;
      s.fillBar = -1;
      atTime(at, () => {
        s.state = 'idle';
      });
      setTone(toneTarget('idle'), at, 0.1);
      later(c, at, () => debugEvent('music:state:idle', at));
    }
    return was;
  },
  setLayer(l: 'chaos' | 'traffic', on: boolean) {
    if (layers[l] === on) return;
    layers = { ...layers, [l]: on };
    debugEvent(`music:layer:${l}:${on ? 'on' : 'off'}`);
    const c = ctxOf();
    if (!c || !playing || !st) return;
    const s = st;
    const at = (l === 'chaos' ? grid(4) : grid(1)) ?? c.currentTime;
    atTime(at, () => {
      if (l === 'traffic') {
        s.traffic = on;
        if (s.state === 'running') setTone(toneTarget('running'), at, 0.1);
      } else {
        s.chaos = on;
        if (on) s.burstUntil = Math.max(s.burstUntil, barOf(at) + 2);
      }
    });
  },
  stinger,
  duck,
  grid,
  chordAt: (t?: number) => harmonyAt(t ?? ctxOf()?.currentTime ?? 0).chord,
  harmonyAt: (t: number) => harmonyAt(t),
  transpose: (semis: number) => transposeBy(semis),
  poke() {
    lastPoke = performance.now();
    if (st) st.thin = false;
    if (drifted && bus) {
      drifted = false;
      gainTo(bus.drift, 1, bus.c.currentTime, 1.5);
    }
  },
  // muffling the bed puts the inspector text in front; a gain duck would pump
  inspector(on: boolean) {
    inspecting = on;
    const c = ctxOf();
    if (!c || !playing || !st) return;
    setTone(toneTarget(st.state), c.currentTime, 0.1);
  },
  onCrash() {
    const c = ctxOf();
    if (!c || !playing || !st) return;
    st.burstUntil = Math.max(st.burstUntil, barOf(c.currentTime) + 3);
  },
  resetSession() {
    fresh = { complete: true, chaos: true };
    shortN = 0;
    trs = [];
    layers = { chaos: false, traffic: false };
    inspecting = false;
    lastPoke = performance.now();
    drifted = false;
    openedAt = -1e9;
    sounding = undefined;
    if (queued) clearTimeout(queued.timer);
    queued = undefined;
  },
  pauseTimer() {
    clearInterval(timer);
  },
  resumeTimer() {
    if (playing) startTimer();
  },
  get playing() {
    return playing;
  },
}, {
  clock: () => ({ at: undefined, start: () => Promise.resolve(), skip: () => undefined, advance: (b: number) => wait(b * spb() * 1000), resync: () => undefined }),
  endRun: () => false,
  chordAt: () => [...theme().chords[0]],
  harmonyAt: () => harmonyOf(theme(), 0, 0, false),
});
// #endregion
