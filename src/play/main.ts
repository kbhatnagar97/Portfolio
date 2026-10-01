import { botCalm, botPlace, botPost, botPre, makeBot, type TBot } from './bot';
import { bake, dropSprites, heldOf, paint, readPal, spriteOf, type TPal } from './paint';
import { H, MAX, calm, clear, enqueue, fit, foot, makeWorld, nudge, pick, place, step, trapdoor, wake, wakeNear, type TSpec, type TWorld } from './rigid';
import type { TPlayData, TTile } from './types';

// #region Types
type THost = {
  el: HTMLElement;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: TWorld;
  bt: TBot;
  band: string;
  key: string;
  want: string;
  specs: TSpec[];
  cap: string;
  vis: number;
  near: boolean;
  settled: boolean;
  left: number;
  dirty: boolean;
  redraw: boolean;
  cw: number;
  ch: number;
  qEnd: number;
  pid: number;
  cur: string;
  lx: number;
  ly: number;
  lt: number;
  ring: Float64Array;
  ri: number;
};
// #endregion

// #region Helpers
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const store = (set: boolean) => {
  try {
    if (set) localStorage.setItem('play-hinted', '1');
    return localStorage.getItem('play-hinted') === '1';
  } catch {
    return false;
  }
};
// #endregion

const boot = (data: TPlayData) => {
  const els = [...document.querySelectorAll<HTMLElement>('[data-play], [data-play-band]')];
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  const mql = matchMedia(data.mq);
  const fine = matchMedia('(pointer: fine)').matches;
  const perf = /[?&]playperf\b/.test(location.search);
  const cost = new Float32Array(240);
  if (perf) (window as unknown as { __playCost: Float32Array }).__playCost = cost;
  let ci = 0;
  let reduce = rmq.matches;
  let hinted = store(false);
  let P: TPal = readPal(els[0]);
  let dpr = Math.min(devicePixelRatio || 1, 2);
  let active: THost | null = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  const dropped = new Set<string>();
  const hosts: THost[] = [];
  for (const el of els) {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    if (!ctx) continue;
    el.append(cv);
    const band = el.dataset.playBand ?? '';
    hosts.push({
      el, cv, ctx, w: makeWorld(), bt: makeBot(band ? 0.9 : 1.4), band, key: '', want: band, specs: [], cap: '', vis: 0,
      near: false, settled: false, left: 0, dirty: true, redraw: false, cw: 0, ch: 0, qEnd: 0, pid: -1, cur: '', lx: 0, ly: 0, lt: 0,
      ring: new Float64Array(18), ri: 0,
    });
  }
  const rail = hosts.find((h) => !h.band) ?? null;

  // #region Scenes
  const tilesOf = (h: THost, key: string): TTile[] => {
    const set = data.sets[key];
    return !set ? [] : h.band ? (set.band ?? set.tiles) : set.tiles;
  };

  // Scales the tiles to the canvas: a short rail set grows until its pile reads, a long one shrinks so it never overflows.
  // A waved rail set is sized by its largest wave, since older waves are shed through the floor (w.cap) instead of shrinking every label.
  const specsOf = (h: THost, list: TTile[]) => {
    const w = h.w;
    const room = w.W * (w.Ht - 10);
    const waved = !h.band && list.some((t) => t.wave);
    w.cap = waved ? 0.6 : 0;
    const lo = waved ? 0.2 : 0.3;
    const hi = waved ? 0.25 : 0.4;
    let k = h.band ? 1 : Math.min(1.1, Math.max(0.8, w.W / 400));
    for (let pass = 0; pass < 3; pass++) {
      h.specs = list.map((t) => bake(P, t, Math.round(k * 100) / 100, !!h.band, dpr));
      const per = new Map<string, number>();
      let wide = 0;
      for (const s of h.specs) {
        const v = waved ? (s.tile.wave ?? '') : '';
        per.set(v, (per.get(v) ?? 0) + foot(s.hl, s.r));
        wide = Math.max(wide, 2 * (s.hl + s.r));
      }
      let area = per.get('') ?? 0;
      per.delete('');
      area += Math.max(0, ...per.values());
      if (!area) return;
      let next = area > hi * room ? k * Math.sqrt((hi * room) / area) : !h.band && area < lo * room ? k * Math.sqrt((lo * room) / area) : k;
      // rail labels stay at 10px or more
      next = Math.min(1.6, Math.max(h.band ? 0.6 : 0.85, next));
      if ((wide * next) / k > w.W - 24) next = (k * (w.W - 24)) / wide;
      if (Math.abs(next - k) < 0.02) return;
      k = next;
    }
  };

  // Newest dropped waves first (then, for a still, the rest in order) until the floor budget is spent.
  const fitted = (h: THost, all: boolean) => {
    const w = h.w;
    if (!w.cap) return all ? h.specs : h.specs.filter((s) => !s.tile.wave || dropped.has(h.key + '|' + s.tile.wave));
    const pre = h.key + '|';
    const order = [...dropped].filter((id) => id.startsWith(pre)).map((id) => id.slice(pre.length)).reverse();
    if (all) for (const s of h.specs) if (s.tile.wave && !order.includes(s.tile.wave)) order.push(s.tile.wave);
    let room = w.cap * w.W * (w.Ht - 10);
    const keep = new Set<string>(['']);
    for (const s of h.specs) if (!s.tile.wave) room -= foot(s.hl, s.r);
    for (const v of order) {
      let need = 0;
      for (const s of h.specs) if (s.tile.wave === v) need += foot(s.hl, s.r);
      if (need > room && keep.size > 1) break;
      keep.add(v);
      room -= need;
    }
    return h.specs.filter((s) => keep.has(s.tile.wave ?? ''));
  };

  const queue = (h: THost, list: TSpec[], seed: string) => {
    const w = h.w;
    const r = rng(hash(seed));
    let at = Math.max(w.t, h.qEnd);
    for (const sp of list) {
      const ext = sp.hl + sp.r;
      const span = w.W - 2 * ext - 16;
      at += 0.07;
      enqueue(w, sp, span > 0 ? ext + 8 + r() * span : w.W / 2, -2 * sp.r - r() * 120, (r() * 2 - 1) * 0.6, (r() * 2 - 1) * 2, at);
    }
    h.qEnd = at;
  };

  // Settles a still world a few ms per frame, so a set change never stalls the page for the whole settle.
  const settle = (h: THost) => {
    const w = h.w;
    const end = performance.now() + 4;
    for (let i = 0; i < h.specs.length && performance.now() < end; i++) spriteOf(P, h.specs[i], dpr);
    while (h.left > 0 && !calm(w) && performance.now() < end) {
      step(w);
      h.left--;
    }
    if (h.left > 0 && !calm(w)) return;
    h.left = 0;
    h.settled = true;
    h.redraw = true;
  };

  // Seeded shelf layout from the floor up, then a budgeted settle: used for still and offscreen worlds.
  const still = (h: THost) => {
    const w = h.w;
    clear(w);
    const r = rng(hash(h.key + h.band));
    const order = fitted(h, true);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const right = w.W - 8 - (h.bt.on ? 40 : 0);
    let x = 8 + r() * 12;
    let y = w.Ht - 10;
    let row = 0;
    for (const sp of order) {
      const ww = 2 * (sp.hl + sp.r);
      if (x + ww > right && x > 24) {
        x = 8 + r() * 12;
        y -= row + 2;
        row = 0;
      }
      place(w, sp, x + ww / 2, y - sp.r - 0.5, (r() - 0.5) * 0.04, 0, 0, 0);
      x += ww + 4 + r() * 10;
      row = Math.max(row, 2 * sp.r);
    }
    h.bt.walk = false;
    h.bt.pupil = 0;
    botPlace(w, h.bt, w.W - 26);
    h.settled = false;
    h.left = 600;
  };

  const enter = (h: THost) => {
    const w = h.w;
    const key = h.want;
    const set = data.sets[key];
    h.key = key;
    if (!set) return;
    const had = h.specs.length > 0;
    specsOf(h, tilesOf(h, key));
    h.cap = set.caption.toUpperCase();
    const on = h.band ? set.bot === true : set.bot !== false;
    if (on !== h.bt.on) {
      h.bt.on = on;
      botPlace(w, h.bt, w.W * 0.3);
    }
    h.bt.duty = 12;
    if (reduce || (h.band && h !== active)) {
      still(h);
      return;
    }
    if (had) trapdoor(w);
    h.qEnd = w.t;
    queue(h, h.band ? h.specs : fitted(h, false), key);
  };

  const dropWave = (key: string, wave: string) => {
    if (!rail || rail.key !== key || reduce || !rail.w.W) return;
    queue(rail, rail.specs.filter((s) => s.tile.wave === wave), key + wave);
    rail.bt.duty = 12;
    kick();
  };
  // #endregion

  // #region Loop
  const size = (h: THost) => {
    h.dirty = false;
    const d = Math.min(devicePixelRatio || 1, 2);
    if (d !== dpr) {
      dpr = d;
      dropSprites();
      for (const o of hosts) {
        o.specs = o.specs.map((s) => bake(P, s.tile, s.k, s.band, dpr));
        for (let i = 0; i < MAX; i++) {
          const b = o.w.b[i];
          if (b.on) b.sp = bake(P, b.sp.tile, b.sp.k, b.sp.band, dpr);
        }
      }
    }
    P = readPal(h.el);
    h.cv.width = Math.round(h.cw * dpr);
    h.cv.height = Math.round(h.ch * dpr);
    fit(h.w, h.cw, h.ch);
    if (h.bt.on) botPlace(h.w, h.bt, h.w.bot.x);
    h.redraw = true;
  };

  const ready = (h: THost) => {
    paint(h.ctx, h.w, P, dpr, h.cap, h.bt);
    h.redraw = false;
    if (!('ready' in h.el.dataset)) h.el.dataset.ready = '';
  };

  const tick = (h: THost) => {
    botPre(h.w, h.bt);
    // six quiet seconds after the last touch, drop, or scene change
    h.w.dz = h.bt.duty < 6;
    step(h.w);
    botPost(h.w, h.bt);
  };

  const frame = (now: number) => {
    raf = 0;
    let more = false;
    for (let i = 0; i < hosts.length; i++) {
      const h = hosts[i];
      if (h.dirty && h.cw > 0) size(h);
      if (!h.w.W) continue;
      if (h.want && h.want !== h.key && (h === active || !h.band || h.near)) enter(h);
      else if (h.band && h !== active && h.near && !h.settled && !h.left && h.key) still(h);
      if (!h.left) continue;
      if (h === active && !reduce) {
        h.left = 0;
        h.settled = true;
      } else {
        settle(h);
        if (h.left) more = true;
      }
    }
    const h = active;
    if (h && h.w.W && !reduce) {
      const t0 = performance.now();
      let dt = last ? (now - last) / 1000 : H;
      last = now;
      if (dt > 1 / 30) dt = 1 / 30;
      acc += dt;
      let n = 0;
      while (acc >= H && n < 4) {
        tick(h);
        acc -= H;
        n++;
      }
      if (n === 4) acc = 0;
      ready(h);
      if (perf) cost[ci++ % 240] = performance.now() - t0;
      if (h.vis > 0 && !document.hidden && !(calm(h.w) && botCalm(h.w, h.bt))) more = true;
    }
    for (let i = 0; i < hosts.length; i++) if (hosts[i].redraw && hosts[i].w.W) ready(hosts[i]);
    if (more) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  const kick = () => {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  };

  const choose = () => {
    let best: THost | null = null;
    if (mql.matches) best = rail && rail.vis > 0 ? rail : null;
    else for (const h of hosts) if (h.band && h.vis >= 0.5 && (!best || h.vis > best.vis)) best = h;
    if (best === active) return;
    if (active) release(active, false);
    active = best;
    last = 0;
    acc = 0;
    kick();
  };
  // #endregion

  // #region Pointer
  const cursor = (h: THost, c: string) => {
    if (h.cur === c) return;
    h.cur = c;
    h.cv.style.cursor = c;
  };

  const sample = (h: THost, t: number, x: number, y: number) => {
    const o = (h.ri++ % 6) * 3;
    h.ring[o] = t;
    h.ring[o + 1] = x;
    h.ring[o + 2] = y;
  };

  const release = (h: THost, fling: boolean) => {
    const w = h.w;
    const b = w.g;
    h.pid = -1;
    if (!b) return;
    w.g = null;
    b.vx = b.vy = 0;
    if (fling) {
      // 100ms window, so a pause just before release does not zero the fling
      const o = ((h.ri - 1) % 6) * 3;
      let k = o;
      for (let i = 1; i < Math.min(6, h.ri); i++) {
        const j = (((h.ri - 1 - i) % 6) + 6) % 6 * 3;
        if (h.ring[o] - h.ring[j] > 100) break;
        k = j;
      }
      const dt = (h.ring[o] - h.ring[k]) / 1000;
      if (dt > 0.004) {
        let vx = (h.ring[o + 1] - h.ring[k + 1]) / dt;
        let vy = (h.ring[o + 2] - h.ring[k + 2]) / dt;
        const m = Math.hypot(vx, vy);
        if (m > 2400) {
          vx *= 2400 / m;
          vy *= 2400 / m;
        }
        b.vx = vx;
        b.vy = vy;
      }
    }
    wake(b);
    kick();
  };

  const unhint = () => {
    if (hinted) return;
    store(true);
    hinted = true;
    for (const h of hosts) delete h.el.dataset.hint;
  };

  const slop = (e: PointerEvent) => (e.pointerType === 'mouse' ? 4 : 10);

  const bind = (h: THost) => {
    const cv = h.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (reduce || !h.w.W || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const b = pick(h.w, e.offsetX, e.offsetY, slop(e));
      if (!b) return;
      if (active !== h) {
        if (active) release(active, false);
        active = h;
        last = 0;
        acc = 0;
      }
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const w = h.w;
      const dx = e.offsetX - b.x;
      const dy = e.offsetY - b.y;
      const c = Math.cos(b.a);
      const s = Math.sin(b.a);
      w.g = b;
      w.gx = dx * c + dy * s;
      w.gy = -dx * s + dy * c;
      w.px = e.offsetX;
      w.py = e.offsetY;
      h.pid = e.pointerId;
      h.ri = 0;
      sample(h, e.timeStamp, e.offsetX, e.offsetY);
      heldOf(P, b.sp, dpr);
      wake(b);
      wakeNear(w, b);
      h.bt.duty = 12;
      cursor(h, 'grabbing');
      unhint();
      kick();
    });
    cv.addEventListener('pointermove', (e) => {
      const w = h.w;
      if (reduce) return;
      if (h.pid === e.pointerId) {
        w.px = e.offsetX;
        w.py = e.offsetY;
        sample(h, e.timeStamp, e.offsetX, e.offsetY);
        return;
      }
      if (e.pointerType !== 'mouse' || e.buttons) return;
      h.bt.over = true;
      h.bt.ox = e.offsetX;
      const dt = (e.timeStamp - h.lt) / 1000;
      if (dt > 0 && dt < 0.1 && h === active) {
        const vx = (e.offsetX - h.lx) / dt;
        const vy = (e.offsetY - h.ly) / dt;
        if (vx * vx + vy * vy > 40000 && nudge(w, e.offsetX, e.offsetY, vx, vy)) kick();
      }
      h.lx = e.offsetX;
      h.ly = e.offsetY;
      h.lt = e.timeStamp;
      cursor(h, pick(w, e.offsetX, e.offsetY, 4) ? 'grab' : '');
    });
    const up = (e: PointerEvent) => {
      if (h.pid !== e.pointerId) return;
      release(h, e.type === 'pointerup');
      cursor(h, e.pointerType === 'mouse' && pick(h.w, e.offsetX, e.offsetY, 4) ? 'grab' : '');
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => {
      h.bt.over = false;
      if (h.pid < 0) cursor(h, '');
    });
    // Only a touch that lands on a tile is ours; everything else scrolls the page.
    cv.addEventListener(
      'touchstart',
      (e) => {
        if (reduce || !h.w.W) return;
        const t = e.touches[0];
        const r = cv.getBoundingClientRect();
        if (t && pick(h.w, t.clientX - r.left, t.clientY - r.top, 10)) e.preventDefault();
      },
      { passive: false },
    );
  };
  hosts.forEach(bind);

  // A tile that its text chip names hops when the chip is hovered.
  const hop = (e: Event) => {
    const label = (e.currentTarget as HTMLElement).dataset.playTile;
    const h = active;
    if (!h || reduce || !label) return;
    const now = performance.now();
    for (let i = 0; i < MAX; i++) {
      const b = h.w.b[i];
      if (b.on !== 1 || b.sp.tile.t !== label || now - b.hop < 600) continue;
      b.hop = now;
      b.vy = Math.min(b.vy, 0) - 380;
      b.w += Math.random() < 0.5 ? -4 : 4;
      wake(b);
      wakeNear(h.w, b);
      h.bt.duty = 12;
      kick();
    }
  };
  for (const el of document.querySelectorAll<HTMLElement>('[data-play-tile]')) el.addEventListener('pointerenter', hop);
  // #endregion

  // #region Observers
  const ro = new ResizeObserver((entries) => {
    for (const en of entries) {
      const h = hosts.find((o) => o.el === en.target);
      if (!h) continue;
      h.cw = en.contentRect.width;
      h.ch = en.contentRect.height;
      h.dirty = true;
    }
    kick();
  });
  const seen = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const h = hosts.find((o) => o.el === en.target);
        if (h) h.vis = en.isIntersecting ? en.intersectionRatio || 0.01 : 0;
      }
      choose();
    },
    { threshold: [0, 0.5, 1] },
  );
  const near = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const h = hosts.find((o) => o.el === en.target);
        if (h) h.near = en.isIntersecting;
      }
      kick();
    },
    { rootMargin: '200px 0px' },
  );
  for (const h of hosts) {
    ro.observe(h.el);
    seen.observe(h.el);
    if (h.band) near.observe(h.el);
  }

  // The root reaches far above the viewport, so "intersecting" means above the reading line: a long jump past a wave still flips it.
  const waves = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        const key = el.closest<HTMLElement>('[data-play-set]')?.dataset.playSet ?? '';
        const id = key + '|' + (el.dataset.playWave ?? '');
        waves.unobserve(el);
        if (dropped.has(id)) continue;
        dropped.add(id);
        dropWave(key, el.dataset.playWave ?? '');
      }
    },
    { rootMargin: '100000px 0px -35% 0px' },
  );
  for (const el of document.querySelectorAll('[data-play-wave]')) waves.observe(el);

  const sets = [...document.querySelectorAll<HTMLElement>('[data-play-set]')];
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')];
  const marks = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  let toc = -1;
  let timer = 0;
  const crossed = (list: (HTMLElement | null)[]) => {
    const line = innerHeight * 0.45;
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (el && el.getBoundingClientRect().top <= line) k = i;
    }
    return k;
  };
  const follow = (now: boolean) => {
    const i = crossed(marks);
    if (links.length && i !== toc) {
      toc = i;
      links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
    if (!rail || !sets.length) return;
    const key = sets[crossed(sets)].dataset.playSet ?? '';
    clearTimeout(timer);
    const go = () => {
      if (rail.want === key) return;
      rail.want = key;
      kick();
    };
    if (now) go();
    else timer = window.setTimeout(go, 250);
  };
  const line = new IntersectionObserver(() => follow(false), { rootMargin: '0px 0px -55% 0px' });
  for (const el of new Set([...sets, ...marks])) if (el) line.observe(el);
  follow(true);

  // #endregion

  // #region Environment
  const hint = () => {
    for (const h of hosts) {
      if (reduce || hinted) delete h.el.dataset.hint;
      else h.el.dataset.hint = fine ? 'Drag and fling' : 'Touch a tile to throw it';
    }
  };
  hint();
  rmq.addEventListener('change', () => {
    reduce = rmq.matches;
    hint();
    for (const h of hosts) {
      release(h, false);
      cursor(h, '');
      h.key = '';
      h.settled = false;
    }
    kick();
  });
  mql.addEventListener('change', choose);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    last = 0;
    acc = 0;
    kick();
  });
  // #endregion
};

const start = async () => {
  let data: TPlayData;
  try {
    data = JSON.parse(document.getElementById('play-data')?.textContent ?? '');
  } catch {
    return;
  }
  if (!data || data.v !== 1 || !data.sets || !document.querySelector('[data-play], [data-play-band]')) return;
  const f = document.fonts;
  await Promise.race([
    Promise.all([f.load('500 12px "Geist Mono"'), f.load('italic 400 24px "Instrument Serif"'), f.load('500 13px "Geist"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => undefined);
  boot(data);
};

if ('requestIdleCallback' in window) requestIdleCallback(() => void start(), { timeout: 1500 });
else setTimeout(() => void start(), 200);
