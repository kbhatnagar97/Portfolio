import type { TFlowKind } from '../data';
import { BOT, ITEM, type TItem } from '../flow';
import { PROP_SCALE, floorOf, type TLayout, type TProp } from './geometry';
import { H, disc, place, setVel, take, type TBot, type TDisc, type TPose, type TRole, type TThing, type TWorld } from './physics';

// #region Palette
export type TPalette = Record<'bg' | 'text' | 'muted' | 'holo' | 'line' | 'shell' | 'head' | 'human' | 'drop' | 'accent', string> & { k: Record<TFlowKind, string> };

export const readPalette = (el: HTMLElement): TPalette => {
  const cs = getComputedStyle(el);
  const v = (name: string, alt: string) => cs.getPropertyValue(name).trim() || alt;
  const accent = v('--accent', '#7fe7ff');
  return {
    bg: v('--bg', '#0b0a09'),
    text: v('--text', '#f2ebe1'),
    muted: v('--muted', '#a89e92'),
    holo: v('--holo', '#7fe7ff'),
    line: v('--holo-line', 'rgba(127, 231, 255, 0.28)'),
    shell: v('--bot-shell', '#1d1813'),
    head: v('--bot-head', '#2a221b'),
    human: v('--k-human', '#ffae42'),
    drop: v('--k-drop', '#ff7a7a'),
    accent,
    k: {
      trigger: v('--k-trigger', '#f0b44c'),
      source: v('--k-source', '#7fe7ff'),
      ai: v('--k-ai', accent),
      rule: v('--k-rule', '#a9a4ff'),
      human: v('--k-human', '#ffae42'),
      output: v('--k-output', '#5ee49a'),
      drop: v('--k-drop', '#ff7a7a'),
    },
  };
};
// #endregion

// #region Paths
type TPaths = Record<'chassis' | 'stripe' | 'head' | 'visor' | 'bell' | 'dish' | 'satchel' | 'lid', Path2D> & { item: Record<TItem, Path2D> };
let cache: TPaths | undefined;
const paths = () =>
  (cache ??= {
    chassis: new Path2D(BOT.chassis.d),
    stripe: new Path2D(BOT.stripe.d),
    head: new Path2D(BOT.head.d),
    visor: new Path2D(BOT.visor.d),
    bell: new Path2D('M-3 0a3 3 0 0 1 6 0z'),
    dish: new Path2D('M-3.5-1.5q3.5 3 7 0'),
    satchel: new Path2D('M-13-3h5v6h-5z'),
    lid: new Path2D('M-11 0l3.67-3 3.67 3 3.67-3 3.67 3 3.67-3 3.67 3'),
    item: {
      story: new Path2D(ITEM.story.d),
      job: new Path2D(ITEM.job.d),
      mail: new Path2D(ITEM.mail.d),
      crate: new Path2D(ITEM.crate.d),
    },
  });
const DASH = [1.5, 1.5];
const SOLID: number[] = [];
// #endregion

// #region Transform
let K = 1;
let OX = 0;
let OY = 0;
let GLOW = 1;
// Module scoped view: every card sets its own before drawing.
export const setView = (k: number, ox: number, oy: number, glow: number) => {
  K = k;
  OX = ox;
  OY = oy;
  GLOW = glow;
};
// Local part space (rotated, scaled, mirrored) straight into device pixels, no save/restore.
const at = (ctx: CanvasRenderingContext2D, x: number, y: number, a: number, sx: number, sy: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.setTransform(K * sx * c, K * sx * s, -K * sy * s, K * sy * c, K * x + OX, K * y + OY);
};
export const world = (ctx: CanvasRenderingContext2D) => ctx.setTransform(K, 0, 0, K, OX, OY);
const P = { x: 0, y: 0 };
const rot = (x: number, y: number, a: number, lx: number, ly: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  P.x = x + lx * c - ly * s;
  P.y = y + lx * s + ly * c;
  return P;
};
const line = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
};
const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
};
// #endregion

// #region Crew
const ROLE: Record<TFlowKind, TRole> = { trigger: 'clock', source: 'scout', ai: 'thinker', rule: 'bouncer', output: 'courier', human: 'human', drop: 'courier' };
const SCALE: Record<TRole, number> = { clock: 1.1, scout: 1, thinker: 1.25, bouncer: 1.1, courier: 1, human: 1, bench: PROP_SCALE };
const HAND: Record<TPose, [number, number]> = { idle: [7, -6.3], reach: [7, -6.3], hold: [12, -15], think: [8, -23], carry: [5, -22], cross: [-1, -12], sit: [6, -5] };

export const makeBot = (L: TLayout, kind: TFlowKind, st: number, x: number, f: number, dir: 1 | -1, bench: boolean): TBot => {
  const role = bench ? 'bench' : ROLE[kind];
  const s = SCALE[role];
  const b: TBot = {
    role, kind, st, s, f, homeF: f, homeX: x, x, tx: x, vmax: 140, dir,
    mode: 'kin', p: [disc(3.5), disc(6), disc(5), disc(1.8), disc(1.6)],
    parts: [7, 6, 3.5, 3.5, 4, 4].map((r) => disc(r * s)),
    slow: 0, mt: 0, crash: false, bump: false, dizzy: 0,
    pose: bench ? 'sit' : role === 'bouncer' ? 'cross' : 'idle', hx: 7, hy: -6.3, rx: 0, ry: 0, lean: 0, leanT: 0, tilt: 0,
    hop: 0, hopH: 0, kick: 0, shake: 0, lookX: x + dir * 40, lookY: L.floors[f].y - 30, pupil: 0,
    blinkIn: 2 + Math.random() * 4, blinkT: 0, led: bench ? 'sleep' : 'idle', flash: 0, halo: 0, ring: 0, roll: 0,
    away: false, asleep: bench, clip: 0, pokes: [-9, -9, -9], pokeI: 0, held: -1, seat: bench ? 7 : 0, gate: 0, glow: 0,
  };
  poseBot(b, L, 0, 1);
  b.p.forEach((q) => place(q, q.x, q.y));
  return b;
};

export const intact = (b: TBot) => b.mode === 'kin' && !b.away;

const kin = (q: TDisc, x: number, y: number) => {
  q.px = q.x;
  q.py = q.y;
  q.x = x;
  q.y = y;
};

// Kinematic bots are written from the puppet pose; only the antenna tip integrates.
export const poseBot = (b: TBot, L: TLayout, t: number, dt: number) => {
  if (b.mode !== 'kin') return;
  const s = b.s;
  const d = b.dir;
  const k = 1 - Math.exp(-dt / 0.04);
  let tx = HAND[b.pose][0];
  let ty = HAND[b.pose][1];
  const fy = L.floors[b.f].y - b.seat;
  if (b.pose === 'reach') {
    tx = (b.rx - b.x) / (s * d) - 5;
    ty = (b.ry - fy) / s + 14;
    const m = Math.hypot(tx, ty);
    if (m > 9) {
      tx *= 9 / m;
      ty *= 9 / m;
    }
    tx += 5;
    ty -= 14;
  }
  b.hx += (tx - b.hx) * k;
  b.hy += (ty - b.hy) * k;
  b.kick = Math.max(0, b.kick - dt);
  b.lean += (b.leanT + (b.kick > 0 ? 0.35 : 0) - b.lean) * k;
  const v = Math.max(-b.vmax, Math.min(b.vmax, (b.tx - b.x) * 8));
  b.x += v * dt;
  b.roll += (v * dt) / (BOT.wheel.r * s);
  b.hop = Math.max(0, b.hop - dt);
  b.ring = Math.max(0, b.ring - dt);
  b.flash = Math.max(0, b.flash - dt);
  b.blinkIn -= dt;
  if (b.blinkIn <= 0) {
    b.blinkT = 0.12;
    b.blinkIn = 3 + Math.random() * 3;
  }
  b.blinkT = Math.max(0, b.blinkT - dt);
  const lift = (b.hop > 0 ? Math.sin((Math.PI * b.hop) / 0.35) * b.hopH : 0) + (b.ring > 0 ? Math.abs(Math.sin(b.ring * 18)) * 8 : 0);
  const breathe = b.pose === 'idle' || b.pose === 'cross' || b.pose === 'sit' ? Math.sin(t * Math.PI + b.homeX) * 0.4 : 0;
  const tilt = b.pose === 'think' ? Math.sin(t * Math.PI * 6) * 0.1 : b.tilt;
  const shake = b.shake ? (Math.random() - 0.5) * 2 * b.shake : 0;
  const a = b.lean * d;
  const bx = b.x + shake;
  const by = fy - 3.5 * s - lift + breathe;
  kin(b.p[0], bx, by);
  const c = rot(bx, by, a, 0, -8.5 * s);
  kin(b.p[1], c.x, c.y);
  const hd = rot(b.p[1].x, b.p[1].y, a + tilt * d, 0, -13.5 * s);
  kin(b.p[2], hd.x, hd.y);
  const hn = rot(bx, by, a, b.hx * s * d, (b.hy + 3.5) * s);
  kin(b.p[3], hn.x, hn.y);
  if (dt >= 1) place(b.p[4], b.p[2].x, b.p[2].y - 13 * s);
  const look = Math.max(-1, Math.min(1, ((b.lookX - b.p[2].x) * d) / 30)) * BOT.pupil.slide;
  b.pupil += (look - b.pupil) * k;
};

export const holdPoint = (b: TBot) => {
  const hand = b.p[3];
  if (b.role === 'human') return rot(hand.x, hand.y, 0, 0, 0);
  if (b.pose === 'carry') return rot(b.p[2].x, b.p[2].y, 0, 0, -16 * b.s);
  return rot(hand.x, hand.y, 0, 0, -5);
};

// Back to the puppet after a tumble; a bot that landed on the wrong floor is poofed home by the director.
export const settle = (b: TBot, L: TLayout) => {
  const [base, chest] = b.p;
  b.mode = 'kin';
  b.x = base.x;
  b.f = floorOf(L, base.y);
  b.lean = Math.max(-1.2, Math.min(1.2, Math.atan2(chest.x - base.x, base.y - chest.y) * b.dir));
  b.tx = b.homeX;
  b.dizzy = 0;
  b.mt = 0;
};

export const ragdoll = (b: TBot) => {
  if (b.mode !== 'kin' || b.role === 'human') return;
  b.mode = 'rag';
  b.mt = 0;
  b.slow = 0;
  b.bump = false;
};

const PARTS_V: [number, number, number][] = [
  [60, -140, 4],
  [120, -260, 12],
  [140, -60, 0],
  [140, -60, 0],
  [180, -180, 10],
  [120, -200, 14],
];

export const breakBot = (w: TWorld, b: TBot, col: string, puffs: number) => {
  if (b.role === 'human' || b.mode === 'broken' || b.mode === 'mend') return false;
  const [base, chest, head, hand, tip] = b.p;
  const s = b.s;
  const ca = Math.atan2(chest.x - base.x, base.y - chest.y);
  const ha = Math.atan2(head.x - chest.x, chest.y - head.y);
  const [pc, ph, pl, pr, pa, pn] = b.parts;
  place(pc, chest.x, chest.y);
  pc.a = ca;
  place(ph, head.x, head.y);
  ph.a = ha;
  place(pl, base.x - Math.cos(ca) * 6 * s, base.y - Math.sin(ca) * 6 * s);
  place(pr, base.x + Math.cos(ca) * 6 * s, base.y + Math.sin(ca) * 6 * s);
  const sh = rot(chest.x, chest.y, ca, 5 * s * b.dir, -2 * s);
  place(pa, (sh.x + hand.x) / 2, (sh.y + hand.y) / 2);
  pa.a = Math.atan2(hand.y - sh.y, hand.x - sh.x);
  const ht = rot(head.x, head.y, ha, 0, -5 * s);
  place(pn, (ht.x + tip.x) / 2, (ht.y + tip.y) / 2);
  pn.a = ha;
  // part discs are wider than the ragdoll particles, so one can spawn through the floor the bot lies on
  const fl = w.L.floors[floorOf(w.L, Math.max(base.y, chest.y, head.y))];
  for (const q of b.parts) if ((q.x < fl.g0 || q.x > fl.g1) && q.y + q.r > fl.y) q.y = q.py = fl.y - q.r;
  const vx0 = (chest.x - chest.px) / H;
  const vy0 = (chest.y - chest.py) / H;
  b.parts.forEach((q, i) => {
    const [vx, vy, sp] = PARTS_V[i];
    const side = i === 2 ? -1 : i === 3 ? 1 : Math.random() < 0.5 ? -1 : 1;
    setVel(q, vx0 * 0.5 + side * vx * (0.5 + Math.random() * 0.5), vy0 * 0.5 + vy + (Math.random() - 0.5) * 120);
    q.spin = i === 2 || i === 3 ? (side * vx) / q.r : side * sp;
  });
  b.mode = 'broken';
  b.mt = 0;
  b.led = 'alarm';
  b.crash = b.bump = false;
  for (let i = 0; i < puffs; i++) {
    const p = take(w.puffs);
    p.x = chest.x + (Math.random() - 0.5) * 14;
    p.y = chest.y + (Math.random() - 0.5) * 10;
    p.r = 3 + Math.random() * 3;
    p.t = 0;
    p.life = 0.9;
  }
  for (let i = 0; i < 8; i++) {
    const sp = take(w.sparks);
    const a = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 160;
    sp.x = chest.x;
    sp.y = chest.y;
    sp.vx = Math.cos(a) * v;
    sp.vy = Math.sin(a) * v;
    sp.t = 0;
    sp.life = 0.25;
    sp.c = col;
  }
  return true;
};

// Every part springs home to its assembled spot, staggered head, wheels, antenna.
export const mendBot = (b: TBot, L: TLayout) => {
  const s = b.s;
  const d = b.dir;
  const x = b.homeX;
  const fy = L.floors[b.homeF].y - b.seat;
  const arm = Math.atan2(7.7, 2 * d);
  const homes: [number, number, number, number][] = [
    [x, fy - 12 * s, 0, 0.18],
    [x, fy - 25.5 * s, 0, 0],
    [x - 6 * s, fy - 3.5 * s, 0, 0.06],
    [x + 6 * s, fy - 3.5 * s, 0, 0.06],
    [x + (5 + 1) * s * d, fy - 10.2 * s, arm, 0.18],
    [x, fy - 34.5 * s, 0, 0.12],
  ];
  b.parts.forEach((q, i) => {
    [q.hx, q.hy, q.ha, q.dl] = homes[i];
  });
  b.mode = 'mend';
  b.mt = 0;
};

export const mended = (b: TBot) => {
  for (let i = 0; i < 6; i++) {
    const q = b.parts[i];
    if (Math.abs(q.x - q.hx) >= 1.5 || Math.abs(q.y - q.hy) >= 1.5) return false;
  }
  return true;
};

export const snapHome = (b: TBot, L: TLayout) => {
  b.mode = 'kin';
  b.f = b.homeF;
  b.x = b.tx = b.homeX;
  b.lean = 0;
  b.mt = 0;
  b.dizzy = 0;
  b.away = false;
  b.led = b.asleep ? 'sleep' : 'idle';
  poseBot(b, L, 0, 1);
  b.p.forEach((q) => place(q, q.x, q.y));
};
// #endregion

// #region Draw bots
export const drawBot = (ctx: CanvasRenderingContext2D, b: TBot, C: TPalette, t: number) => {
  const pt = paths();
  const s = b.s;
  const d = b.dir;
  const col = C.k[b.kind];
  if (b.mode === 'broken' || b.mode === 'mend') {
    drawParts(ctx, b, C, col);
    return;
  }
  const base = b.p[0];
  const chest = b.p[1];
  const head = b.p[2];
  const hand = b.p[3];
  const tip = b.p[4];
  const ca = Math.atan2(chest.x - base.x, base.y - chest.y);
  const ha = Math.atan2(head.x - chest.x, chest.y - head.y);
  world(ctx);
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  const n1 = rot(chest.x, chest.y, ca, 0, -6 * s);
  const n1x = n1.x;
  const n1y = n1.y;
  const n2 = rot(head.x, head.y, ha, 0, 5 * s);
  line(ctx, n1x, n1y, n2.x, n2.y);
  const sh = rot(chest.x, chest.y, ca, 5 * s * d, -2 * s);
  line(ctx, sh.x, sh.y, hand.x, hand.y);
  ctx.stroke();
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  const at0 = rot(head.x, head.y, ha, 0, -5 * s);
  line(ctx, at0.x, at0.y, tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.beginPath();
  dot(ctx, hand.x, hand.y, BOT.arm.hand * s);
  ctx.fill();
  for (let side = -1; side <= 1; side += 2) {
    at(ctx, base.x + side * Math.cos(ca) * 6 * s, base.y + side * Math.sin(ca) * 6 * s, b.roll, s, s);
    wheel(ctx, C);
  }
  at(ctx, chest.x, chest.y, ca, s * d, s);
  ctx.fillStyle = C.shell;
  ctx.fill(pt.chassis);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.25;
  ctx.stroke(pt.chassis);
  ctx.globalAlpha *= 0.45;
  ctx.fillStyle = col;
  ctx.fill(pt.stripe);
  ctx.globalAlpha /= 0.45;
  accessory(ctx, b, C, col, t);
  at(ctx, head.x, head.y, ha, s * d, s);
  ctx.fillStyle = C.head;
  ctx.fill(pt.head);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.stroke(pt.head);
  if (b.role === 'thinker') {
    ctx.globalAlpha *= 0.25 + b.halo * 0.45;
    ctx.beginPath();
    dot(ctx, 0, 0, 11);
    ctx.stroke();
    ctx.globalAlpha /= 0.25 + b.halo * 0.45;
  }
  visor(ctx, b, C, col, head.x, head.y, ha);
  tipCap(ctx, b, col, tip.x, tip.y, ha);
  if ((b.role === 'thinker' && b.halo > 0.6) || b.dizzy > 0) {
    world(ctx);
    ctx.fillStyle = b.dizzy > 0 ? C.text : col;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      dot(ctx, head.x + Math.cos(a) * 12 * s, head.y - (b.dizzy > 0 ? 10 * s : 0) + Math.sin(a) * 4 * s, 1.1 * s);
    }
    ctx.fill();
  }
};

const wheel = (ctx: CanvasRenderingContext2D, C: TPalette) => {
  ctx.fillStyle = C.bg;
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  dot(ctx, 0, 0, BOT.wheel.r);
  ctx.fill();
  line(ctx, 0, 0, BOT.wheel.r, 0);
  ctx.stroke();
};

const ledColour = (b: TBot, C: TPalette, col: string) => {
  if (b.flash > 0) return b.flash % 0.16 > 0.08 ? C.bg : C.accent;
  if (b.led === 'work') return col;
  if (b.led === 'wait') return C.human;
  if (b.led === 'alarm') return C.drop;
  if (b.led === 'sleep') return C.muted;
  return C.holo;
};

const visor = (ctx: CanvasRenderingContext2D, b: TBot, C: TPalette, col: string, hx: number, hy: number, ha: number) => {
  const s = b.s;
  const d = b.dir;
  const v = rot(hx, hy, ha, BOT.visor.x * s * d, (BOT.visor.y - BOT.head.y) * s);
  const wide = b.role === 'bouncer' ? 11 / 6.5 : 1;
  at(ctx, v.x, v.y, ha, s * d * wide, s * (b.blinkT > 0 ? 0.4 : 1));
  ctx.globalAlpha *= b.led === 'sleep' ? 0.3 : 1;
  ctx.fillStyle = ledColour(b, C, col);
  ctx.fill(paths().visor);
  ctx.globalAlpha /= b.led === 'sleep' ? 0.3 : 1;
  if (b.led === 'sleep' || b.blinkT > 0) return;
  ctx.fillStyle = C.bg;
  ctx.beginPath();
  if (b.mode === 'rag') {
    ctx.strokeStyle = C.bg;
    ctx.lineWidth = 0.7;
    ctx.moveTo(-2.6, -0.8);
    ctx.lineTo(-1.6, 0);
    ctx.lineTo(-2.6, 0.8);
    ctx.moveTo(2.6, -0.8);
    ctx.lineTo(1.6, 0);
    ctx.lineTo(2.6, 0.8);
    ctx.moveTo(-0.8, 0.4);
    ctx.lineTo(0.8, 0.4);
    ctx.stroke();
    return;
  }
  const px = b.pupil / wide;
  dot(ctx, -BOT.pupil.dx / 2 + px, 0, BOT.pupil.r);
  dot(ctx, BOT.pupil.dx / 2 + px, 0, BOT.pupil.r);
  if (b.halo > 0.6) dot(ctx, Math.sin(b.mt * 9) * 2.4, 0, 0.6);
  ctx.fill();
};

const tipCap = (ctx: CanvasRenderingContext2D, b: TBot, col: string, x: number, y: number, ha: number) => {
  const s = b.s;
  at(ctx, x, y, ha, s, s);
  ctx.fillStyle = col;
  if (b.role === 'clock') {
    ctx.fill(paths().bell);
    if (b.ring > 0) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      line(ctx, -5, -1, -7.5, -3);
      line(ctx, 5, -1, 7.5, -3);
      line(ctx, 0, -4.5, 0, -7.5);
      ctx.stroke();
    }
    return;
  }
  if (b.role === 'scout') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.stroke(paths().dish);
  }
  ctx.beginPath();
  dot(ctx, 0, 0, BOT.antenna.tip);
  ctx.fill();
  const g = (0.3 + b.glow * 0.5) * GLOW;
  ctx.globalAlpha *= g;
  ctx.beginPath();
  dot(ctx, 0, 0, BOT.antenna.glow);
  ctx.fill();
  ctx.globalAlpha /= g;
};

const accessory = (ctx: CanvasRenderingContext2D, b: TBot, C: TPalette, col: string, t: number) => {
  ctx.lineWidth = 0.8;
  if (b.role === 'clock') {
    ctx.strokeStyle = col;
    ctx.beginPath();
    dot(ctx, 0, -1, 3.5);
    const a = b.ring > 0 ? t * Math.PI * 16 : t * 0.5;
    line(ctx, 0, -1, Math.sin(a) * 2.6, -1 - Math.cos(a) * 2.6);
    ctx.stroke();
  } else if (b.role === 'courier' || (b.role === 'bench' && b.kind === 'output')) {
    ctx.fillStyle = C.k.output;
    ctx.fill(paths().satchel);
  }
  if (b.clip > 0) {
    ctx.strokeStyle = C.text;
    ctx.strokeRect(-3, -4.5, 6, 7);
    ctx.beginPath();
    for (let i = 0; i < Math.min(b.clip, 3); i++) line(ctx, -1.8, -2.5 + i * 1.8, 1.8, -2.5 + i * 1.8);
    ctx.stroke();
  }
};

const drawParts = (ctx: CanvasRenderingContext2D, b: TBot, C: TPalette, col: string) => {
  const pt = paths();
  const s = b.s;
  const d = b.dir;
  const pc = b.parts[0];
  const ph = b.parts[1];
  const pl = b.parts[2];
  const pr = b.parts[3];
  const pa = b.parts[4];
  const pn = b.parts[5];
  at(ctx, pl.x, pl.y, pl.a, s, s);
  wheel(ctx, C);
  at(ctx, pr.x, pr.y, pr.a, s, s);
  wheel(ctx, C);
  at(ctx, pa.x, pa.y, pa.a, s, s);
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  line(ctx, -4, 0, 4, 0);
  ctx.stroke();
  at(ctx, pn.x, pn.y, pn.a, s, s);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  line(ctx, 0, 4, 0, -3.5);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  dot(ctx, 0, -4, BOT.antenna.tip);
  ctx.fill();
  at(ctx, pc.x, pc.y, pc.a, s * d, s);
  ctx.fillStyle = C.shell;
  ctx.fill(pt.chassis);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.25;
  ctx.stroke(pt.chassis);
  at(ctx, ph.x, ph.y, ph.a, s * d, s);
  ctx.fillStyle = C.head;
  ctx.fill(pt.head);
  ctx.lineWidth = 1;
  ctx.stroke(pt.head);
  visor(ctx, b, C, col, ph.x, ph.y, ph.a);
};
// #endregion

// #region Draw items and props
export const drawItem = (ctx: CanvasRenderingContext2D, it: TThing, x: number, y: number, C: TPalette, digitFont: string, tagR: number, fan: number) => {
  const spec = ITEM[it.kind];
  const p = paths().item[it.kind];
  const sq = it.squash > 0 ? 0.7 : 1;
  // a tall stack would tower over its carrier's visor, so three fanned cards stand in for the rest
  const n = Math.min(it.n, 3);
  ctx.globalAlpha = it.alpha;
  ctx.setLineDash(it.dashed ? DASH : SOLID);
  for (let i = 0; i < n; i++) {
    const o = rot(x, y, it.a, i * 2.5 * fan, -i * spec.h * 0.6);
    at(ctx, o.x, o.y, it.a + i * 0.12 * fan, 1, sq);
    ctx.strokeStyle = it.dashed ? C.holo : it.copy ? C.accent : C.text;
    ctx.lineWidth = 1;
    if (!it.dashed) {
      ctx.fillStyle = C.head;
      ctx.fill(p);
    }
    ctx.stroke(p);
  }
  ctx.setLineDash(SOLID);
  if (it.score) {
    at(ctx, x + spec.w / 2, y - spec.h / 2, 0, 1, 1);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    dot(ctx, 0, 0, tagR);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.font = digitFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.score === 10 ? '10' : '9', 0, 0.5);
  }
  ctx.globalAlpha = 1;
};

export const drawTray = (ctx: CanvasRenderingContext2D, p: TProp, kind: TItem, C: TPalette) => {
  const s = PROP_SCALE;
  for (let i = 0; i < p.shown; i++) {
    at(ctx, p.x - 6 * s + (i % 2) * 5, p.y + 6 * s - Math.floor(i / 2) * 3, (i - 1.5) * 0.2, s * 0.8, s * 0.8);
    ctx.globalAlpha = i === 0 && p.shown === 4 ? 0.35 : 1;
    ctx.fillStyle = C.head;
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1;
    ctx.fill(paths().item[kind]);
    ctx.stroke(paths().item[kind]);
  }
  ctx.globalAlpha = 1;
};

export const drawShredderLid = (ctx: CanvasRenderingContext2D, p: TProp, chomp: number, C: TPalette) => {
  at(ctx, p.x, p.y - 16 - chomp * 3, 0, PROP_SCALE, PROP_SCALE);
  ctx.strokeStyle = C.drop;
  ctx.lineWidth = 1.5;
  ctx.stroke(paths().lid);
};

export const drawGate = (ctx: CanvasRenderingContext2D, b: TBot, col: string, C: TPalette) => {
  const x = b.homeX + 15 * b.dir * b.s;
  const y = b.p[0].y + 3.5 * b.s;
  world(ctx);
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  line(ctx, x, y, x, y - 26 * PROP_SCALE);
  ctx.stroke();
  at(ctx, x, y - 26 * PROP_SCALE, -b.gate * 1.22 * b.dir, b.dir, 1);
  ctx.strokeStyle = col;
  ctx.beginPath();
  line(ctx, 0, 0, 20 * PROP_SCALE, 0);
  ctx.stroke();
};

// The human is a button and a gloved hand, never a bot; the glove hangs from the floor above so its cable never skewers that station.
export const drawHuman = (ctx: CanvasRenderingContext2D, x: number, fy: number, press: number, glove: number, top: number, wiggle: number, buzz: number, C: TPalette, t: number) => {
  world(ctx);
  ctx.strokeStyle = C.human;
  ctx.fillStyle = C.shell;
  ctx.lineWidth = 1.25;
  ctx.fillRect(x - 11, fy - 18, 22, 18);
  ctx.strokeRect(x - 11, fy - 18, 22, 18);
  at(ctx, x, fy - 18, 0, 1, 1 - press * 0.5);
  ctx.fillStyle = C.head;
  ctx.beginPath();
  ctx.arc(0, 0, 9, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (buzz > 0) {
    world(ctx);
    const j = Math.sin(t * 90) * 1.2;
    ctx.beginPath();
    line(ctx, x - 15 + j, fy - 16, x - 15 + j, fy - 6);
    line(ctx, x + 15 - j, fy - 16, x + 15 - j, fy - 6);
    ctx.stroke();
  }
  if (glove <= top) return;
  world(ctx);
  const alpha = ctx.globalAlpha;
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  line(ctx, x - 3, top, x + 3, top);
  line(ctx, x, top, x, Math.max(top, glove - 8));
  ctx.stroke();
  ctx.globalAlpha = alpha * Math.min(1, (glove - top) / 14);
  ctx.fillStyle = C.human;
  ctx.fillRect(x - 8, glove - 9, 16, 4);
  ctx.fillStyle = C.text;
  for (let i = 0; i < 4; i++) {
    const w = wiggle > 0 ? Math.sin(t * 30 + i * 1.7) * 1.5 : 0;
    const len = i === 0 || i === 3 ? 6 : 8;
    ctx.beginPath();
    ctx.roundRect(x - 7.5 + i * 4, glove - 5 + w, 3, len, 1.5);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
};
// #endregion

// #region Static layer
// Floors, plinths, prop outlines and idle labels, drawn once per resize and blitted each frame.
export const drawStatic = (ctx: CanvasRenderingContext2D, L: TLayout, C: TPalette, labels: string[], font: string) => {
  world(ctx);
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  L.floors.forEach((f) => {
    line(ctx, 0, f.y, Math.min(L.W, f.g0), f.y);
    if (f.g1 < L.W) line(ctx, Math.max(0, f.g1), f.y, L.W, f.y);
    if (f.g0 < L.W) {
      // hatch flaps hang open where items drop through
      line(ctx, f.g0, f.y, f.g0 + 3, f.y + 7);
      if (f.g1 < L.W) line(ctx, f.g1, f.y, f.g1 - 3, f.y + 7);
    }
  });
  ctx.stroke();
  L.stations.forEach((s) => {
    if (s.node.kind === 'human') return;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = C.k[s.node.kind];
    ctx.fillRect(s.x - 13, s.y - 1.5, 26, 3);
  });
  ctx.globalAlpha = 1;
  L.props.forEach((p) => {
    const s = PROP_SCALE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (p.kind === 'tray') {
      ctx.strokeStyle = C.k[p.node.kind];
      ctx.moveTo(p.x - 12 * s, p.y);
      ctx.lineTo(p.x - 12 * s, p.y + 14 * s);
      ctx.lineTo(p.x + 12 * s, p.y + 14 * s);
      ctx.lineTo(p.x + 12 * s, p.y);
    } else if (p.kind === 'shredder') {
      ctx.strokeStyle = C.drop;
      ctx.fillStyle = C.shell;
      ctx.rect(p.x - 11 * s, p.y - 20 * s, 22 * s, 20 * s);
      ctx.fill();
      ctx.moveTo(p.x - 6 * s, p.y - 12 * s);
      ctx.lineTo(p.x + 6 * s, p.y - 12 * s);
    } else {
      ctx.strokeStyle = C.muted;
      ctx.moveTo(p.x - 12, p.y - 7);
      ctx.lineTo(p.x + 12, p.y - 7);
      line(ctx, p.x - 9, p.y - 7, p.x - 9, p.y);
      line(ctx, p.x + 9, p.y - 7, p.x + 9, p.y);
    }
    ctx.stroke();
  });
  drawLabels(ctx, L, C, labels, font, -1);
};

export const drawLabels = (ctx: CanvasRenderingContext2D, L: TLayout, C: TPalette, labels: string[], font: string, only: number) => {
  world(ctx);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.text;
  for (let i = 0; i < L.stations.length; i++) {
    const s = L.stations[i];
    const live = only >= 0;
    if (live ? s.i !== only : L.compact && s.node.kind !== 'human') continue;
    ctx.globalAlpha = live ? 1 : 0.45;
    ctx.fillText(labels[s.i], s.x, s.y + 9);
    if (!live) continue;
    const w = ctx.measureText(labels[s.i]).width;
    ctx.fillStyle = C.k[s.node.kind];
    ctx.fillRect(s.x - w / 2, s.y + 14, w, 1);
  }
  ctx.globalAlpha = 1;
};

export const fitLabel = (ctx: CanvasRenderingContext2D, text: string, max: number, font: string) => {
  ctx.font = font;
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 2 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
};
// #endregion
