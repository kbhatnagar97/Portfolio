import { BOT } from './species';
import { H, MAX, wake, wakeNear, type TWorld } from './rigid';

// #region Types
export type TBot = {
  on: boolean;
  s: number;
  dir: number;
  walk: boolean;
  wt: number;
  duty: number;
  push: number;
  next: number;
  roll: number;
  bob: number;
  tilt: number;
  tv: number;
  flash: number;
  hit: number;
  pupil: number;
  tx: number;
  ty: number;
  tpx: number;
  tpy: number;
  over: boolean;
  ox: number;
  seed: number;
};
export type TBotPal = { gold: string; muted: string; text: string; holo: string; raise: string };
// #endregion

// #region Setup
const SHELL = '#1d1813';
const HEAD = '#2a221b';
let PATHS: Record<'chassis' | 'stripe' | 'head' | 'visor', Path2D> | null = null;

export const makeBot = (s: number): TBot => ({
  on: false, s, dir: 1, walk: true, wt: 5, duty: 12, push: -0, next: 4, roll: -0, bob: -0, tilt: -0, tv: -0,
  flash: -0, hit: -0, pupil: -0, tx: -0, ty: -0, tpx: -0, tpy: -0, over: false, ox: -0, seed: 7,
});

// Seeded so the bot's rhythm repeats with the composition.
const rnd = (bt: TBot) => {
  bt.seed = (bt.seed * 1664525 + 1013904223) >>> 0;
  return bt.seed / 4294967296;
};

export const botPlace = (w: TWorld, bt: TBot, x: number) => {
  const B = w.bot;
  B.r = 9 * bt.s;
  B.hl = 8 * bt.s;
  B.a = Math.PI / 2;
  B.x = Math.min(Math.max(x, B.r + 4), w.W - B.r - 4);
  B.y = w.Ht - 10 - B.hl - B.r;
  B.vx = 0;
  B.on = bt.on ? 1 : 0;
  bt.tx = bt.tpx = B.x;
  bt.ty = bt.tpy = w.Ht - 10 - 37 * bt.s;
  bt.tilt = 0;
  bt.tv = 0;
};

export const botCalm = (w: TWorld, bt: TBot) => !bt.on || (w.bot.vx === 0 && bt.flash <= 0 && bt.hit <= 0 && Math.abs(bt.tv) < 0.02 && Math.abs(bt.tilt) < 0.005);
// #endregion

// #region Step
export const botPre = (w: TWorld, bt: TBot) => {
  const B = w.bot;
  B.on = bt.on ? 1 : 0;
  bt.duty -= H;
  if (!bt.on) return;
  B.y = w.Ht - 10 - B.hl - B.r;
  let v = 0;
  if (w.t - w.trap < 0.9) {
    const d = w.W - 30 - B.x;
    if (d > 2 || d < -2) {
      bt.dir = d > 0 ? 1 : -1;
      v = bt.dir * 160;
    }
  } else {
    bt.wt -= H;
    if (bt.wt <= 0) {
      bt.walk = !bt.walk;
      bt.wt = bt.walk ? 4 + rnd(bt) * 4 : 2 + rnd(bt) * 3;
    }
    // dozes once nobody has touched anything for a while, so the loop can stop
    if (bt.duty <= 0) bt.walk = false;
    if (B.x < B.r + 14) bt.dir = 1;
    else if (B.x > w.W - B.r - 14) bt.dir = -1;
    // never rests hard against a wall, or a tile that fell in beside it stays pinched there and jitters
    const edge = w.W < 4 * (B.r + 44) ? 0 : B.x < B.r + 44 ? 1 : B.x > w.W - B.r - 44 ? -1 : 0;
    if (!bt.walk && edge) bt.dir = edge;
    if (bt.walk || edge) v = bt.dir * 45;
  }
  B.vx = v;
  B.vy = 0;
  B.w = 0;
  bt.roll += (v * H) / (BOT.wheel.r * bt.s);
  bt.bob = v ? Math.sin(w.t * 6) * 0.6 : bt.bob * 0.9;
};

export const botPost = (w: TWorld, bt: TBot) => {
  if (!bt.on) return;
  const B = w.bot;
  const fy = w.Ht - 10;
  let blocked = false;
  for (let i = 0; i < w.nc; i++) {
    const c = w.c[i];
    if (c.a !== B) continue;
    if (c.s > 420 && bt.hit <= 0) {
      bt.tv -= c.nx * Math.min(0.4, c.s / 1500) * 10;
      bt.hit = 0.3;
    }
    if (c.nx * bt.dir > 0.5 && B.vx !== 0) blocked = true;
  }
  bt.push = blocked ? bt.push + H : 0;
  if (bt.push > 0.5) {
    bt.dir = -bt.dir;
    bt.push = 0;
  }
  bt.tv += (-100 * bt.tilt - 6 * bt.tv) * H;
  bt.tilt += bt.tv * H;
  bt.flash -= H;
  bt.hit -= H;
  // a dozing bot never boops, or a tile resting beside it would wake every few seconds and the loop could never stop
  if (bt.duty > 0 && w.t >= bt.next) {
    bt.next = w.t + 7 + rnd(bt) * 4;
    for (let i = 0; i < MAX; i++) {
      const b = w.b[i];
      if (b.on !== 1 || !b.zz || b.y1 < fy - 70) continue;
      const gap = (b.x - B.x) * bt.dir - (b.x1 - b.x) - B.r;
      if (gap < -4 || gap > 30) continue;
      b.vx += bt.dir * 180;
      b.vy -= 520;
      b.w += rnd(bt) < 0.5 ? -6 : 6;
      wake(b);
      wakeNear(w, b);
      bt.flash = 0.3;
      break;
    }
  }
  const ly = (-37 + bt.bob) * bt.s;
  const gx = B.x - ly * Math.sin(bt.tilt);
  const gy = fy + ly * Math.cos(bt.tilt);
  const vx = (bt.tx - bt.tpx) * 0.9;
  const vy = (bt.ty - bt.tpy) * 0.9;
  bt.tpx = bt.tx;
  bt.tpy = bt.ty;
  bt.tx += vx + (gx - bt.tx) * 0.2;
  bt.ty += vy + (gy - bt.ty) * 0.2;
  let lx = B.x + bt.dir * 30;
  if (bt.over) lx = bt.ox;
  else {
    let best = 400;
    for (let i = 0; i < MAX; i++) {
      const b = w.b[i];
      if (b.on !== 1 || b.zz) continue;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > best) {
        best = v2;
        lx = b.x;
      }
    }
  }
  const look = Math.max(-1, Math.min(1, ((lx - B.x) * bt.dir) / 30)) * BOT.pupil.slide;
  bt.pupil += (look - bt.pupil) * 0.15;
};
// #endregion

// #region Draw
let D = 1;
let TH = 0;
let SX = 1;
let SY = 1;
let BX = 0;
let BY = 0;
let PX = 0;
let PY = 0;
// Bot local units (origin on the floor between the wheels) to canvas px.
const loc = (lx: number, ly: number) => {
  const c = Math.cos(TH);
  const s = Math.sin(TH);
  PX = BX + lx * SX * c - ly * SY * s;
  PY = BY + lx * SX * s + ly * SY * c;
};
const at = (ctx: CanvasRenderingContext2D, x: number, y: number, a: number, sx: number, sy: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.setTransform(D * sx * c, D * sx * s, -D * sy * s, D * sy * c, D * x, D * y);
};

export const drawBot = (ctx: CanvasRenderingContext2D, w: TWorld, bt: TBot, dpr: number, P: TBotPal) => {
  if (!bt.on) return;
  PATHS ??= { chassis: new Path2D(BOT.chassis.d), stripe: new Path2D(BOT.stripe.d), head: new Path2D(BOT.head.d), visor: new Path2D(BOT.visor.d) };
  D = dpr;
  TH = bt.tilt;
  SX = bt.s * bt.dir;
  SY = bt.s;
  BX = w.bot.x;
  BY = w.Ht - 10;
  const s = bt.s;
  ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    loc(side * BOT.wheel.x, BOT.wheel.y);
    at(ctx, PX, PY, bt.roll, s, s);
    ctx.fillStyle = P.raise;
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, BOT.wheel.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.moveTo(0, 0);
    ctx.lineTo(BOT.wheel.r, 0);
    ctx.stroke();
  }
  ctx.setTransform(D, 0, 0, D, 0, 0);
  ctx.strokeStyle = P.muted;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  loc(BOT.arm.sx, BOT.arm.sy);
  ctx.moveTo(PX, PY);
  loc(BOT.arm.sx + 1.5 + bt.bob, BOT.arm.sy + BOT.arm.len);
  ctx.lineTo(PX, PY);
  const hx = PX;
  const hy = PY;
  loc(BOT.neck.x1, BOT.neck.y1);
  ctx.moveTo(PX, PY);
  loc(BOT.neck.x2, BOT.neck.y2 + bt.bob);
  ctx.lineTo(PX, PY);
  ctx.stroke();
  ctx.fillStyle = P.muted;
  ctx.beginPath();
  ctx.arc(hx, hy, BOT.arm.hand * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  loc(BOT.antenna.x1, BOT.antenna.y1 + bt.bob);
  ctx.moveTo(PX, PY);
  ctx.lineTo(bt.tx, bt.ty);
  ctx.stroke();
  loc(BOT.chassis.x, BOT.chassis.y);
  at(ctx, PX, PY, TH, SX, SY);
  ctx.fillStyle = SHELL;
  ctx.fill(PATHS.chassis);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 1.25;
  ctx.stroke(PATHS.chassis);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = P.gold;
  ctx.fill(PATHS.stripe);
  ctx.globalAlpha = 1;
  loc(BOT.head.x, BOT.head.y + bt.bob);
  at(ctx, PX, PY, TH, SX, SY);
  ctx.fillStyle = HEAD;
  ctx.fill(PATHS.head);
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 1;
  ctx.stroke(PATHS.head);
  loc(BOT.visor.x, BOT.visor.y + bt.bob);
  at(ctx, PX, PY, TH, SX, SY);
  ctx.fillStyle = bt.hit > 0 ? P.text : bt.flash > 0 ? (bt.flash % 0.16 > 0.08 ? P.raise : P.gold) : P.holo;
  ctx.fill(PATHS.visor);
  ctx.fillStyle = P.raise;
  ctx.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    ctx.moveTo((side * BOT.pupil.dx) / 2 + bt.pupil + BOT.pupil.r, 0);
    ctx.arc((side * BOT.pupil.dx) / 2 + bt.pupil, 0, BOT.pupil.r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.setTransform(D, 0, 0, D, 0, 0);
  ctx.fillStyle = P.gold;
  ctx.beginPath();
  ctx.arc(bt.tx, bt.ty, BOT.antenna.tip * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(bt.tx, bt.ty, BOT.antenna.glow * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};
// #endregion
