import { drawBot, type TBot } from './bot';
import { EMPTY, MAX, type TBody, type TSpec, type TWorld } from './rigid';
import type { TTile, TTone } from './types';

// #region Palette
export type TPal = Record<'text' | 'muted' | 'faint' | 'gold' | 'live' | 'strong' | 'raise' | 'holo' | 'violet' | 'sans' | 'serif' | 'mono' | 'cap', string>;

export const readPal = (el: HTMLElement): TPal => {
  const cs = getComputedStyle(el);
  const v = (n: string, alt: string) => cs.getPropertyValue(n).trim() || alt;
  const mono = v('--mono', '"Geist Mono", ui-monospace, monospace');
  return {
    text: v('--text', '#f2ebe1'),
    muted: v('--muted', '#a89e92'),
    faint: v('--faint', '#8a8076'),
    gold: v('--gold', '#f0b44c'),
    live: v('--live', '#5ee49a'),
    strong: v('--line-strong', 'rgba(255,240,225,.22)'),
    raise: v('--bg-raise', '#141210'),
    holo: v('--play-holo', '#7fe7ff'),
    violet: v('--play-violet', '#a9a4ff'),
    sans: v('--sans', '"Geist", system-ui, sans-serif'),
    serif: v('--serif', '"Instrument Serif", Georgia, serif'),
    mono,
    cap: `500 10px ${mono}`,
  };
};

const toneOf = (P: TPal, t: TTone) => (t === 'text' ? P.text : t === 'live' ? P.live : t === 'holo' ? P.holo : t === 'violet' ? P.violet : t === 'gold' ? P.gold : P.muted);
// #endregion

// #region Sprites
const cache = new Map<string, TSpec>();
let M: CanvasRenderingContext2D | null = null;
const measure = (font: string, s: string) => {
  M ??= document.createElement('canvas').getContext('2d');
  if (!M) return s.length * 7;
  M.font = font;
  return M.measureText(s).width;
};

type TFonts = { a: string; b: string; aw: number; bw: number };
// Fonts and text widths for a tile at scale k; shared by sizing and baking so the two never drift.
const fonts = (P: TPal, T: TTile, k: number, band: boolean): TFonts => {
  let a = `500 ${(band ? 11 : 12) * k}px ${P.mono}`;
  let b = '';
  if (T.k === 'chip' && T.serif) a = `italic 400 ${17 * k}px ${P.serif}`;
  else if (T.k === 'plank') {
    a = `500 ${13 * k}px ${P.sans}`;
    b = `500 ${10.5 * k}px ${P.mono}`;
  } else if (T.k === 'stat') {
    a = `italic 400 ${34 * k}px ${P.serif}`;
    b = `500 ${10 * k}px ${P.mono}`;
  } else if (T.k === 'medal') {
    const r = (T.r ?? 22) * k;
    const w1 = measure(`italic 400 10px ${P.serif}`, T.t) / 10;
    a = `italic 400 ${Math.min(r * 1.1, (2 * r - 10 * k) / Math.max(w1, 0.01))}px ${P.serif}`;
  }
  const sub = T.k === 'stat' ? (T.sub ?? '').toUpperCase() : (T.sub ?? '');
  return { a, b, aw: measure(a, T.t), bw: b ? measure(b, sub) : 0 };
};

export const dropSprites = () => cache.clear();

export const bake = (P: TPal, T: TTile, k: number, band: boolean, dpr: number): TSpec => {
  const key = [T.t, T.k, T.tone, T.dot, T.live, T.sub, T.serif, T.r, k, band, dpr].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const F = fonts(P, T, k, band);
  let r = (band ? 13 : 15) * k;
  let hl = 0;
  if (T.k === 'chip') hl = (F.aw + 28 * k + (T.serif ? 0 : 12 * k) - 2 * r) / 2;
  else if (T.k === 'plank') {
    r = 18 * k;
    hl = (F.aw + F.bw + 42 * k - 2 * r) / 2;
  } else if (T.k === 'stat') {
    r = 28 * k;
    hl = (F.aw + F.bw + 54 * k - 2 * r) / 2;
  } else r = (T.r ?? 22) * k;
  hl = Math.max(0, hl);
  const sp: TSpec = { ...EMPTY, tile: T, key, k, band, hl, r, dens: T.k === 'medal' ? 1.6 : 1, e: T.k === 'medal' ? 0.5 : 0.25, cw: 2 * (hl + r) + 8, ch: 2 * r + 8 };
  cache.set(key, sp);
  return sp;
};

// Sizing only measures; the bitmap is drawn the first time a tile is needed, so a set change never pays for every sprite at once.
export const spriteOf = (P: TPal, sp: TSpec, dpr: number) => (sp.spr ??= render(P, sp, dpr, false));

export const heldOf = (P: TPal, sp: TSpec, dpr: number) => (sp.held ??= render(P, sp, dpr, true));

const pill = (g: CanvasRenderingContext2D, hl: number, r: number) => {
  g.beginPath();
  g.moveTo(-hl, -r);
  g.lineTo(hl, -r);
  g.arc(hl, 0, r, -Math.PI / 2, Math.PI / 2);
  g.lineTo(-hl, r);
  g.arc(-hl, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  g.closePath();
};

const render = (P: TPal, sp: TSpec, dpr: number, held: boolean) => {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(sp.cw * dpr);
  cv.height = Math.ceil(sp.ch * dpr);
  const g = cv.getContext('2d');
  if (!g) return cv;
  const T = sp.tile;
  const { k, hl, r } = sp;
  const F = fonts(P, T, k, sp.band);
  const tone = toneOf(P, T.tone);
  g.setTransform(dpr, 0, 0, dpr, (sp.cw / 2) * dpr, (sp.ch / 2) * dpr);
  if (T.live) {
    pill(g, hl, r + 2.5);
    g.strokeStyle = P.live;
    g.lineWidth = 1.5;
    // a full strength ring on every live tile drowns the labels
    g.globalAlpha = 0.55;
    g.stroke();
    g.globalAlpha = 1;
  }
  pill(g, hl, r - 0.5);
  g.fillStyle = P.raise;
  g.fill();
  g.strokeStyle = held ? P.gold : T.k === 'medal' ? tone : P.strong;
  g.lineWidth = held || T.k === 'medal' ? 1.5 : 1;
  g.stroke();
  g.textBaseline = 'middle';
  g.font = F.a;
  let x = -hl - r;
  if (T.k === 'medal') {
    g.textAlign = 'center';
    g.fillStyle = tone;
    g.fillText(T.t, 0, 1);
    return cv;
  }
  if (T.k === 'chip') {
    x += 14 * k;
    if (!T.serif) {
      g.fillStyle = T.dot ?? tone;
      g.beginPath();
      g.arc(x + 3 * k, 0, 3 * k, 0, Math.PI * 2);
      g.fill();
      x += 12 * k;
    }
    g.fillStyle = T.serif ? tone : T.tone === 'muted' ? P.muted : P.text;
    g.fillText(T.t, x, T.serif ? 1 : 0.5);
    return cv;
  }
  x += (T.k === 'stat' ? 22 : 16) * k;
  g.fillStyle = T.k === 'stat' ? tone : P.text;
  g.fillText(T.t, x, T.k === 'stat' ? 2 : 0.5);
  g.font = F.b;
  g.fillStyle = P.muted;
  g.fillText(T.k === 'stat' ? (T.sub ?? '').toUpperCase() : (T.sub ?? ''), x + F.aw + (T.k === 'stat' ? 10 : 10) * k, 0.5);
  return cv;
};
// #endregion

// #region Frame
const ease = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export const paint = (ctx: CanvasRenderingContext2D, w: TWorld, P: TPal, dpr: number, cap: string, bt: TBot) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = w.W;
  const fy = Math.round(w.Ht - 10) + 0.5;
  const tt = w.t - w.trap;
  const open = tt < 0 ? 0 : tt < 0.28 ? ease(tt / 0.28) : tt < 0.5 ? 1 : tt < 0.78 ? 1 - ease((tt - 0.5) / 0.28) : 0;
  const gap = W * 0.35 * open;
  ctx.strokeStyle = P.strong;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, fy);
  ctx.lineTo(W / 2 - gap, fy);
  ctx.moveTo(W / 2 + gap, fy);
  ctx.lineTo(W, fy);
  ctx.stroke();
  ctx.font = P.cap;
  ctx.fillStyle = P.faint;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(cap, W - 14, 22);
  let top: TBody | null = null;
  for (let i = 0; i < MAX; i++) {
    const b = w.b[i];
    if (!b.on) continue;
    if (b === w.g) {
      top = b;
      continue;
    }
    const c = Math.cos(b.a) * dpr;
    const s = Math.sin(b.a) * dpr;
    ctx.setTransform(c, s, -s, c, b.x * dpr, b.y * dpr);
    ctx.drawImage(spriteOf(P, b.sp, dpr), -b.sp.cw / 2, -b.sp.ch / 2, b.sp.cw, b.sp.ch);
  }
  drawBot(ctx, w, bt, dpr, P);
  if (top) {
    const c = Math.cos(top.a) * dpr * 1.04;
    const s = Math.sin(top.a) * dpr * 1.04;
    ctx.setTransform(c, s, -s, c, top.x * dpr, top.y * dpr);
    ctx.drawImage(top.sp.held ?? spriteOf(P, top.sp, dpr), -top.sp.cw / 2, -top.sp.ch / 2, top.sp.cw, top.sp.ch);
  }
};
// #endregion
