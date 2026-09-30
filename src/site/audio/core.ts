// Leaf module: buses, voice pool, debug counter and helpers. It imports nothing that imports it back.
import { hop } from './themes';

export const db = (v: number) => 10 ** (v / 20);
export const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

// #region Bus
export interface IBus {
  c: BaseAudioContext;
  noise: AudioBuffer;
  sfxIn: GainNode;
  sendIn: GainNode;
  delay: DelayNode;
  pump: GainNode;
  tone: BiquadFilterNode;
  musicMix: GainNode;
  duckStinger: GainNode;
  duckCrash: GainNode;
  duckDecision: GainNode;
  drift: GainNode;
  musicGain: GainNode;
  master: GainNode;
}

const biquad = (c: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7, g = 0) => {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = g;
  return b;
};
const gainNode = (c: BaseAudioContext, v = 1) => {
  const g = c.createGain();
  g.gain.value = v;
  return g;
};
const comp = (c: BaseAudioContext, th: number, knee: number, ratio: number, a: number, r: number) => {
  const k = c.createDynamicsCompressor();
  k.threshold.value = th;
  k.knee.value = knee;
  k.ratio.value = ratio;
  k.attack.value = a;
  k.release.value = r;
  return k;
};

// measured offline in Chromium: minus the automatic makeup gain of each compressor
export const LIMIT_MAKEUP = -1.7;
export const GLUE_MAKEUP = -5.1;

// raw skips the glue and the limiter, for the offline headroom check
export function buildBus(c: BaseAudioContext, o: { raw?: boolean } = {}): IBus {
  const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const ch = noise.getChannelData(0);
  let s = 0x9e3779b9;
  for (let i = 0; i < ch.length; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    ch[i] = (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  const master = gainNode(c, 1);
  const limiter = o.raw ? gainNode(c) : comp(c, -3, 0, 20, 0.001, 0.1);
  // the compressor node adds its own makeup gain; this trim keeps it at unity below threshold
  master.connect(limiter).connect(gainNode(c, o.raw ? 1 : db(LIMIT_MAKEUP))).connect(c.destination);

  const sfxIn = gainNode(c);
  sfxIn.connect(biquad(c, 'highpass', 200)).connect(biquad(c, 'highshelf', 6000, 0.7, -3)).connect(master);

  const sendIn = gainNode(c);
  const delay = c.createDelay(2);
  const fb = gainNode(c, 0.22);
  const wet = gainNode(c, db(-12));
  sendIn.connect(delay);
  delay.connect(biquad(c, 'lowpass', 3000)).connect(fb).connect(delay);
  delay.connect(wet).connect(master);

  // bed trim that keeps summed music peaks under -14 dBFS
  const musicMix = gainNode(c, db(-2.2));
  const tone = biquad(c, 'lowpass', 2600, 0.5);
  const pump = gainNode(c);
  pump.connect(tone).connect(musicMix);
  const glue = o.raw ? gainNode(c) : comp(c, -18, 8, 2.5, 0.01, 0.2);
  const duckStinger = gainNode(c);
  const duckCrash = gainNode(c);
  const duckDecision = gainNode(c);
  const drift = gainNode(c);
  const musicGain = gainNode(c, 0);
  musicMix
    .connect(biquad(c, 'highshelf', 3000, 0.7, -6))
    .connect(biquad(c, 'peaking', 2200, 1, -4))
    .connect(glue)
    .connect(gainNode(c, o.raw ? 1 : db(GLUE_MAKEUP)))
    .connect(duckStinger)
    .connect(duckCrash)
    .connect(duckDecision)
    .connect(drift)
    .connect(musicGain)
    .connect(master);

  return { c, noise, sfxIn, sendIn, delay, pump, tone, musicMix, duckStinger, duckCrash, duckDecision, drift, musicGain, master };
}

// theme dependent values, correct even on a reused context
export function applyTheme(bus: IBus, id: string) {
  const t = bus.c.currentTime;
  bus.delay.delayTime.setValueAtTime(0.75 * hop(id).spb, t);
  bus.pump.gain.cancelScheduledValues(t);
  bus.pump.gain.setValueAtTime(1, t);
  bus.tone.frequency.cancelScheduledValues(t);
  bus.tone.frequency.setValueAtTime(2600, t);
}
// #endregion

// #region Voice pool and loop registry
export interface IVoice {
  id: string;
  pri: number;
  start: number;
  end: number;
  kill: GainNode;
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  cancelled?: boolean;
}

const safeStop = (s: AudioScheduledSourceNode, t: number) => {
  try {
    s.stop(t);
  } catch {
    // already stopped
  }
};

// WebKit keeps finished nodes alive while they are connected
export const reap = (srcs: AudioScheduledSourceNode[], nodes: AudioNode[], done?: () => void) => {
  let left = srcs.length;
  srcs.forEach(
    (s) =>
      (s.onended = () => {
        if (--left > 0) return;
        nodes.forEach((n) => n.disconnect());
        done?.();
      }),
  );
};

export const voices = {
  list: [] as IVoice[],
  add(v: IVoice) {
    this.list.push(v);
    reap(v.srcs, [...v.nodes, v.kill], () => {
      const i = this.list.indexOf(v);
      if (i >= 0) this.list.splice(i, 1);
    });
  },
  // voices whose window holds t, so choreographies scheduled ahead do not fill the pool early
  at(t: number) {
    return this.list.filter((v) => !v.cancelled && v.start <= t + 0.001 && v.end > t);
  },
  steal(v: IVoice) {
    const t = v.kill.context.currentTime;
    v.cancelled = true;
    v.kill.gain.cancelScheduledValues(t);
    v.kill.gain.setValueAtTime(v.kill.gain.value, t);
    v.kill.gain.linearRampToValueAtTime(0, t + 0.005);
    v.srcs.forEach((s) => safeStop(s, t + 0.03));
  },
  cancel(v: IVoice) {
    const t = v.kill.context.currentTime;
    if (v.start > t) {
      v.cancelled = true;
      v.srcs.forEach((s) => safeStop(s, t));
    } else this.steal(v);
  },
  killAll() {
    this.list.slice().forEach((v) => this.steal(v));
    this.list = [];
  },
};

export const loops = {
  set: new Set<{ stop(): void }>(),
  killAll() {
    this.set.forEach((l) => l.stop());
    this.set.clear();
  },
};
// #endregion

// #region Debug counter
interface IDebug {
  played: Record<string, number>;
  events: { id: string; audioT?: number; perfT: number; notes?: number[]; heard?: number }[];
  constructed: number;
  closed: number;
  state: () => 'none' | AudioContextState;
  mode: () => string;
  theme: () => string;
  live: () => number;
}
const DEBUG = typeof location !== 'undefined' && (import.meta.env.DEV || /[?&]audiodebug/.test(location.search));
// the engine fills state and mode; this module stays a leaf so import order never matters
export const dbg: IDebug | undefined = DEBUG ? { played: {}, events: [], constructed: 0, closed: 0, state: () => 'none', mode: () => 'all', theme: () => '', live: () => voices.list.length + loops.set.size } : undefined;
if (dbg) (window as unknown as { __labAudio: IDebug }).__labAudio = dbg;

export function debugEvent(id: string, audioT?: number, notes?: number[], heard?: number) {
  if (!dbg) return;
  dbg.played[id] = (dbg.played[id] ?? 0) + 1;
  dbg.events.push({ id, audioT, perfT: performance.now(), notes, heard });
  if (dbg.events.length > 2000) dbg.events.splice(0, 500);
}
// #endregion

// #region Timing helpers
export const seeded = (a: number) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// the performance time at which audio time q leaves the speakers
export function heardAt(c: BaseAudioContext, q: number) {
  if (!(c instanceof AudioContext)) return performance.now();
  const ts = c.getOutputTimestamp?.();
  if (ts && ts.contextTime && ts.performanceTime) return ts.performanceTime + (q - ts.contextTime) * 1000;
  return performance.now() + (q - c.currentTime + Math.min(c.outputLatency || c.baseLatency || 0, 0.1)) * 1000;
}

// runs f when the context clock reaches t
export const later = (c: BaseAudioContext, t: number, f: () => void) => {
  const ms = (t - c.currentTime) * 1000;
  if (ms <= 1) f();
  else setTimeout(f, ms);
};
// #endregion

// Sound must never break the lab: a throwing audio call becomes a no op that returns its fallback
export function guarded<T extends object>(o: T, fallback: Partial<Record<keyof T, () => unknown>> = {}): T {
  (Object.keys(o) as (keyof T)[]).forEach((k) => {
    const d = Object.getOwnPropertyDescriptor(o, k);
    if (!d || typeof d.value !== 'function') return;
    const f = d.value as (...a: unknown[]) => unknown;
    d.value = (...a: unknown[]) => {
      try {
        return f.apply(o, a);
      } catch (e) {
        if (dbg) console.warn('[audio]', e);
        return fallback[k]?.();
      }
    };
    Object.defineProperty(o, k, d);
  });
  return o;
}
