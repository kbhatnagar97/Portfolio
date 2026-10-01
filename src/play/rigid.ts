import type { TTile } from './types';

// #region Constants
export const H = 1 / 120;
export const MAX = 48;
const G = 1500;
const VMAX = 2400;
const WMAX = 30;
const LIVE = 40;
const CAP = 256;
const QN = 64;
const ITER = 8;
const PILE = 20;
const PITER = 3;
const BETA = 0.3;
const SLOP = 0.5;
const PMAX = 4;
// #endregion

// #region Types
export type TSpec = {
  tile: TTile;
  key: string;
  k: number;
  band: boolean;
  hl: number;
  r: number;
  dens: number;
  e: number;
  cw: number;
  ch: number;
  spr: HTMLCanvasElement | null;
  held: HTMLCanvasElement | null;
};
// One shape for every body, so the hot loops stay monomorphic and never box their numbers.
export type TBody = {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  ux: number;
  uy: number;
  r: number;
  hl: number;
  im: number;
  ii: number;
  e: number;
  on: number;
  zz: boolean;
  st: number;
  born: number;
  hop: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sx: number;
  sy: number;
  sa: number;
  sp: TSpec;
};
type TContact = {
  a: TBody;
  b: TBody;
  nx: number;
  ny: number;
  px: number;
  py: number;
  d: number;
  e: number;
  mu: number;
  s: number;
  ma: number;
  ia: number;
  mb: number;
  ib: number;
  kn: number;
  kt: number;
  vb: number;
  pn: number;
  pt: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};
export type TWorld = {
  W: number;
  Ht: number;
  t: number;
  trap: number;
  b: TBody[];
  bot: TBody;
  c: TContact[];
  nc: number;
  g: TBody | null;
  gx: number;
  gy: number;
  px: number;
  py: number;
  qs: TSpec[];
  q: Float64Array;
  qh: number;
  qe: number;
  dz: boolean;
  cap: number;
};
// #endregion

// #region Factories
export const EMPTY: TSpec = { tile: { t: '', k: 'chip', tone: 'text' }, key: '', k: 1, band: false, hl: 0, r: 1, dens: 1, e: 0.25, cw: 0, ch: 0, spr: null, held: null };
// -0 seeds (not a small integer) keep the float fields unboxed doubles from the first write
const body = (): TBody => ({
  x: -0, y: -0, a: -0, vx: -0, vy: -0, w: -0, ux: -0, uy: -0, r: 1.5, hl: -0, im: -0, ii: -0, e: 0.25,
  on: 0, zz: false, st: -0, born: -0, hop: -0, x0: -0, y0: -0, x1: -0, y1: -0, sx: -0, sy: -0, sa: -0, sp: EMPTY,
});
const STATIC = body();
STATIC.e = 0.35;
const contact = (): TContact => ({
  a: STATIC, b: STATIC, nx: -0, ny: -0, px: -0, py: -0, d: -0, e: -0, mu: -0, s: -0,
  ma: -0, ia: -0, mb: -0, ib: -0, kn: -0, kt: -0, vb: -0, pn: -0, pt: -0, ax: -0, ay: -0, bx: -0, by: -0,
});
export const makeWorld = (): TWorld => {
  const bot = body();
  bot.e = 0.2;
  bot.uy = 1;
  return {
    W: 0, Ht: 0, t: 0, trap: -9, b: Array.from({ length: MAX }, body), bot,
    c: Array.from({ length: CAP }, contact), nc: 0, g: null, gx: -0, gy: -0, px: -0, py: -0,
    qs: Array.from({ length: QN }, () => EMPTY), q: new Float64Array(QN * 5), qh: 0, qe: 0, dz: false, cap: 0,
  };
};
// #endregion

// #region Bodies
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const wake = (b: TBody) => {
  b.zz = false;
  b.st = 0;
};

// Wakes whatever rests on or against b, so lifting the bottom of a pile never leaves the top floating.
export const wakeNear = (w: TWorld, b: TBody) => {
  for (let i = 0; i < MAX; i++) {
    const o = w.b[i];
    if (o.on === 1 && o.x0 < b.x1 + 6 && o.x1 > b.x0 - 6 && o.y0 < b.y1 + 6 && o.y1 > b.y0 - 6) wake(o);
  }
};

export const dist = (b: TBody, x: number, y: number) => {
  const dx = x - b.x;
  const dy = y - b.y;
  const t = clamp(dx * b.ux + dy * b.uy, -b.hl, b.hl);
  return Math.hypot(dx - b.ux * t, dy - b.uy * t) - b.r;
};

export const pick = (w: TWorld, x: number, y: number, slop: number) => {
  for (let i = MAX - 1; i >= 0; i--) {
    const b = w.b[i];
    if (b.on === 1 && dist(b, x, y) <= slop) return b;
  }
  return null;
};

const box = (b: TBody) => {
  b.ux = Math.cos(b.a);
  b.uy = Math.sin(b.a);
  const ex = b.hl * Math.abs(b.ux) + b.r;
  const ey = b.hl * Math.abs(b.uy) + b.r;
  b.x0 = b.x - ex;
  b.x1 = b.x + ex;
  b.y0 = b.y - ey;
  b.y1 = b.y + ey;
};

export const foot = (hl: number, r: number) => (2 * hl + 2 * r) * 2 * r;

// A wave that would overfill the floor (w.cap of its area) sends the oldest other wave through it.
const shed = (w: TWorld, sp: TSpec) => {
  const room = w.cap * w.W * (w.Ht - 10) - foot(sp.hl, sp.r);
  for (let n = 0; n < 8; n++) {
    let used = 0;
    let old: TBody | null = null;
    for (let i = 0; i < MAX; i++) {
      const b = w.b[i];
      if (b.on !== 1) continue;
      used += foot(b.hl, b.r);
      const v = b.sp.tile.wave;
      if (b !== w.g && v && v !== sp.tile.wave && (!old || b.born < old.born)) old = b;
    }
    if (used <= room || !old) return;
    const v = old.sp.tile.wave;
    for (let i = 0; i < MAX; i++) {
      const b = w.b[i];
      if (b.on !== 1 || b === w.g || b.sp.tile.wave !== v) continue;
      b.on = 2;
      wake(b);
    }
    w.trap = w.t;
  }
};

export const place = (w: TWorld, sp: TSpec, x: number, y: number, a: number, vx: number, vy: number, wv: number) => {
  if (w.cap && sp.tile.wave) shed(w, sp);
  let live = 0;
  let free = -1;
  let oldL = -1;
  let oldV = -1;
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (!b.on) {
      if (free < 0) free = i;
    } else if (b.on === 2) {
      if (oldL < 0 || b.born < w.b[oldL].born) oldL = i;
    } else {
      live++;
      if (b !== w.g && (oldV < 0 || b.born < w.b[oldV].born)) oldV = i;
    }
  }
  if (live >= LIVE && oldV >= 0) {
    w.b[oldV].on = 2;
    wake(w.b[oldV]);
  }
  const slot = free >= 0 ? free : oldL >= 0 ? oldL : oldV;
  if (slot < 0) return;
  const b = w.b[slot];
  const r = sp.r;
  const hl = sp.hl;
  const L = 2 * hl + 2 * r;
  const m = 0.001 * (4 * hl * r + Math.PI * r * r) * sp.dens;
  b.sp = sp;
  b.r = r;
  b.hl = hl;
  b.im = 1 / m;
  b.ii = 12 / (m * (L * L + 4 * r * r));
  b.e = sp.e;
  b.x = x;
  b.y = y;
  b.a = a;
  b.vx = vx;
  b.vy = vy;
  b.w = wv;
  b.on = 1;
  b.born = w.t;
  b.hop = -9;
  wake(b);
  box(b);
};

export const enqueue = (w: TWorld, sp: TSpec, x: number, y: number, a: number, wv: number, at: number) => {
  const i = w.qe;
  w.qs[i] = sp;
  w.q[i * 5] = x;
  w.q[i * 5 + 1] = y;
  w.q[i * 5 + 2] = a;
  w.q[i * 5 + 3] = wv;
  w.q[i * 5 + 4] = at;
  w.qe = (i + 1) % QN;
  if (w.qe === w.qh) w.qh = (w.qh + 1) % QN;
};

// The floor opens: everything live falls through and recycles below the canvas.
export const trapdoor = (w: TWorld) => {
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (b.on !== 1) continue;
    b.on = 2;
    wake(b);
  }
  w.g = null;
  w.qh = w.qe;
  w.trap = w.t;
};

export const clear = (w: TWorld) => {
  for (let i = 0; i < MAX; i++) w.b[i].on = 0;
  w.g = null;
  w.qh = w.qe;
  w.trap = -9;
};

export const calm = (w: TWorld) => {
  if (w.g || w.qh !== w.qe || w.t - w.trap < 0.8) return false;
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (b.on === 2 || (b.on === 1 && !b.zz)) return false;
  }
  return true;
};

export const fit = (w: TWorld, W: number, Ht: number) => {
  w.W = W;
  w.Ht = Ht;
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (b.on !== 1) continue;
    const ex = b.hl * Math.abs(b.ux) + b.r;
    const ey = b.hl * Math.abs(b.uy) + b.r;
    b.x = W < 2 * ex ? W / 2 : clamp(b.x, ex, W - ex);
    if (b.y > Ht - 10 - ey) b.y = Ht - 10 - ey;
    wake(b);
    box(b);
  }
};

export const nudge = (w: TWorld, x: number, y: number, vx: number, vy: number) => {
  let dx = vx * 0.04;
  let dy = vy * 0.04;
  const m = Math.hypot(dx, dy);
  if (m > 400) {
    dx *= 400 / m;
    dy *= 400 / m;
  }
  let n = 0;
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (b.on !== 1 || b === w.g || dist(b, x, y) > 36) continue;
    b.vx += dx;
    b.vy += dy;
    wake(b);
    n++;
  }
  return n;
};
// #endregion

// #region Narrowphase
let S = 0;
let T = 0;
// Closest points between two segments (Ericson 5.1.9), written to S and T.
const closest = (p1x: number, p1y: number, d1x: number, d1y: number, p2x: number, p2y: number, d2x: number, d2y: number) => {
  const rx = p1x - p2x;
  const ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;
  if (a < 1e-9) {
    S = 0;
    T = e < 1e-9 ? 0 : clamp(f / e, 0, 1);
    return;
  }
  const c = d1x * rx + d1y * ry;
  if (e < 1e-9) {
    T = 0;
    S = clamp(-c / a, 0, 1);
    return;
  }
  const b = d1x * d2x + d1y * d2y;
  const den = a * e - b * b;
  S = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
  T = (b * S + f) / e;
  if (T < 0) {
    T = 0;
    S = clamp(-c / a, 0, 1);
  } else if (T > 1) {
    T = 1;
    S = clamp((b - c) / a, 0, 1);
  }
};

const push = (w: TWorld, A: TBody, B: TBody, nx: number, ny: number, px: number, py: number, d: number, mu: number) => {
  if (w.nc >= CAP) return;
  const c = w.c[w.nc++];
  c.a = A;
  c.b = B;
  c.nx = nx;
  c.ny = ny;
  c.px = px;
  c.py = py;
  c.d = d;
  c.mu = mu;
  c.e = A.e > B.e ? A.e : B.e;
  c.ax = A.x;
  c.ay = A.y;
  c.bx = B.x;
  c.by = B.y;
};

const add = (w: TWorld, A: TBody, B: TBody, pax: number, pay: number, pbx: number, pby: number) => {
  let nx = pbx - pax;
  let ny = pby - pay;
  const R = A.r + B.r;
  const d2 = nx * nx + ny * ny;
  if (d2 >= R * R) return;
  let d = Math.sqrt(d2);
  if (d < 1e-4) {
    nx = -A.uy;
    ny = A.ux;
    if ((B.x - A.x) * nx + (B.y - A.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    d = 0;
  } else {
    nx /= d;
    ny /= d;
  }
  if (A.zz !== B.zz) {
    const o = A.zz ? B : A;
    if (o.vx * o.vx + o.vy * o.vy > (w.dz ? 3600 : 400)) wake(A.zz ? A : B);
  }
  push(w, A, B, nx, ny, pax + nx * A.r, pay + ny * A.r, R - d, 0.45);
};

const end = (w: TWorld, A: TBody, B: TBody, t: number) => {
  const pax = A.x + A.ux * t;
  const pay = A.y + A.uy * t;
  const s = clamp((pax - B.x) * B.ux + (pay - B.y) * B.uy, -B.hl, B.hl);
  add(w, A, B, pax, pay, B.x + B.ux * s, B.y + B.uy * s);
};

const capsules = (w: TWorld, A: TBody, B: TBody) => {
  if (A.hl > 0 && B.hl > 0) {
    const cr = A.ux * B.uy - A.uy * B.ux;
    if (cr < 0.05 && cr > -0.05) {
      // near parallel: two contacts at the clipped overlap ends, so stacks rest flat instead of rocking
      const m = (B.x - A.x) * A.ux + (B.y - A.y) * A.uy;
      const q = B.hl * (B.ux * A.ux + B.uy * A.uy);
      const lo = Math.max(-A.hl, Math.min(m - q, m + q));
      const hi = Math.min(A.hl, Math.max(m - q, m + q));
      if (hi >= lo) {
        if (hi - lo < 1) end(w, A, B, (lo + hi) / 2);
        else {
          end(w, A, B, lo);
          end(w, A, B, hi);
        }
        return;
      }
    }
  }
  const p1x = A.x - A.ux * A.hl;
  const p1y = A.y - A.uy * A.hl;
  const d1x = 2 * A.ux * A.hl;
  const d1y = 2 * A.uy * A.hl;
  const p2x = B.x - B.ux * B.hl;
  const p2y = B.y - B.uy * B.hl;
  const d2x = 2 * B.ux * B.hl;
  const d2y = 2 * B.uy * B.hl;
  closest(p1x, p1y, d1x, d1y, p2x, p2y, d2x, d2y);
  add(w, A, B, p1x + d1x * S, p1y + d1y * S, p2x + d2x * T, p2y + d2y * T);
};

const walls = (w: TWorld, b: TBody, fy: number) => {
  const n = b.hl > 0 ? 2 : 1;
  const r = b.r;
  for (let k = 0; k < n; k++) {
    const sg = k ? 1 : -1;
    const ex = b.x + b.ux * b.hl * sg;
    const ey = b.y + b.uy * b.hl * sg;
    if (ey + r > fy) push(w, b, STATIC, 0, 1, ex, ey + r, ey + r - fy, 0.6);
    if (ex - r < 0) push(w, b, STATIC, -1, 0, ex - r, ey, r - ex, 0.6);
    if (ex + r > w.W) push(w, b, STATIC, 1, 0, ex + r, ey, ex + r - w.W, 0.6);
    if (ey - r < -400) push(w, b, STATIC, 0, -1, ex, ey - r, -400 - ey + r, 0.6);
  }
};
// #endregion

// #region Solver
// Soft mouse joint at the grab offset: an impulse drives the anchor toward the pointer, so off centre grabs swing.
const hold = (w: TWorld, b: TBody) => {
  b.vx *= 0.8;
  b.vy *= 0.8;
  b.w *= 0.9;
  b.st = 0;
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  const rx = w.gx * c - w.gy * s;
  const ry = w.gx * s + w.gy * c;
  let tx = (w.px - b.x - rx) * 30;
  let ty = (w.py - b.y - ry) * 30;
  const m = Math.hypot(tx, ty);
  if (m > 3000) {
    tx *= 3000 / m;
    ty *= 3000 / m;
  }
  const dvx = tx - (b.vx - b.w * ry);
  const dvy = ty - (b.vy + b.w * rx);
  const k11 = b.im + b.ii * ry * ry;
  const k12 = -b.ii * rx * ry;
  const k22 = b.im + b.ii * rx * rx;
  const det = k11 * k22 - k12 * k12;
  if (det < 1e-12) return;
  const jx = (k22 * dvx - k12 * dvy) / det;
  const jy = (k11 * dvy - k12 * dvx) / det;
  b.vx += b.im * jx;
  b.vy += b.im * jy;
  b.w += b.ii * (rx * jy - ry * jx);
};

const prestep = (c: TContact) => {
  const A = c.a;
  const B = c.b;
  c.ma = A.zz ? 0 : A.im;
  c.ia = A.zz ? 0 : A.ii;
  c.mb = B.zz ? 0 : B.im;
  c.ib = B.zz ? 0 : B.ii;
  const rax = c.px - A.x;
  const ray = c.py - A.y;
  const rbx = c.px - B.x;
  const rby = c.py - B.y;
  const rna = rax * c.ny - ray * c.nx;
  const rnb = rbx * c.ny - rby * c.nx;
  const kn = c.ma + c.mb + c.ia * rna * rna + c.ib * rnb * rnb;
  const rta = rax * c.nx + ray * c.ny;
  const rtb = rbx * c.nx + rby * c.ny;
  const kt = c.ma + c.mb + c.ia * rta * rta + c.ib * rtb * rtb;
  c.kn = kn > 0 ? 1 / kn : 0;
  c.kt = kt > 0 ? 1 / kt : 0;
  const vn = (B.vx - B.w * rby - A.vx + A.w * ray) * c.nx + (B.vy + B.w * rbx - A.vy - A.w * rax) * c.ny;
  c.s = -vn;
  c.vb = vn < -60 ? -c.e * vn : 0;
  c.pn = 0;
  c.pt = 0;
};

const apply = (c: TContact, px: number, py: number, rax: number, ray: number, rbx: number, rby: number) => {
  const A = c.a;
  const B = c.b;
  A.vx -= c.ma * px;
  A.vy -= c.ma * py;
  A.w -= c.ia * (rax * py - ray * px);
  B.vx += c.mb * px;
  B.vy += c.mb * py;
  B.w += c.ib * (rbx * py - rby * px);
};

const solve = (c: TContact) => {
  const A = c.a;
  const B = c.b;
  const rax = c.px - A.x;
  const ray = c.py - A.y;
  const rbx = c.px - B.x;
  const rby = c.py - B.y;
  let dvx = B.vx - B.w * rby - A.vx + A.w * ray;
  let dvy = B.vy + B.w * rbx - A.vy - A.w * rax;
  let dp = c.kn * (c.vb - (dvx * c.nx + dvy * c.ny));
  const p0 = c.pn;
  c.pn = p0 + dp > 0 ? p0 + dp : 0;
  dp = c.pn - p0;
  apply(c, dp * c.nx, dp * c.ny, rax, ray, rbx, rby);
  dvx = B.vx - B.w * rby - A.vx + A.w * ray;
  dvy = B.vy + B.w * rbx - A.vy - A.w * rax;
  const tx = -c.ny;
  const ty = c.nx;
  let dt = -c.kt * (dvx * tx + dvy * ty);
  const lim = c.mu * c.pn;
  const t0 = c.pt;
  c.pt = clamp(t0 + dt, -lim, lim);
  dt = c.pt - t0;
  apply(c, dt * tx, dt * ty, rax, ray, rbx, rby);
};
// #endregion

// #region Step
const nap = (b: TBody) => {
  b.zz = true;
  b.vx = 0;
  b.vy = 0;
  b.w = 0;
};

export const step = (w: TWorld) => {
  w.t += H;
  const B = w.b;
  const fy = w.Ht - 10;
  let awake = 0;
  while (w.qh !== w.qe && w.q[w.qh * 5 + 4] <= w.t) {
    const o = w.qh * 5;
    place(w, w.qs[w.qh], w.q[o], w.q[o + 1], w.q[o + 2], 0, 200, w.q[o + 3]);
    w.qh = (w.qh + 1) % QN;
  }
  for (let i = 0; i < MAX; i++) {
    const b = B[i];
    if (!b.on) continue;
    if (!b.zz) {
      awake++;
      b.vy += G * H;
      b.vx *= 0.9995;
      b.vy *= 0.9995;
      b.w *= 0.995;
      if (b === w.g) hold(w, b);
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > VMAX * VMAX) {
        const k = VMAX / Math.sqrt(v2);
        b.vx *= k;
        b.vy *= k;
      }
      b.w = clamp(b.w, -WMAX, WMAX);
    }
    box(b);
  }
  const bot = w.bot;
  if (bot.on) box(bot);
  w.nc = 0;
  for (let i = 0; i < MAX; i++) {
    const a = B[i];
    if (!a.on) continue;
    for (let j = i + 1; j < MAX; j++) {
      const b = B[j];
      // leaving bodies skip the live set, so the old scene falls through the new one instead of knocking it over
      if (b.on !== a.on || (a.zz && b.zz) || a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1) continue;
      capsules(w, a, b);
    }
    if (a.on !== 1) continue;
    walls(w, a, fy);
    if (bot.on && a.x0 <= bot.x1 && bot.x0 <= a.x1 && a.y0 <= bot.y1 && bot.y0 <= a.y1) capsules(w, bot, a);
  }
  const C = w.c;
  const n = w.nc;
  for (let i = 0; i < n; i++) prestep(C[i]);
  // a tall pile needs more passes before the bottom contact feels the top weight, or the tiles sink into each other
  const it = awake > PILE ? 2 * ITER : ITER;
  for (let k = 0; k < it; k++) for (let i = 0; i < n; i++) solve(C[i]);
  for (let i = 0; i < MAX; i++) {
    const b = B[i];
    if (!b.on || b.zz) continue;
    b.x += b.vx * H;
    b.y += b.vy * H;
    b.a += b.w * H;
  }
  if (bot.on) bot.x += bot.vx * H;
  // Split impulse: overlap is pushed out after integration from the current positions, so it never turns into bounce.
  for (let k = 0; k < PITER; k++) {
    for (let i = 0; i < n; i++) {
      const c = C[i];
      const m = c.ma + c.mb;
      if (m <= 0) continue;
      const A = c.a;
      const Bb = c.b;
      const d = c.d - (Bb.x - c.bx - A.x + c.ax) * c.nx - (Bb.y - c.by - A.y + c.ay) * c.ny;
      if (d <= SLOP) continue;
      const q = (d - SLOP) * BETA;
      const j = (q < PMAX ? q : PMAX) / m;
      A.x -= c.nx * j * c.ma;
      A.y -= c.ny * j * c.ma;
      Bb.x += c.nx * j * c.mb;
      Bb.y += c.ny * j * c.mb;
    }
  }
  for (let i = 0; i < MAX; i++) {
    const b = B[i];
    if (b.on === 2) {
      if (b.y > w.Ht + 100) b.on = 0;
      continue;
    }
    if (!b.on || b.zz || b === w.g) continue;
    // Judged on drift from where the rest began, not on velocity: a body deep in a pile keeps a few px/s of jitter the correction cancels, and would never sleep.
    const dx = b.x - b.sx;
    const dy = b.y - b.sy;
    const da = b.a - b.sa;
    // once the scene is left alone the test loosens, or a big pile keeps creeping and waking itself for a minute
    const ta = w.dz ? 0.15 : 0.05;
    if (b.st > 0 && dx * dx + dy * dy < (w.dz ? 16 : 4) && da < ta && da > -ta) {
      b.st += H;
      if (b.st > (w.dz ? 0.3 : 0.6)) nap(b);
    } else {
      b.st = H;
      b.sx = b.x;
      b.sy = b.y;
      b.sa = b.a;
    }
  }
};
// #endregion
