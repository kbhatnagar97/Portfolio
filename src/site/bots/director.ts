import type { ICrew, IFlowStep } from '../data';
import { itemOf } from '../flow';
import { PROP_SCALE, floorOf, layoutFor, type TLayout } from './geometry';
import {
  H, body, launch, place, pool, setVel, speed, step, take, thing,
  type TBot, type TRing, type TThing, type TWorld,
} from './physics';
import {
  breakBot, drawBot, drawGate, drawHuman, drawItem, drawLabels, drawShredderLid, drawStatic, drawTray, fitLabel,
  holdPoint, intact, makeBot, mendBot, mended, poseBot, ragdoll, settle, snapHome, world, type TPalette,
} from './crew';

// BotFloor loads this module lazily, so the palette and view helpers ride along with it.
export { readPalette, setView } from './crew';

// #region Types
type TCue = { kind: 'ring' | 'rain' | 'station' | 'ask' | 'rest'; st: number; log: string; step?: IFlowStep; next: number; last: boolean; crash: boolean; kick: boolean };
type TLater = { at: number; fn: () => boolean | void };
type TFonts = { label: string; glyph: string; digit: string; tagR: number };

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const countOf = (log: string) => (/^\d/.test(log) ? parseInt(log, 10) : 1);
// #endregion

export class BotWorld {
  // #region State
  flow: ICrew;
  L: TLayout;
  w: TWorld;
  C: TPalette;
  cap: HTMLElement;
  labels: string[] = [];
  fonts: TFonts = { label: '', glyph: '', digit: '', tagR: 5 };
  human = -1;
  bench: Record<number, number> = {};
  time = 0;
  acc = 0;
  loop = -1;
  loopT = 0;
  tempo = 1;
  rnd = Math.random;
  cues: TCue[] = [];
  ci = 0;
  ph = 0;
  pt = 0;
  once = 0;
  wait = 0;
  main = -1;
  actor = -1;
  fetcher = -1;
  retried = false;
  thrown = false;
  choice = 0;
  seen: number[] = [];
  fumble = -1;
  throws = 0;
  jitter = 1;
  later: TLater[] = [];
  mendAt: number[] = [];
  rain: number[] = [];
  rainN = 0;
  caught = 0;
  glove = 0;
  gTop = 0;
  press = 0;
  wiggle = 0;
  buzz = 0;
  pill = 0;
  pillText = '';
  timer = -1;
  chomp: number[] = [];
  logOf: string[] = [];
  capQ = ['', '', '', ''];
  capQH = [0, 0, 0, 0];
  capH = 0;
  capN = 0;
  capAt = -1;
  capHold = 0;
  fade = 0;
  hover = -1;
  px = -999;
  py = -999;
  gagIn = 3;
  zIn = 1;
  pingIn = 0;
  dt = 0;
  recv = 0;
  calm = 0;
  timerBot = -1;
  landed = false;
  // #endregion

  constructor(flow: ICrew, compact: boolean, C: TPalette, cap: HTMLElement) {
    this.flow = flow;
    this.C = C;
    this.cap = cap;
    const L = (this.L = layoutFor(flow, compact));
    const bots = L.stations.map((s) => makeBot(L, s.node.kind, s.i, s.x, s.f, s.dir, false));
    this.human = L.stations.findIndex((s) => s.node.kind === 'human');
    L.props.forEach((p) => {
      if (p.kind !== 'bench') return;
      this.bench[p.st] = bots.length;
      bots.push(makeBot(L, p.node.kind, p.st, p.x, p.f, p.dir, true));
    });
    this.w = {
      L, bots, items: pool(10, thing), strips: pool(24, () => body(1.5)),
      // -0 seeds keep these fields unboxed doubles from the first frame
      puffs: pool(12, () => ({ x: -0, y: -0, r: -0, t: 1.5, life: -0 })),
      sparks: pool(16, () => ({ x: -0, y: -0, vx: -0, vy: -0, t: 1.5, life: -0, c: '' })),
      rings: pool(6, () => ({ x: -0, y: -0, r0: -0, r1: -0, t: 1.5, life: -0, c: '' })),
      glyphs: pool(10, () => ({ x: -0, y: -0, vy: -0, t: 1.5, life: -0, text: '', c: '' })),
      gk: 0, gi: -1, gp: 0, gx: 0, gy: 0,
    };
    const hs = L.stations[this.human];
    // the glove drops from just under the floor above, below that station's label
    this.gTop = this.glove = hs && hs.f > 0 ? L.floors[hs.f - 1].y + 16 : 20;
    this.mendAt = bots.map(() => 0);
    this.chomp = L.props.map(() => 0);
    this.logOf = this.w.items.map(() => '');
    this.seen = (flow.run[flow.run.length - 1].ask?.choices ?? []).map(() => -1);
  }

  // #region Text and fonts
  setFonts(ctx: CanvasRenderingContext2D, scale: number) {
    const u = Math.max(8.5, 10 / scale);
    const mono = '"Geist Mono", ui-monospace, monospace';
    const digit = `${Math.max(6, 10 / scale)}px ${mono}`;
    ctx.font = digit;
    this.fonts = { label: `${u}px ${mono}`, glyph: `${10 / scale}px ${mono}`, digit, tagR: Math.max(5, ctx.measureText('10').width / 2 + 1.5) };
    this.labels = this.L.stations.map((s) => fitLabel(ctx, s.node.label, this.L.pitch - 6, this.fonts.label));
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    drawStatic(ctx, this.L, this.C, this.labels, this.fonts.label);
  }

  // Each line stays up long enough to read; a fallback line holds longer and drops the station prefix so its key words fit.
  say(st: number, text: string, hold = 0.8) {
    const node = this.L.stations[st].node;
    const Q = this.capQ.length;
    const line = hold >= 2 ? text : `${String(st + 1).padStart(2, '0')} ${node.label.toUpperCase()} · ${text}`;
    // a cue that restarts after a visitor interrupts it says its line again; show it once
    if (line === (this.capN ? this.capQ[(this.capH + this.capN - 1) % Q] : this.cap.textContent)) return;
    if (this.capN === Q) {
      // a full queue sheds its oldest ordinary line; fallback lines carry the takeover story
      let k = 0;
      while (k < Q - 1 && this.capQH[(this.capH + k) % Q] >= 2) k++;
      for (; k > 0; k--) {
        const to = (this.capH + k) % Q;
        const from = (this.capH + k - 1) % Q;
        this.capQ[to] = this.capQ[from];
        this.capQH[to] = this.capQH[from];
      }
      this.capH = (this.capH + 1) % Q;
      this.capN--;
    }
    const tail = (this.capH + this.capN) % Q;
    this.capQ[tail] = line;
    this.capQH[tail] = hold;
    this.capN++;
  }
  // #endregion

  // #region Plan
  startLoop() {
    this.loop++;
    this.loopT = 0;
    this.rnd = mulberry32(hash(this.flow.id) + this.loop * 7919);
    const run = this.flow.run;
    const ask = run[run.length - 1].ask;
    if (ask) {
      let c = 0;
      if (this.loop > 0) {
        const r = this.rnd();
        const wts = [0.6, 0.25, 0.15].slice(0, ask.choices.length);
        const sum = wts.reduce((a, b) => a + b, 0);
        let acc = 0;
        c = wts.findIndex((v) => (acc += v / sum) >= r);
        const stale = this.seen.findIndex((l) => this.loop - l > 3);
        if (stale >= 0) c = stale;
      }
      this.choice = Math.max(0, c);
      this.seen[this.choice] = this.loop;
    }
    const st = this.L.station;
    const firstAi = run.findIndex((s) => this.L.stations[st[s.node]].node.kind === 'ai');
    const cues: TCue[] = [];
    let consumers = 0;
    let kicks = 0;
    run.forEach((s, j) => {
      const node = this.L.stations[st[s.node]].node;
      const kick = node.kind === 'rule' && !s.branches && j < firstAi;
      if (kick) kicks++;
      s.branches?.forEach((b) => {
        if (this.real(b.to, b.tone)) consumers++;
      });
      const kind = node.kind === 'trigger' ? 'ring' : node.kind === 'source' ? 'rain' : node.kind === 'human' ? 'ask' : 'station';
      const crash = this.loop % 3 === 1 && !!node.fallback && node.kind === 'ai';
      cues.push({ kind, st: st[s.node], log: s.log, step: s, next: -1, last: false, crash, kick });
    });
    this.rainN = Math.min(this.L.compact ? 4 : 5, 1 + consumers + kicks);
    cues.push(...this.hops());
    cues.push({ kind: 'rest', st: -1, log: '', next: -1, last: false, crash: false, kick: false });
    this.link(cues);
    this.cues = cues;
    this.ci = 0;
    this.enter();
    this.fumble = this.rnd() < 0.1 ? 1 + Math.floor(this.rnd() * 4) : -1;
    this.throws = 0;
    let est = 1.1;
    cues.forEach((c) => {
      const node = c.st >= 0 ? this.L.stations[c.st].node : undefined;
      est += c.kind === 'ask' ? 2.6 : c.kind === 'rain' ? 1.4 : c.kind === 'ring' ? 0.6 : node?.kind === 'ai' ? 1.1 : 0.55;
      if (c.next < 0) return;
      const a = this.L.stations[c.st];
      const b = this.L.stations[c.next];
      // an upward hop flies a long arc, and a hop down through a hatch re-aims once below the floor
      est += b.f < a.f ? 0.9 : clamp(0.35 + Math.abs(b.x - a.x) / 600, 0.35, 0.9) + (b.f > a.f ? 0.35 : 0);
    });
    this.tempo = clamp(10.5 / est, 0.6, 1.1);
    if (this.rnd() < 0.05) this.at(2 + this.rnd() * 5, () => this.sneeze());
  }

  real(to: string, tone?: string) {
    const kind = this.flow.nodes.find((n) => n.id === to)?.kind;
    return kind === 'drop' || tone === 'drop' || (!tone && kind === 'output');
  }

  hops(): TCue[] {
    const ask = this.flow.run[this.flow.run.length - 1].ask;
    const route = ask?.choices[this.choice].route.filter((h) => h.node in this.L.station) ?? [];
    return route.map((h, k) => ({ kind: 'station', st: this.L.station[h.node], log: h.log, next: -1, last: k === route.length - 1, crash: false, kick: false }));
  }

  link(cues: TCue[]) {
    cues.forEach((c, k) => {
      const n = cues[k + 1];
      c.next = n && n.kind !== 'rest' && n.kind !== 'rain' ? n.st : -1;
    });
  }

  enter() {
    this.ph = 0;
    this.pt = 0;
    this.once = 0;
    this.wait = 0;
    this.thrown = false;
    this.landed = false;
    this.fetcher = -1;
    this.retried = false;
    this.calm = 0;
    this.jitter = 0.75 + this.rnd() * 0.5;
    const c = this.cues[this.ci];
    this.actor = c && c.st >= 0 ? c.st : -1;
    this.recv = c && (c.kind === 'ring' || c.kind === 'rain') ? 1 : 0;
  }

  at(delay: number, fn: () => boolean | void) {
    this.later.push({ at: this.time + delay, fn });
  }

  first(bit: number) {
    if (this.once & bit) return false;
    this.once |= bit;
    return true;
  }
  // #endregion

  // #region Frame
  frame(dt: number) {
    dt = Math.min(dt, 0.1);
    this.dt = dt;
    this.time += dt;
    this.loopT += dt;
    if (this.capAt < 0 && this.capN > 0) this.capAt = Math.max(this.time + 0.12, this.capHold);
    if (this.capAt >= 0 && this.time >= this.capAt - 0.12) this.cap.classList.add('is-swap');
    if (this.capAt >= 0 && this.time >= this.capAt) {
      this.cap.textContent = this.capQ[this.capH];
      this.cap.classList.remove('is-swap');
      this.capAt = -1;
      this.capHold = this.time + this.capQH[this.capH];
      this.capH = (this.capH + 1) % this.capQ.length;
      this.capN--;
    }
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      if (this.time < l.at) continue;
      if (l.fn() === true) l.at = this.time + 0.1;
      else this.later.splice(i, 1);
    }
    if (this.loop < 0) this.startLoop();
    if (this.fade > 0) {
      this.fade -= dt;
      if (this.fade <= 0) this.reset();
    } else if (this.loopT > 20) this.fade = 0.3;
    this.upkeep(dt);
    this.cue(dt);
    this.items(dt);
    this.fx(dt);
    this.acc += dt;
    let n = 0;
    while (this.acc >= H && n < 6) {
      step(this.w);
      this.detect();
      this.acc -= H;
      n++;
    }
    if (n === 6) this.acc = 0;
  }

  resume() {
    this.acc = 0;
  }

  reset() {
    this.fade = 0;
    this.w.items.forEach((it) => (it.st = 'off'));
    this.w.bots.forEach((b, i) => {
      if (this.bench[b.st] === i) {
        b.asleep = true;
        b.seat = 7;
        b.pose = 'sit';
      }
      snapHome(b, this.L);
    });
    this.main = -1;
    this.later.length = 0;
    this.glove = this.gTop;
    this.timer = -1;
    this.startLoop();
  }

  upkeep(dt: number) {
    const { bots, items } = this.w;
    const target = this.main >= 0 && items[this.main].st !== 'off' ? items[this.main] : undefined;
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (b.role === 'human') {
        const s = this.L.stations[b.st];
        b.p[3].x = s.x;
        b.p[3].y = s.y - 32 + this.press * 4.5;
        continue;
      }
      if (b.crash) this.smash(i, 1.6);
      if (b.bump) ragdoll(b);
      if (b.mode === 'rag') {
        b.dizzy = Math.max(0, b.dizzy - dt);
        const grabbed = this.w.gk === 1 && this.w.gi === i;
        let v = 0;
        for (let k = 0; k < 5; k++) v = Math.max(v, speed(b.p[k]));
        b.slow = !grabbed && v < 8 ? b.slow + dt : 0;
        if ((b.slow > 0.25 && b.dizzy <= 0) || (!grabbed && b.mt > 5)) {
          settle(b, this.L);
          if (b.f !== b.homeF || b.mt > 5) this.poofBot(i);
        }
      } else if (b.mode === 'broken' && b.mt > this.mendAt[i]) mendBot(b, this.L);
      else if (b.mode === 'mend' && (mended(b) || b.mt > 1.2)) {
        snapHome(b, this.L);
        b.flash = 0.32;
        this.ring(b.p[2].x, b.p[2].y, 4, 18, 0.5, this.C.holo);
      }
      if (b.mode !== 'kin') continue;
      b.glow = this.hover === i ? 1 : 0;
      const near = Math.hypot(this.px - b.x, this.py - b.p[1].y) < 90;
      b.lookX = near ? this.px : target ? target.x : b.x + b.dir * 40;
      b.lookY = near ? this.py : target ? target.y : b.p[2].y;
      if (b.gate > 0 && this.actor !== i) b.gate = Math.max(0, b.gate - dt * 3);
      if (b.role === 'thinker' && this.actor !== i) b.halo = Math.max(0, b.halo - dt * 2);
      poseBot(b, this.L, this.time, dt);
    }
    this.gagIn -= dt;
    if (this.gagIn <= 0) this.gag();
    this.zIn -= dt;
    if (this.zIn <= 0) {
      this.zIn = 1.4;
      for (let i = 0; i < bots.length; i++) {
        const b = bots[i];
        if (b.asleep && b.mode === 'kin') this.glyph(b.p[2].x + 6, b.p[2].y - 6, 'z', this.C.muted, 1.4, -14);
      }
    }
    this.press = Math.max(0, this.press - dt * 3);
    this.buzz = Math.max(0, this.buzz - dt);
    this.pill = Math.max(0, this.pill - dt);
    this.wiggle = Math.max(0, this.wiggle - dt);
    const c = this.cues[this.ci];
    if (!c || c.kind !== 'ask' || this.ph >= 4) this.glove = Math.max(this.gTop, this.glove - dt * 260);
    for (let i = 0; i < this.chomp.length; i++) this.chomp[i] = Math.max(0, this.chomp[i] - dt);
  }

  gag() {
    this.gagIn = 2 + this.rnd() * 2;
    const { bots } = this.w;
    const i = Math.floor(this.rnd() * bots.length);
    const b = bots[i];
    if (!intact(b) || b.asleep || b.role === 'human' || this.actor === i || b.held >= 0) return;
    const r = this.rnd();
    if (r < 0.4) b.blinkIn = 0;
    else if (r < 0.75) {
      b.hop = 0.35;
      b.hopH = 6;
    } else {
      b.leanT = 0.22 * (this.rnd() < 0.5 ? -1 : 1);
      this.at(0.8, () => void (b.leanT = 0));
    }
  }

  sneeze() {
    const { bots } = this.w;
    const i = Math.floor(this.rnd() * this.L.stations.length);
    const b = bots[i];
    const n = bots.find((o, j) => j !== i && o.f === b.f && o.role !== 'human' && Math.abs(o.x - b.x) < this.L.pitch * 1.2 && intact(o));
    if (!intact(b) || b.role === 'human' || !n || this.actor === bots.indexOf(n)) return;
    b.hop = 0.3;
    b.hopH = 5;
    this.glyph(b.p[2].x, b.p[2].y - 14, '!', this.C.text, 0.8, -20);
    ragdoll(n);
    setVel(n.p[2], Math.sign(n.x - b.x) * 90, -120);
  }
  // #endregion

  // #region Cues
  cue(dt: number) {
    const c = this.cues[this.ci];
    if (!c || this.fade > 0) return;
    this.pt += dt;
    let done = false;
    if (c.kind === 'ring') done = this.cueRing(c);
    else if (c.kind === 'rain') done = this.cueRain(c);
    else if (c.kind === 'ask') done = this.cueAsk(c, dt);
    else if (c.kind === 'station') done = this.cueStation(c, dt);
    else if (this.pt > 0.8 * this.tempo) {
      if (this.first(1)) this.clearFloor();
      done = this.pt > 1.1 * this.tempo;
    }
    if (!done) return;
    this.ci++;
    if (this.ci >= this.cues.length) this.startLoop();
    else this.enter();
  }

  next(to: number) {
    this.ph = to;
    this.pt = 0;
    this.once = 0;
  }

  cueRing(c: TCue) {
    const b = this.w.bots[c.st];
    const T = this.tempo;
    if (this.ph === 0) {
      if (this.first(1)) {
        this.say(c.st, c.log);
        if (intact(b)) b.ring = 0.6 * T;
        this.w.bots.forEach((o) => {
          if (!o.away) return;
          o.x = o.homeX > this.L.W / 2 ? this.L.W + 30 : -30;
          o.tx = o.homeX;
          o.away = false;
          o.vmax = 140;
        });
      }
      if (this.pt < 0.6 * T) return false;
      if (c.next < 0 || this.cues[this.ci + 1]?.kind === 'rain') return true;
      const it = this.spawn(b.x, -12);
      this.main = it;
      this.fly(it, c.st, this.w.items[it].x, -12, 0.5 * T);
      this.next(1);
      return false;
    }
    if (this.ph === 1) {
      if (this.receive(c.st, false)) this.next(2);
      return false;
    }
    return this.pitch(c);
  }

  cueRain(c: TCue) {
    const { bots, items } = this.w;
    const b = bots[c.st];
    const T = this.tempo;
    if (this.ph === 0 && this.first(1)) {
      this.say(c.st, c.log);
      this.rain.length = 0;
      this.caught = 0;
      this.main = -1;
      b.pose = 'carry';
      b.led = 'work';
    }
    if (this.ph === 0) {
      while (this.rain.length < this.rainN && this.pt > this.rain.length * 0.09) {
        const it = this.spawn(b.homeX + (this.rnd() - 0.5) * 30, -12);
        setVel(items[it], (this.rnd() - 0.5) * 80, 0);
        this.rain.push(it);
      }
      this.pingIn -= this.dt;
      if (this.pingIn <= 0) {
        this.pingIn = 0.3;
        this.ring(b.p[4].x, b.p[4].y, 2, 16, 0.5, this.C.k.source);
      }
      if (!intact(b)) {
        this.wait += this.dt;
        if (this.wait > 4) this.poofBot(c.st);
        return false;
      }
      const hp = holdPoint(b);
      const hx = hp.x;
      const hy = hp.y;
      let low: TThing | undefined;
      for (let r = 0; r < this.rain.length; r++) {
        const idx = this.rain[r];
        const it = items[idx];
        if (it.st !== 'free') continue;
        if (!low || it.y > low.y) low = it;
        const grab = this.pt > 1.2 * T;
        if (grab) {
          it.x += (hx - it.x) * 0.2;
          it.y += (hy - it.y) * 0.2;
          it.px = it.x;
          it.py = it.y;
        }
        if (Math.hypot(it.x - hx, it.y - hy) < 12 || (it.still > 0.2 && Math.abs(it.x - b.x) < 8) || (grab && this.pt > 1.45 * T)) this.absorb(idx, c.st);
      }
      b.tx = low ? clamp(low.x, b.homeX - 0.4 * this.L.pitch, b.homeX + 0.4 * this.L.pitch) : b.homeX;
      if (this.rain.length < this.rainN || low || this.main < 0) return false;
      b.tx = b.homeX;
      b.pose = 'hold';
      this.next(1);
      return false;
    }
    if (this.ph === 1) {
      if (this.receive(c.st, true)) this.next(2);
      return false;
    }
    if (this.pt < 0.2) return false;
    return this.pitch(c);
  }

  absorb(idx: number, bi: number) {
    const it = this.w.items[idx];
    this.caught++;
    if (this.main < 0 || this.w.items[this.main].st === 'off') {
      this.main = idx;
      this.pick(idx, bi);
      return;
    }
    it.st = 'off';
    this.w.items[this.main].n++;
    this.w.items[this.main].squash = 0.09;
  }

  cueStation(c: TCue, dt: number) {
    const b = this.w.bots[c.st];
    if (this.ph === 0) {
      if (!this.receive(c.st, true)) return false;
      // a crashing model never gets to claim its success log; the pop announces the fallback instead
      if (!c.crash) this.say(c.st, c.log);
      b.led = 'work';
      this.next(1);
      return false;
    }
    if (this.ph === 1) {
      if (!c.crash && !this.hold(this.actor)) return false;
      if (!(c.crash ? this.crash(c, dt) : this.beat(c, b, dt))) return false;
      this.branches(c);
      this.next(2);
      return false;
    }
    // the main item waits for the first branch landing so its log gets the caption first
    if (c.step?.branches && !this.landed && this.pt < 0.7 * this.tempo) return false;
    b.led = b.asleep ? 'sleep' : 'idle';
    if (c.last || this.thrown) return true;
    return this.pitch(c);
  }

  pitch(c: TCue) {
    if (c.next < 0) return true;
    if (this.main < 0 || this.w.items[this.main].st !== 'held' || this.w.items[this.main].holder !== this.actor) {
      if (this.actor >= 0 && this.w.bots[this.actor].role !== 'human' && !this.hold(this.actor)) return false;
      if (this.main < 0) return true;
    }
    this.throwMain(this.actor, c.next, true);
    const b = this.w.bots[this.actor];
    if (b.role !== 'human') b.pose = b.role === 'bouncer' ? 'cross' : b.asleep ? 'sit' : 'idle';
    return true;
  }

  beat(c: TCue, b: TBot, dt: number) {
    const T = this.tempo;
    const t = this.pt;
    const it = this.w.items[this.main];
    if (b.role === 'bouncer') {
      b.pose = 'hold';
      b.tilt = t < 0.45 * T ? Math.sin(t * 14) * 0.3 : 0;
      if (c.kick && it.n > 1 && t > 0.45 * T && this.first(1)) this.kick(c.st);
      const g0 = (c.kick ? 0.7 : 0.45) * T;
      b.gate = clamp((t - g0) / (0.2 * T), 0, 1);
      return t > g0 + 0.25 * T;
    }
    if (b.role === 'thinker') {
      b.pose = 'think';
      b.halo = Math.min(1, t / (0.3 * T));
      const dur = 0.75 * T * this.jitter;
      if (t < dur) return false;
      if (this.first(1)) {
        it.score = this.rnd() < 0.5 ? 9 : 10;
        b.flash = 0.32;
        b.halo = 0.4;
        b.hop = 0.35;
        b.hopH = 6;
        b.pose = 'hold';
      }
      return t > dur + 0.3;
    }
    if (b.role === 'courier') {
      b.pose = 'carry';
      if (!c.last) {
        if (this.first(1)) this.ring(b.p[2].x, b.p[2].y - 6, 6, 22, 0.35 * T, this.C.k.output);
        return t > 0.4 * T;
      }
      if (t < 0.4 * T) {
        b.roll -= dt * 25;
        if (this.first(1)) for (let i = 0; i < 4; i++) this.puff(b.x - b.dir * (6 + i * 3), b.p[0].y + 2, 2);
        return false;
      }
      if (this.first(2)) {
        b.away = true;
        b.vmax = 320;
        b.tx = b.homeX > this.L.W / 2 ? this.L.W + 40 : -40;
      }
      if (b.x > -30 && b.x < this.L.W + 30 && t < 3) return false;
      it.st = 'off';
      b.held = -1;
      b.pose = 'idle';
      return true;
    }
    b.pose = 'hold';
    if (c.last && t > 0.35 * T && this.first(1)) b.clip++;
    return t > 0.4 * T;
  }

  kick(st: number) {
    const { items, bots } = this.w;
    const b = bots[st];
    const main = items[this.main];
    main.n--;
    const idx = this.spawn(main.x, main.y);
    const it = items[idx];
    const out = main.x < this.L.W / 2 ? -1 : 1;
    it.nw = true;
    setVel(it, 260 * out, -200);
    it.spin = 10 * out;
    b.kick = 0.18;
  }

  // Loop 1 and every third loop after: the model falls over, the fallback carries the item on.
  crash(c: TCue, dt: number) {
    const { bots, items } = this.w;
    const b = bots[c.st];
    const T = this.tempo;
    const t = this.pt;
    const it = items[Math.max(0, this.main)];
    const via = this.bench[c.st];
    if (this.ph === 1 && !(this.once & 4)) {
      if (t < 0.4 * T) {
        b.pose = 'think';
        b.halo = this.rnd();
        b.led = Math.floor(t * 10) % 2 ? 'alarm' : 'work';
        return false;
      }
      if (t < 1.0 * T) {
        b.shake = (2.5 * (t - 0.4 * T)) / (0.6 * T);
        if (t > 0.5 * T && this.first(1)) this.puff(b.p[1].x, b.p[1].y, 3);
        if (t > 0.8 * T && this.first(2)) this.puff(b.p[1].x, b.p[1].y, 3);
        return false;
      }
      this.once |= 4;
      b.shake = 0;
      this.drop(this.main);
      this.smash(c.st, 2.4);
      this.say(c.st, this.L.stations[c.st].node.fallback?.log ?? c.log, 2);
      if (via === undefined) {
        // no fallback bot: the blast itself delivers, unpriced
        it.dashed = true;
        if (c.next >= 0) this.fly(this.main, c.next, it.x, it.y, clamp(0.35 + Math.abs(bots[c.next].x - it.x) / 600, 0.35, 0.9) * T);
        this.thrown = true;
        return true;
      }
      setVel(it, (this.rnd() - 0.5) * 120, -220);
      const v = bots[via];
      v.asleep = false;
      v.seat = 0;
      v.led = 'work';
      v.pose = 'idle';
      v.hop = 0.35;
      v.hopH = 10;
      this.glyph(v.p[2].x, v.p[2].y - 12, '!', this.C.text, 0.9, -18);
      this.actor = via;
      this.pt = 0;
      return false;
    }
    if (via === undefined) return true;
    const v = bots[via];
    if (this.main < 0) {
      this.main = this.spawn(v.p[3].x, v.p[3].y);
      this.poofInto(this.main, via);
      return false;
    }
    if (it.st === 'held' && it.holder === via) {
      if (v.kind === 'output') {
        this.timerBot = via;
        if (this.timer < 0) this.timer = 0;
        this.timer += dt / (1.2 * T);
        if (this.timer < 1) return false;
      }
      this.timer = -1;
      this.at(0.2, () => this.benchHome(c.st));
      return true;
    }
    if (!intact(v)) {
      if (t > 4) this.poofBot(via);
      return false;
    }
    if (it.st === 'off' || (it.st === 'free' && floorOf(this.L, it.y) !== v.f) || t > 4) {
      this.poofInto(this.main, via);
      return false;
    }
    if (it.st === 'free') {
      v.tx = it.x - v.dir * 6;
      v.pose = 'reach';
      v.rx = it.x;
      v.ry = it.y;
      if (Math.abs(v.x - it.x) < 10 && it.y > v.p[1].y - 10) this.pick(this.main, via);
    }
    return false;
  }

  benchHome(st: number) {
    const v = this.w.bots[this.bench[st]];
    if (this.w.bots[st].mode !== 'kin' || v.held >= 0) return true;
    v.tx = v.homeX;
    v.pose = 'idle';
    if (Math.abs(v.x - v.homeX) > 2) return true;
    v.asleep = true;
    v.seat = 7;
    v.pose = 'sit';
    v.led = 'sleep';
  }

  branches(c: TCue) {
    c.step?.branches?.forEach((br, k) => {
      const pi = this.L.prop[br.to];
      if (pi === undefined) return;
      this.at(k * 0.18, () => {
        const { items, bots } = this.w;
        const b = bots[this.actor >= 0 ? this.actor : c.st];
        const main = this.main >= 0 ? items[this.main] : undefined;
        const real = this.real(br.to, br.tone) && main && main.n > 1;
        if (real) main.n--;
        const hp = holdPoint(b);
        const idx = this.spawn(hp.x, hp.y);
        const it = items[idx];
        it.copy = !real;
        it.tag = countOf(br.log);
        this.logOf[idx] = br.log;
        const p = this.L.props[pi];
        const shred = p.kind === 'shredder';
        if (shred) b.kick = 0.18;
        it.st = 'flight';
        it.prop = pi;
        it.aim = -1;
        it.ft = 0;
        it.thrower = c.st;
        it.tx = p.x;
        it.ty = shred ? p.y - 18 * PROP_SCALE : p.y + 5;
        it.T = clamp(0.35 + Math.hypot(it.tx - it.x, it.ty - it.y) / 600, 0.35, 0.7) * this.tempo;
        launch(it, it.tx, it.ty, it.T);
        it.spin = (this.rnd() - 0.5) * 12;
      });
    });
  }

  cueAsk(c: TCue, dt: number) {
    const ask = c.step?.ask;
    const T = this.tempo;
    const s = this.L.stations[c.st];
    if (!ask) return true;
    const pressY = s.y - 44;
    if (this.ph === 0) {
      if (!this.receive(c.st, true)) return false;
      this.say(c.st, ask.prompt);
      this.buzz = 0.4 * T;
      this.next(1);
      return false;
    }
    if (this.ph === 1) {
      const u = clamp((this.pt - 0.4 * T) / (0.45 * T), 0, 1);
      this.glove = this.gTop + (pressY - this.gTop) * (1 - (1 - u) * (1 - u));
      if (u < 1) return false;
      this.wiggle = this.rnd() < 0.25 ? 0.6 * T : 0;
      this.next(2);
      return false;
    }
    if (this.ph === 2) {
      if (this.pt < Math.max(0.25 * T, this.wiggle > 0 ? 0.6 * T : 0)) return false;
      this.next(3);
      return false;
    }
    const choice = ask.choices[this.choice];
    if (this.ph === 3) {
      if (this.first(1)) {
        this.press = 1;
        this.pill = 0.8 * T;
        this.pillText = choice.label;
        this.ring(s.x, s.y - 20, 6, 30, 0.6, this.C.human);
        this.say(c.st, choice.log);
      }
      this.glove = pressY + this.press * 4;
      if (this.pt < 0.8 * T) return false;
      this.next(4);
      return false;
    }
    void dt;
    if (choice.route.length) return this.pitch(c);
    const it = this.w.items[this.main];
    const shred = this.L.props.findIndex((p) => p.kind === 'shredder' && p.f === s.f && Math.abs(p.x - s.x) < 220);
    if (shred >= 0) {
      const p = this.L.props[shred];
      this.drop(this.main);
      it.st = 'flight';
      it.prop = shred;
      it.aim = -1;
      it.ft = 0;
      it.tx = p.x;
      it.ty = p.y - 18 * PROP_SCALE;
      it.T = 0.5 * T;
      launch(it, it.tx, it.ty, it.T);
    } else {
      this.puff(it.x, it.y, 4);
      it.st = 'off';
    }
    this.ci = this.cues.length - 2;
    return true;
  }

  // Tap on the pedestal during an ask takes the first choice right away.
  choose() {
    const c = this.cues[this.ci];
    if (!c || c.kind !== 'ask' || this.ph < 1 || this.ph > 2) return false;
    this.choice = 0;
    this.cues = [...this.cues.slice(0, this.ci + 1), ...this.hops(), this.cues[this.cues.length - 1]];
    this.link(this.cues);
    this.glove = this.L.stations[c.st].y - 44;
    this.next(3);
    return true;
  }

  clearFloor() {
    this.w.items.forEach((it, i) => {
      if (it.st === 'off' || it.st === 'flight') return;
      this.puff(it.x, it.y, 2);
      it.st = 'off';
      if (it.holder >= 0) this.w.bots[it.holder].held = -1;
      this.logOf[i] = '';
    });
    this.main = -1;
  }
  // #endregion

  // #region Items
  spawn(x: number, y: number) {
    const { items } = this.w;
    let idx = items.findIndex((it) => it.st === 'off');
    if (idx < 0) {
      let best = -1;
      items.forEach((it, i) => {
        if (i !== this.main && it.st === 'free' && (best < 0 || it.age > items[best].age)) best = i;
      });
      idx = best >= 0 ? best : (this.main + 1) % items.length;
    }
    const it = items[idx];
    place(it, x, y);
    Object.assign(it, { st: 'free', kind: itemOf(this.flow), n: 1, holder: -1, score: 0, dashed: false, copy: false, alpha: 1, squash: 0, a: 0, spin: 0, still: 0, nw: false, aim: -1, prop: -1, hatch: NaN, thrower: -1, tag: 0, age: 0, fling: false });
    this.logOf[idx] = '';
    return idx;
  }

  pick(idx: number, bi: number) {
    const it = this.w.items[idx];
    const b = this.w.bots[bi];
    if (it.holder >= 0 && it.holder !== bi) this.w.bots[it.holder].held = -1;
    it.st = 'held';
    it.holder = bi;
    it.squash = 0.09;
    it.fling = false;
    b.held = idx;
    if (b.role !== 'human') {
      b.pose = b.role === 'scout' && this.cues[this.ci]?.kind === 'rain' ? 'carry' : 'hold';
      b.tx = b.homeX;
    }
    if (this.w.gk === 2 && this.w.gi === idx) this.w.gk = 0;
  }

  drop(idx: number) {
    const it = this.w.items[idx];
    if (it.st !== 'held') return;
    const b = this.w.bots[it.holder];
    b.held = -1;
    it.st = 'free';
    it.holder = -1;
    it.still = 0;
    it.age = 0;
    const hand = b.p[3];
    setVel(it, (hand.x - hand.px) / H, (hand.y - hand.py) / H);
  }

  fly(idx: number, aim: number, x: number, y: number, T: number) {
    const it = this.w.items[idx];
    const L = this.L;
    const to = this.w.bots[aim];
    place(it, x, y);
    it.st = 'flight';
    it.aim = aim;
    it.prop = -1;
    it.ft = 0;
    it.hatch = NaN;
    const from = floorOf(L, y + 8);
    let tx = to.p[3].x;
    let ty = to.p[3].y - 5;
    if (to.f > from && y > 0) {
      const f = L.floors[from];
      tx = (Math.max(0, f.g0) + Math.min(L.W, f.g1)) / 2;
      ty = f.y - 6;
      it.hatch = f.y;
    }
    it.tx = tx;
    it.ty = ty;
    it.T = to.f < from ? 0.9 * this.tempo : T;
    launch(it, tx, ty, it.T);
  }

  throwMain(from: number, to: number, noise: boolean) {
    const it = this.w.items[this.main];
    const b = this.w.bots[from];
    const hp = holdPoint(b);
    const x = hp.x;
    const y = hp.y;
    this.drop(this.main);
    const dist = Math.hypot(this.w.bots[to].p[3].x - x, this.w.bots[to].p[3].y - y);
    this.fly(this.main, to, x, y, clamp(0.35 + dist / 600, 0.35, 0.9) * this.tempo);
    it.thrower = from;
    it.spin = (this.rnd() - 0.5) * 12;
    this.throws++;
    const vx = (it.x - it.px) / H;
    const sameFloor = this.w.bots[to].f === b.f;
    if (noise && sameFloor && this.throws === this.fumble) {
      // a fumble flies long with no homing, so the missed toss path plays out
      setVel(it, vx * 1.5, (it.y - it.py) / H);
      it.aim = -1;
    }
    else if (noise) setVel(it, vx * (1 + (this.rnd() - 0.5) * 0.12), (it.y - it.py) / H);
  }

  // Waits for the main item in this bot's hands; misses are fetched once, then poofed.
  receive(bi: number, fetch: boolean) {
    const { bots, items } = this.w;
    const b = bots[bi];
    const it = this.main >= 0 ? items[this.main] : undefined;
    if (it && it.st === 'held' && it.holder === bi) {
      this.fetcher = -1;
      return true;
    }
    if (b.role !== 'human' && !intact(b)) {
      this.wait += this.dt;
      if (this.wait > 4) this.poofBot(bi);
      return false;
    }
    if (!it || it.st === 'off') {
      this.main = this.spawn(b.p[3].x, b.p[3].y);
      this.poofInto(this.main, bi);
      return false;
    }
    if (this.pt > 5) {
      this.poofInto(this.main, bi);
      return false;
    }
    // an item leaning on a standing bot is nudged every substep and never sleeps, so slowness alone counts as settled
    this.calm = it.st === 'free' && speed(it) < 12 ? this.calm + this.dt : 0;
    if ((this.w.gk === 2 && items[this.w.gi] === it) || it.st === 'flight') return false;
    if (it.st === 'held') {
      const h = bots[it.holder];
      if (it.holder === this.fetcher && this.fetcher !== bi) {
        h.tx = h.homeX;
        if (Math.abs(h.x - h.homeX) < 3) {
          this.throwMain(this.fetcher, bi, false);
          h.pose = h.role === 'bouncer' ? 'cross' : 'idle';
          this.fetcher = -1;
        }
      } else if (it.holder !== this.fetcher && this.pt > 3) this.poofInto(this.main, bi);
      return false;
    }
    if (this.fetcher >= 0) {
      const f = bots[this.fetcher];
      if (!intact(f)) {
        this.fetcher = -1;
        return false;
      }
      f.tx = it.x - f.dir * 5;
      f.pose = 'reach';
      f.rx = it.x;
      f.ry = it.y;
      if (Math.abs(f.x - it.x) < 18 && it.y > f.p[1].y - 12) this.pick(this.main, this.fetcher);
      return false;
    }
    if (it.still < 0.25 && this.calm < 0.25) return false;
    const fl = floorOf(this.L, it.y);
    const th = it.thrower >= 0 ? bots[it.thrower] : undefined;
    if (fetch && !this.retried && th && th.role !== 'human' && intact(th) && th.f === fl) {
      this.fetcher = it.thrower;
      this.retried = true;
    } else if (fetch && b.role !== 'human' && b.f === fl) this.fetcher = bi;
    else this.poofInto(this.main, bi);
    return false;
  }

  // The cue's bot must be standing and holding; a visitor gets 4 s before it poofs home.
  hold(bi: number) {
    const b = this.w.bots[bi];
    if (bi < 0) return true;
    if (b.role !== 'human' && !intact(b) && !(b.away && b.held === this.main)) {
      this.wait += this.dt;
      this.pt -= this.dt;
      if (this.wait > 4) this.poofBot(bi);
      return false;
    }
    const it = this.main >= 0 ? this.w.items[this.main] : undefined;
    if (!it || it.st !== 'held' || it.holder !== bi) {
      this.actor = bi;
      this.next(this.recv);
      return false;
    }
    return true;
  }

  poofInto(idx: number, bi: number) {
    const it = this.w.items[idx];
    this.puff(it.x, it.y, 4);
    const b = this.w.bots[bi];
    if (it.st === 'off') it.st = 'free';
    this.pick(idx, bi);
    const hp = holdPoint(b);
    place(it, hp.x, hp.y);
    this.puff(hp.x, hp.y, 2);
  }

  poofBot(bi: number) {
    const b = this.w.bots[bi];
    this.puff(b.p[1].x, b.p[1].y, 4);
    if (this.w.gk === 1 && this.w.gi === bi) this.w.gk = 0;
    snapHome(b, this.L);
    this.wait = 0;
  }

  smash(bi: number, mend: number) {
    const b = this.w.bots[bi];
    if (b.held >= 0) this.drop(b.held);
    if (this.w.gk === 1 && this.w.gi === bi) this.w.gk = 0;
    if (breakBot(this.w, b, this.C.k[b.kind], this.L.compact ? 4 : 6)) this.mendAt[bi] = mend;
  }

  items(dt: number) {
    const { items, bots } = this.w;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.st === 'off') continue;
      it.squash = Math.max(0, it.squash - dt);
      if (it.st === 'held') {
        const b = bots[it.holder];
        if (b.role !== 'human' && b.mode !== 'kin') {
          this.drop(i);
          continue;
        }
        const hp = holdPoint(b);
        place(it, hp.x, hp.y);
        it.a *= 0.8;
        continue;
      }
      if (it.y > this.L.H + 60 || it.x < -80 || it.x > this.L.W + 80) it.st = 'off';
      if (it.st === 'flight' && it.aim >= 0) {
        const b = bots[it.aim];
        if (intact(b) && b.role !== 'human' && it.ft > it.T * 0.3) {
          b.pose = 'reach';
          b.rx = (b.p[3].x + it.x) / 2;
          b.ry = (b.p[3].y + it.y) / 2;
        }
      }
    }
  }

  detect() {
    const { items, bots } = this.w;
    const L = this.L;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.st === 'flight') {
        if (it.aim >= 0 && it.ft > 0.6 * it.T) {
          const b = bots[it.aim];
          if (b.role === 'human' || intact(b)) {
            const hp = holdPoint(b);
            if (Math.hypot(it.x - hp.x, it.y - hp.y) < 12) {
              this.pick(i, it.aim);
              continue;
            }
          }
        }
        if (it.prop >= 0 && it.ft > 0.6 * it.T && Math.hypot(it.x - it.tx, it.y - it.ty) < 10) {
          this.capture(i, it.prop);
          continue;
        }
        if (it.ft > it.T + 0.4) {
          it.st = 'free';
          it.still = 0;
          it.age = 0;
        }
      } else if (it.st === 'free' && it.y - it.py > 0 && (i !== this.main || it.tag)) {
        for (let k = 0; k < L.props.length; k++) {
          const p = L.props[k];
          const s = PROP_SCALE;
          const inTray = p.kind === 'tray' && Math.abs(it.x - p.x) < 10 * s && it.y > p.y && it.y < p.y + 14 * s;
          const inBin = p.kind === 'shredder' && Math.abs(it.x - p.x) < 9 * s && it.y > p.y - 24 * s && it.y < p.y - 10 * s;
          if (inTray || inBin) {
            this.capture(i, k);
            break;
          }
        }
      }
    }
  }

  capture(idx: number, pi: number) {
    const it = this.w.items[idx];
    const p = this.L.props[pi];
    const col = this.C.k[p.node.kind];
    this.glyph(p.x, p.kind === 'tray' ? p.y - 4 : p.y - 30, `+${it.tag || 1}`, col, 1.2, -10);
    if (this.logOf[idx]) this.say(p.st, this.logOf[idx]);
    this.landed = true;
    if (p.kind === 'shredder') {
      this.chomp[pi] = 0.4;
      for (let k = 0; k < 6; k++) {
        const d = this.w.strips.find((q) => q.life <= 0) ?? this.w.strips[k];
        place(d, p.x + (this.rnd() - 0.5) * 8, p.y - 14);
        setVel(d, (this.rnd() - 0.5) * 140, -120 - this.rnd() * 80);
        d.a = this.rnd() * 3;
        d.spin = (this.rnd() - 0.5) * 20;
        d.life = 1.6;
      }
    } else p.shown = Math.min(4, p.shown + 1);
    if (idx === this.main) this.main = -1;
    it.st = 'off';
    this.logOf[idx] = '';
  }
  // #endregion

  // #region Effects
  puff(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const p = take(this.w.puffs);
      p.x = x + (this.rnd() - 0.5) * 10;
      p.y = y + (this.rnd() - 0.5) * 6;
      p.r = 2 + this.rnd() * 3;
      p.t = 0;
      p.life = 0.9;
    }
  }

  ring(x: number, y: number, r0: number, r1: number, life: number, c: string) {
    const r: TRing = take(this.w.rings);
    r.x = x;
    r.y = y;
    r.r0 = r0;
    r.r1 = r1;
    r.t = 0;
    r.life = life;
    r.c = c;
  }

  glyph(x: number, y: number, text: string, c: string, life: number, vy: number) {
    const g = take(this.w.glyphs);
    g.x = x;
    g.y = y;
    g.text = text;
    g.c = c;
    g.t = 0;
    g.life = life;
    g.vy = vy;
  }

  fx(dt: number) {
    const w = this.w;
    for (let i = 0; i < w.puffs.length; i++) {
      const p = w.puffs[i];
      if (p.t >= p.life) continue;
      p.t += dt;
      p.y -= 30 * dt;
      p.r += 6 * dt;
    }
    for (let i = 0; i < w.sparks.length; i++) {
      const s = w.sparks[i];
      if (s.t >= s.life) continue;
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (let i = 0; i < w.rings.length; i++) if (w.rings[i].t < w.rings[i].life) w.rings[i].t += dt;
    for (let i = 0; i < w.glyphs.length; i++) {
      const g = w.glyphs[i];
      if (g.t >= g.life) continue;
      g.t += dt;
      g.y += g.vy * dt;
    }
    for (let i = 0; i < w.strips.length; i++) if (w.strips[i].life > 0) w.strips[i].life -= dt;
  }
  // #endregion

  // #region Draw
  draw(ctx: CanvasRenderingContext2D, statics: HTMLCanvasElement, labelsLive: boolean) {
    const { bots, items } = this.w;
    const L = this.L;
    const C = this.C;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = this.fade > 0 ? this.fade / 0.3 : 1;
    ctx.drawImage(statics, 0, 0);
    ctx.save();
    world(ctx);
    ctx.beginPath();
    ctx.rect(0, -400, L.W, L.H + 800);
    ctx.clip();
    const kind = itemOf(this.flow);
    for (let i = 0; i < L.props.length; i++) {
      const p = L.props[i];
      if (p.kind === 'tray') drawTray(ctx, p, kind, C);
      else if (p.kind === 'shredder') drawShredderLid(ctx, p, this.chomp[i] > 0 ? Math.abs(Math.sin(this.chomp[i] * 30)) : 0, C);
    }
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (b.role === 'bouncer') drawGate(ctx, b, C.k.rule, C);
      if (b.asleep && b.mode === 'kin') {
        ctx.globalAlpha = 0.7;
        drawBot(ctx, b, C, this.time);
        ctx.globalAlpha = 1;
      }
    }
    if (this.human >= 0) {
      const s = L.stations[this.human];
      drawHuman(ctx, s.x, s.y, this.press, this.gTop, this.gTop, 0, this.buzz, C, this.time);
    }
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (b.role !== 'human' && !(b.asleep && b.mode === 'kin')) drawBot(ctx, b, C, this.time);
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.st !== 'off') drawItem(ctx, it, it.x, it.y, C, this.fonts.digit, this.fonts.tagR, it.st === 'held' ? bots[it.holder].dir : 1);
    }
    this.drawFx(ctx);
    if (this.human >= 0 && this.glove > this.gTop) {
      const s = L.stations[this.human];
      drawHuman(ctx, s.x, s.y, this.press, this.glove, this.gTop, this.wiggle, 0, C, this.time);
      if (this.pill > 0) this.drawPill(ctx, s.x, s.y - 64);
    }
    if (this.timer >= 0) this.drawTimer(ctx);
    const c = this.cues[this.ci];
    if (labelsLive) {
      if (c && c.st >= 0) drawLabels(ctx, L, C, this.labels, this.fonts.label, c.st);
      if (this.hover >= 0 && this.hover < L.stations.length && (!c || this.hover !== c.st)) drawLabels(ctx, L, C, this.labels, this.fonts.label, this.hover);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawFx(ctx: CanvasRenderingContext2D) {
    const w = this.w;
    const C = this.C;
    world(ctx);
    ctx.fillStyle = C.text;
    for (let i = 0; i < w.puffs.length; i++) {
      const p = w.puffs[i];
      if (p.t >= p.life) continue;
      ctx.globalAlpha = 0.25 * (1 - p.t / p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    for (let i = 0; i < w.sparks.length; i++) {
      const s = w.sparks[i];
      if (s.t >= s.life) continue;
      ctx.strokeStyle = s.c;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }
    for (let i = 0; i < w.rings.length; i++) {
      const r = w.rings[i];
      if (r.t >= r.life) continue;
      const u = r.t / r.life;
      ctx.strokeStyle = r.c;
      ctx.globalAlpha = 1 - u;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * u, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = C.muted;
    for (let i = 0; i < w.strips.length; i++) {
      const d = w.strips[i];
      if (d.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, d.life);
      const c = Math.cos(d.a);
      const s = Math.sin(d.a);
      ctx.beginPath();
      ctx.moveTo(d.x - s * 3.5 - c, d.y + c * 3.5 - s);
      ctx.lineTo(d.x - s * 3.5 + c, d.y + c * 3.5 + s);
      ctx.lineTo(d.x + s * 3.5 + c, d.y - c * 3.5 + s);
      ctx.lineTo(d.x + s * 3.5 - c, d.y - c * 3.5 - s);
      ctx.fill();
    }
    ctx.font = this.fonts.glyph;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < w.glyphs.length; i++) {
      const g = w.glyphs[i];
      if (g.t >= g.life) continue;
      ctx.globalAlpha = Math.min(1, 2 * (1 - g.t / g.life));
      ctx.fillStyle = g.c;
      ctx.fillText(g.text, g.x, g.y);
    }
    ctx.globalAlpha = 1;
  }

  drawPill(ctx: CanvasRenderingContext2D, x: number, y: number) {
    world(ctx);
    ctx.font = this.fonts.glyph;
    const w = ctx.measureText(this.pillText).width + 10;
    ctx.fillStyle = this.C.bg;
    ctx.strokeStyle = this.C.human;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 7, w, 14, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.C.human;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.pillText, x, y + 0.5);
  }

  drawTimer(ctx: CanvasRenderingContext2D) {
    if (this.timerBot < 0) return;
    const v = this.w.bots[this.timerBot];
    const x = v.p[2].x;
    const y = v.p[2].y - 22;
    world(ctx);
    ctx.strokeStyle = this.C.human;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.timer));
    ctx.stroke();
    ctx.fillStyle = this.C.human;
    ctx.font = this.fonts.glyph;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('30 min', x, y - 14);
  }
  // #endregion

  // #region Still frame
  // Reduced motion: one composed frame that tells the whole story at once.
  compose() {
    const { bots, items } = this.w;
    const run = this.flow.run;
    const ask = run[run.length - 1].ask;
    this.loop = 0;
    this.cues = [];
    bots.forEach((b) => snapHome(b, this.L));
    items.forEach((it) => (it.st = 'off'));
    if (this.human >= 0) {
      const s = this.L.stations[this.human];
      this.main = this.spawn(s.x, s.y - 32);
      this.pick(this.main, this.human);
      place(items[this.main], s.x, s.y - 32);
      this.glove = s.y - 44;
      this.press = 0.3;
      this.pill = 1;
      this.pillText = ask?.choices[0].label ?? '';
    }
    const ai = this.L.stations.find((s) => s.node.kind === 'ai');
    if (ai) {
      const b = bots[ai.i];
      b.pose = 'hold';
      b.hx = 9;
      b.hy = -15;
      b.halo = 1;
      poseBot(b, this.L, 0, 1);
      const idx = this.spawn(0, 0);
      this.pick(idx, ai.i);
      items[idx].score = 10;
      const hp = holdPoint(b);
      place(items[idx], hp.x, hp.y);
    }
    let tags = 0;
    run.forEach((s) =>
      s.branches?.forEach((br) => {
        const pi = this.L.prop[br.to];
        if (pi === undefined) return;
        const p = this.L.props[pi];
        const g = this.w.glyphs[tags++ % this.w.glyphs.length];
        Object.assign(g, { x: p.x, y: p.kind === 'tray' ? p.y - 8 : p.y - 32, vy: 0, t: 0, life: Infinity, text: `+${countOf(br.log)}`, c: this.C.k[p.node.kind] });
        if (p.kind === 'tray') p.shown = 1;
        else {
          const idx = this.spawn(p.x, p.y - 16);
          items[idx].a = 0.3;
        }
      }),
    );
    bots.forEach((b) => {
      if (!b.asleep) return;
      const g = this.w.glyphs[tags++ % this.w.glyphs.length];
      Object.assign(g, { x: b.p[2].x + 7, y: b.p[2].y - 8, vy: 0, t: 0, life: Infinity, text: 'z', c: this.C.muted });
    });
    if (ask && this.human >= 0) {
      const s = this.L.stations[this.human].node;
      this.cap.textContent = `${String(this.human + 1).padStart(2, '0')} ${s.label.toUpperCase()} · ${ask.prompt}`;
    }
  }

  drawStill(ctx: CanvasRenderingContext2D, statics: HTMLCanvasElement) {
    this.draw(ctx, statics, false);
    ctx.save();
    this.L.stations.forEach((s) => drawLabels(ctx, this.L, this.C, this.labels, this.fonts.label, s.i));
    ctx.restore();
  }
  // #endregion

  // #region Input
  pick3(x: number, y: number, rad: number) {
    const { bots, items } = this.w;
    let best = rad;
    let kind = 0;
    let idx = -1;
    let sub = 1;
    bots.forEach((b, i) => {
      if (b.role === 'human' || b.mode === 'broken' || b.mode === 'mend' || b.away) return;
      for (let k = 1; k < 3; k++) {
        const d = Math.hypot(b.p[k].x - x, b.p[k].y - y) - 4 * b.s;
        if (d < best) {
          best = d;
          kind = 1;
          idx = i;
          sub = k;
        }
      }
    });
    items.forEach((it, i) => {
      if (it.st === 'off' || it.st === 'flight') return;
      const d = Math.hypot(it.x - x, it.y - y) - 3;
      if (d < best) {
        best = d;
        kind = 2;
        idx = i;
      }
    });
    if (!kind && this.human >= 0) {
      const s = this.L.stations[this.human];
      if (Math.hypot(s.x - x, s.y - 22 - y) < rad + 8) return { kind: 3, idx: this.human, sub: 0 };
    }
    return { kind, idx, sub };
  }

  grab(kind: number, idx: number, sub: number, x: number, y: number) {
    const w = this.w;
    w.gx = x;
    w.gy = y;
    if (kind === 1) {
      const b = w.bots[idx];
      if (b.held >= 0) this.drop(b.held);
      ragdoll(b);
      w.gk = 1;
      w.gi = idx;
      w.gp = sub;
      return;
    }
    const it = w.items[idx];
    let g = idx;
    if (it.n > 1) {
      it.n--;
      g = this.spawn(it.x, it.y - 6);
    } else if (it.st === 'held') this.drop(idx);
    w.items[g].still = 0;
    w.gk = 2;
    w.gi = g;
  }

  release(vx: number, vy: number) {
    const w = this.w;
    if (w.gk === 1) {
      const b = w.bots[w.gi];
      for (const q of b.p) setVel(q, vx, vy);
      b.dizzy = 0.9;
    } else if (w.gk === 2) {
      const it = w.items[w.gi];
      setVel(it, vx, vy);
      it.tag = 1;
      it.fling = true;
    }
    w.gk = 0;
  }

  poke(x: number, y: number, rad: number) {
    const hit = this.pick3(x, y, rad);
    const w = this.w;
    if (hit.kind === 3) {
      if (this.choose()) return;
    }
    if (hit.kind === 1) {
      const b = w.bots[hit.idx];
      if (b.held >= 0) this.drop(b.held);
      ragdoll(b);
      setVel(b.p[2], (this.rnd() - 0.5) * 120, -180);
      b.dizzy = 0.3;
      this.glyph(b.p[2].x, b.p[2].y - 14, '!', this.C.text, 0.8, -20);
      if (b.role === 'thinker') this.overload(hit.idx);
      return;
    }
    if (hit.kind === 2) {
      const it = w.items[hit.idx];
      if (it.st === 'held') this.drop(hit.idx);
      setVel(it, (this.rnd() - 0.5) * 80, -260);
      return;
    }
    this.ring(x, y, 2, 60, 0.4, this.C.holo);
    const push = (d: { x: number; y: number; px: number; py: number; still: number }) => {
      const dx = d.x - x;
      const dy = d.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 60) return;
      const v = 160 * (1 - dist / 60);
      d.px -= (dx / dist) * v * H;
      d.py -= ((dy / dist) * v + 60) * H;
      d.still = 0;
    };
    w.items.forEach((it) => it.st === 'free' && push(it));
    w.bots.forEach((b) => {
      if (b.mode === 'broken') b.parts.forEach(push);
      else if (b.mode === 'kin' && b.role !== 'human' && !b.asleep && Math.hypot(b.x - x, b.p[1].y - y) < 30) {
        if (b.held >= 0) this.drop(b.held);
        ragdoll(b);
        b.p.forEach(push);
      }
    });
    w.strips.forEach((d) => d.life > 0 && push(d));
  }

  // Three pokes inside 2 s overload a Thinker into its crash.
  overload(bi: number) {
    const b = this.w.bots[bi];
    b.pokes[b.pokeI] = this.time;
    b.pokeI = (b.pokeI + 1) % 3;
    if (b.pokes.some((t) => this.time - t > 2)) return;
    b.pokes.fill(-9);
    const c = this.cues[this.ci];
    if (c && c.kind === 'station' && c.st === bi && this.ph === 1 && !c.crash) {
      c.crash = true;
      this.next(1);
      b.mode = 'kin';
      return;
    }
    this.smash(bi, 2.4);
  }
  // #endregion
}

