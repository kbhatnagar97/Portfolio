import type { TFlowKind } from '../data';
import type { TItem } from '../flow';
import type { TLayout } from './geometry';

// #region Constants
export const H = 1 / 120;
export const G = 1200;
const DAMP = 0.999;
const VCAP = 1400 * H;
const FRICTION = 0.85;
const E_ITEM = 0.4;
const E_PART = 0.35;
const E_BOT = 0.2;
const BREAK_HIT = 560;
const BREAK_BUMP = 420;
const ITEM_KNOCK = 300;
// #endregion

// #region Types
// One shape for every physics body, so the hot loops stay monomorphic and never box their numbers.
export type TBody = {
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  a: number;
  spin: number;
  still: number;
  nw: boolean;
  hx: number;
  hy: number;
  ha: number;
  dl: number;
  life: number;
  st: 'off' | 'free' | 'held' | 'flight';
  kind: TItem;
  n: number;
  holder: number;
  score: number;
  dashed: boolean;
  copy: boolean;
  alpha: number;
  squash: number;
  tx: number;
  ty: number;
  T: number;
  ft: number;
  aim: number;
  prop: number;
  hatch: number;
  thrower: number;
  tag: number;
  age: number;
  fling: boolean;
};
export type TDisc = TBody;
export type TPart = TBody;
export type TThing = TBody;
export type TStrip = TBody;
export type TRole = 'clock' | 'scout' | 'thinker' | 'bouncer' | 'courier' | 'human' | 'bench';
export type TPose = 'idle' | 'reach' | 'hold' | 'think' | 'carry' | 'cross' | 'sit';
export type TLed = 'idle' | 'work' | 'wait' | 'alarm' | 'sleep';
export type TBot = {
  role: TRole;
  kind: TFlowKind;
  st: number;
  s: number;
  f: number;
  homeF: number;
  homeX: number;
  x: number;
  tx: number;
  vmax: number;
  dir: 1 | -1;
  mode: 'kin' | 'rag' | 'broken' | 'mend';
  p: TDisc[];
  parts: TPart[];
  slow: number;
  mt: number;
  crash: boolean;
  bump: boolean;
  dizzy: number;
  pose: TPose;
  hx: number;
  hy: number;
  rx: number;
  ry: number;
  lean: number;
  leanT: number;
  tilt: number;
  hop: number;
  hopH: number;
  kick: number;
  shake: number;
  lookX: number;
  lookY: number;
  pupil: number;
  blinkIn: number;
  blinkT: number;
  led: TLed;
  flash: number;
  halo: number;
  ring: number;
  roll: number;
  away: boolean;
  asleep: boolean;
  clip: number;
  pokes: number[];
  pokeI: number;
  held: number;
  seat: number;
  gate: number;
  glow: number;
};
export type TPuff = { x: number; y: number; r: number; t: number; life: number };
export type TSpark = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string };
export type TRing = { x: number; y: number; r0: number; r1: number; t: number; life: number; c: string };
export type TGlyph = { x: number; y: number; vy: number; t: number; life: number; text: string; c: string };
export type TWorld = {
  L: TLayout;
  bots: TBot[];
  items: TThing[];
  strips: TStrip[];
  puffs: TPuff[];
  sparks: TSpark[];
  rings: TRing[];
  glyphs: TGlyph[];
  gk: 0 | 1 | 2;
  gi: number;
  gp: number;
  gx: number;
  gy: number;
};
// #endregion

// #region Factories
// -0 seeds (not a small integer) keep the float fields unboxed doubles from the first write
export const body = (r: number): TBody => ({
  x: -0, y: -0, px: -0, py: -0, r, a: -0, spin: -0, still: -0, nw: false, hx: -0, hy: -0, ha: -0, dl: -0, life: -0,
  st: 'off', kind: 'crate', n: 1, holder: -1, score: 0, dashed: false, copy: false, alpha: 1, squash: -0,
  tx: -0, ty: -0, T: -0, ft: -0, aim: -1, prop: -1, hatch: NaN, thrower: -1, tag: 0, age: -0, fling: false,
});
export const disc = body;
export const thing = () => body(6);
export const pool = <T>(n: number, make: () => T) => Array.from({ length: n }, make);
// Oldest first when the pool is full, so effects never allocate.
export const take = <T extends { t: number; life: number }>(list: T[]) => {
  let best = list[0];
  for (const e of list) {
    if (e.t >= e.life) return e;
    if (e.t / e.life > best.t / best.life) best = e;
  }
  return best;
};
export const speed = (d: TDisc) => Math.hypot(d.x - d.px, d.y - d.py) / H;
export const setVel = (d: TDisc, vx: number, vy: number) => {
  d.px = d.x - vx * H;
  d.py = d.y - vy * H;
  d.still = 0;
};
export const place = (d: TDisc, x: number, y: number) => {
  d.x = d.px = x;
  d.y = d.py = y;
};
export const launch = (d: TDisc, tx: number, ty: number, T: number) => setVel(d, (tx - d.x) / T, (ty - d.y - 0.5 * G * T * T) / T);
// #endregion

// #region Integration
const integrate = (d: TDisc, g: number, damp: number) => {
  let vx = (d.x - d.px) * damp;
  let vy = (d.y - d.py) * damp + g * H * H;
  const v2 = vx * vx + vy * vy;
  if (v2 > VCAP * VCAP) {
    const k = VCAP / Math.sqrt(v2);
    vx *= k;
    vy *= k;
  }
  d.px = d.x;
  d.py = d.y;
  d.x += vx;
  d.y += vy;
  d.a += d.spin * H;
  d.spin *= 0.98;
};

// One-way floors and side walls; returns the normal impact speed.
const bounds = (L: TLayout, d: TDisc, e: number, roll: boolean) => {
  let hit = 0;
  if (d.nw) return 0;
  const vx = d.x - d.px;
  const vy = d.y - d.py;
  for (let i = 0; i < L.F; i++) {
    const f = L.floors[i];
    if (vy >= 0 && d.y + d.r > f.y && d.py + d.r <= f.y + 1 && (d.x < f.g0 || d.x > f.g1)) {
      d.y = f.y - d.r;
      d.py = d.y + vy * e;
      d.px = d.x - vx * FRICTION;
      if (roll) d.spin += ((vx * FRICTION) / H / d.r - d.spin) * 0.6;
      hit = vy / H;
      if (vy / H < 5 && Math.abs(vx) / H < 5) d.still += H;
      else d.still = 0;
    }
  }
  if (d.x - d.r < 0 || d.x + d.r > L.W) {
    d.x = d.x - d.r < 0 ? d.r : L.W - d.r;
    d.px = d.x + vx * e;
    hit = Math.max(hit, Math.abs(vx) / H);
  }
  return hit;
};

const link = (a: TDisc, b: TDisc, len: number, k: number, rope: boolean) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  if (rope && d <= len) return;
  const o = ((d - len) / d) * 0.5 * k;
  a.x += dx * o;
  a.y += dy * o;
  b.x -= dx * o;
  b.y -= dy * o;
};

const sep = (a: TDisc, ra: number, wa: number, b: TDisc, rb: number, wb: number) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const R = ra + rb;
  if (d2 >= R * R || d2 < 1e-6 || wa + wb === 0) return -1;
  const d = Math.sqrt(d2);
  const o = (R - d) / d / (wa + wb);
  const rel = ((b.x - b.px - (a.x - a.px)) * dx + (b.y - b.py - (a.y - a.py)) * dy) / d / H;
  a.x -= dx * o * wa;
  a.y -= dy * o * wa;
  b.x += dx * o * wb;
  b.y += dy * o * wb;
  if (o * (wa + wb) * d > 20 * H) a.still = b.still = 0;
  return Math.abs(rel);
};
// #endregion

// #region Step
const stepBot = (w: TWorld, b: TBot, bi: number) => {
  const base = b.p[0];
  const chest = b.p[1];
  const head = b.p[2];
  const hand = b.p[3];
  const tip = b.p[4];
  const s = b.s;
  if (b.mode === 'kin') {
    // the antenna always wobbles, pinned to the head
    const dx = head.x - chest.x;
    const dy = head.y - chest.y;
    const d = Math.hypot(dx, dy) || 1;
    const tx = head.x + (dx / d) * 13 * s;
    const ty = head.y + (dy / d) * 13 * s;
    const vx = (tip.x - tip.px) * 0.9;
    const vy = (tip.y - tip.py) * 0.9;
    tip.px = tip.x;
    tip.py = tip.y;
    tip.x += vx + (tx - tip.x) * 0.2;
    tip.y += vy + (ty - tip.y) * 0.2;
    return;
  }
  if (b.mode === 'rag') {
    for (let k = 0; k < 5; k++) integrate(b.p[k], G, DAMP);
    if (w.gk === 1 && w.gi === bi) {
      const q = b.p[w.gp];
      q.x += (w.gx - q.x) * 0.6;
      q.y += (w.gy - q.y) * 0.6;
    } else if (b.dizzy <= 0 && b.mt > 0.15) {
      // gentle upright spring so a landed bot sits up instead of lying still
      chest.x += (base.x - chest.x) * 0.02;
      head.x += (base.x - head.x) * 0.03;
    }
    for (let k = 0; k < 3; k++) {
      link(base, chest, 8.5 * s, 1, false);
      link(chest, head, 13.5 * s, 1, false);
      link(base, head, 22 * s, 1, false);
      link(chest, hand, 9 * s, 1, true);
      link(head, tip, 13 * s, 0.4, false);
    }
    let hit = 0;
    for (let k = 0; k < 5; k++) {
      const q = b.p[k];
      const r = q.r;
      q.r = r * s;
      const v = bounds(w.L, q, E_BOT, false);
      q.r = r;
      if (k < 3) hit = Math.max(hit, v);
    }
    if (hit > BREAK_HIT) b.crash = true;
    return;
  }
  for (let k = 0; k < 6; k++) {
    const q = b.parts[k];
    if (b.mode === 'mend') {
      if (b.mt < q.dl) continue;
      const vx = (q.x - q.px) / H;
      const vy = (q.y - q.py) / H;
      const ax = 180 * (q.hx - q.x) - 18 * vx;
      const ay = 180 * (q.hy - q.y) - 18 * vy;
      q.px = q.x;
      q.py = q.y;
      q.x += (vx + ax * H) * H;
      q.y += (vy + ay * H) * H;
      q.a += (q.ha - q.a) * 0.06;
    } else {
      integrate(q, G, DAMP);
      bounds(w.L, q, E_PART, true);
    }
  }
};

const knock = (b: TBot) => {
  if (b.mode === 'kin' && b.role !== 'human' && !b.asleep) b.bump = true;
};

export const step = (w: TWorld) => {
  const { L, bots, items, strips } = w;
  for (let i = 0; i < bots.length; i++) {
    bots[i].mt += H;
    stepBot(w, bots[i], i);
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.st !== 'free' && it.st !== 'flight') continue;
    it.age += H;
    if (it.st === 'free' && it.still > 0.3 && !(w.gk === 2 && items[w.gi] === it)) continue;
    integrate(it, G, DAMP);
    if (w.gk === 2 && items[w.gi] === it) {
      it.x += (w.gx - it.x) * 0.6;
      it.y += (w.gy - it.y) * 0.6;
    }
    if (it.st === 'flight') home(w, it);
    const r = it.r;
    it.r = r + it.n - 1;
    bounds(L, it, E_ITEM, true);
    it.r = r;
  }
  for (let i = 0; i < strips.length; i++) {
    const d = strips[i];
    if (d.life <= 0) continue;
    integrate(d, G * 0.3, 0.985);
    bounds(L, d, E_PART, false);
  }
  collide(w);
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    if (b.mode === 'broken') for (let k = 0; k < 6; k++) guard(L, b.parts[k], b.parts[k].r);
    else if (b.mode === 'rag') for (let k = 0; k < 5; k++) guard(L, b.p[k], b.p[k].r * b.s);
  }
  for (let i = 0; i < items.length; i++) if (items[i].st === 'free') guard(L, items[i], items[i].r + items[i].n - 1);
};

// A push can shove a body resting on a one-way floor under its line, where the next substep would let it fall through.
const guard = (L: TLayout, d: TDisc, r: number) => {
  if (d.nw) return;
  for (let i = 0; i < L.F; i++) {
    const f = L.floors[i];
    if (d.py + r <= f.y + 1 && d.y + r > f.y && (d.x < f.g0 || d.x > f.g1)) d.y = f.y - r;
  }
  if (d.x < r) d.x = r;
  else if (d.x > L.W - r) d.x = L.W - r;
};

// Steers the last quarter of a throw onto the moving catcher; a hatch hop re-aims below the floor.
const home = (w: TWorld, it: TThing) => {
  it.ft += H;
  if (it.aim >= 0) {
    const hand = w.bots[it.aim].p[3];
    if (it.hatch !== it.hatch || it.y > it.hatch) {
      it.tx = hand.x;
      it.ty = hand.y - 5;
    }
  }
  if (it.hatch === it.hatch && it.y > it.hatch) {
    it.hatch = NaN;
    const T = Math.min(0.6, 0.25 + Math.hypot(it.tx - it.x, it.ty - it.y) / 600);
    it.T = it.ft + T;
    launch(it, it.tx, it.ty, T);
    return;
  }
  const rem = it.T - it.ft;
  if (it.ft < it.T * 0.75 || rem < -0.3) return;
  const t = Math.max(rem, 2 * H);
  const vx = (it.x - it.px) / H;
  const vy = (it.y - it.py) / H;
  const dx = (it.tx - it.x) / t;
  const dy = (it.ty - it.y - 0.5 * G * t * t) / t;
  it.px = it.x - (vx + (dx - vx) * 0.15) * H;
  it.py = it.y - (vy + (dy - vy) * 0.15) * H;
};

const collide = (w: TWorld) => {
  const { bots, items } = w;
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    // kicked items tumble out of the world untouched
    if (a.st !== 'free' || a.nw) continue;
    const ra = a.r + a.n - 1;
    for (let j = i + 1; j < items.length; j++) {
      const c = items[j];
      if (c.st === 'free') sep(a, ra, 1, c, c.r + c.n - 1, 1);
    }
    for (let j = 0; j < bots.length; j++) {
      const b = bots[j];
      if (b.role === 'human' || b.away) continue;
      if (b.mode === 'broken') {
        for (let k = 0; k < 6; k++) sep(a, ra, 0.25, b.parts[k], b.parts[k].r, 1);
        continue;
      }
      if (b.mode === 'mend') continue;
      const wb = b.mode === 'rag' ? 0.5 : 0;
      for (let k = 1; k < 3; k++) {
        const v = sep(a, ra, 1, b.p[k], (k === 1 ? 8 : 6.5) * b.s, wb);
        // only a visitor's fling knocks a bot over; the crew's own traffic never does
        if (v > ITEM_KNOCK && a.fling) knock(b);
      }
    }
  }
  for (let i = 0; i < bots.length; i++) {
    const a = bots[i];
    if (a.mode === 'broken') {
      for (let j = 0; j < bots.length; j++) {
        const b = bots[j];
        if (b.mode !== 'kin' || b.role === 'human' || b.away || j === i) continue;
        // debris clears the whole drawn body, so a head never comes to rest inside a neighbour
        for (let k = 0; k < 6; k++) {
          const q = a.parts[k];
          sep(b.p[1], 10 * b.s, 0, q, q.r + 1.5, 1);
          sep(b.p[2], 7 * b.s, 0, q, q.r + 1.5, 1);
        }
      }
      continue;
    }
    if (a.mode !== 'rag') continue;
    for (let j = 0; j < bots.length; j++) {
      const b = bots[j];
      if (j === i || b.role === 'human' || b.away || (b.mode !== 'kin' && b.mode !== 'rag') || (b.mode === 'rag' && j < i)) continue;
      for (let k = 1; k < 3; k++) {
        for (let m = 1; m < 3; m++) {
          const v = sep(a.p[k], 7 * a.s, 1, b.p[m], 7 * b.s, b.mode === 'rag' ? 1 : 0);
          if (v < 0) continue;
          if (v > BREAK_BUMP) a.crash = b.crash = true;
          else if (v > 150) knock(b);
        }
      }
    }
  }
};
// #endregion
