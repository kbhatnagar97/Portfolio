import { useEffect, useRef } from 'react';
import type { ICrew } from '../data';
import { gsap, reducedMotion } from '../smooth';
import type { BotWorld } from './director';
import { routeOf, sizeOf } from './geometry';
import '../bots.scss';

// #region Pointer
type TDown = { id: number; cx: number; cy: number; t: number; kind: number; idx: number; sub: number; touch: boolean; grab: boolean; moved: number };
const SAMPLES = 5;
// #endregion

// A small physics crew acting out the workflow; the canvas is decorative, the Launch button is the keyboard path.
export const BotFloor = ({ flow }: { flow: ICrew }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cap = capRef.current;
    const screen = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    const statics = document.createElement('canvas');
    const sctx = statics.getContext('2d');
    if (!canvas || !cap || !screen || !ctx || !sctx) return;

    // #region Engine
    // the engine is its own chunk, fetched when the card first nears the viewport
    let mod: typeof import('./director') | undefined;
    let loading = false;
    let bw: BotWorld | undefined;
    let still = reducedMotion();
    let locked = document.documentElement.classList.contains('is-locked');
    let visible = false;
    let running = false;
    let disposed = false;
    let last = 0;
    let cssW = 0;
    let cssH = 0;
    let scale = 1;
    let ox = 0;
    let oy = 0;
    let dpr = 1;
    let ms = 0;
    let frames = 0;
    let cursor = '';
    let lastScroll = -1e9;
    let down: TDown | undefined;
    const samples = new Float64Array(SAMPLES * 3);
    let sn = 0;

    const view = () => mod?.setView(dpr * scale, dpr * ox, dpr * oy, bw?.L.compact ? 0.6 : 1);

    const stations = routeOf(flow).length;
    let ar = '';
    // written before the engine chunk loads, so the screen has its final height before it nears the viewport
    const aspect = () => {
      const { W, H } = sizeOf(stations, cssW < 480);
      const next = `${W} / ${H}`;
      if (next === ar) return;
      ar = next;
      screen.style.setProperty('--bots-ar', ar);
    };
    const fit = () => {
      cssW = screen.clientWidth;
      if (!cssW) return;
      const compact = cssW < 480;
      aspect();
      cssH = screen.clientHeight;
      if (!bw || !mod || !cssH) return;
      if (bw.L.compact !== compact) bw = new mod.BotWorld(flow, compact, mod.readPalette(screen), cap);
      const { W, H } = bw.L;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = statics.width = Math.round(cssW * dpr);
      canvas.height = statics.height = Math.round(cssH * dpr);
      scale = Math.min(cssW / W, cssH / H);
      ox = (cssW - W * scale) / 2;
      oy = (cssH - H * scale) / 2;
      view();
      bw.setFonts(sctx, scale);
      bw.drawStatic(sctx);
      if (still) {
        bw.compose();
        bw.drawStill(ctx, statics);
      } else if (!running) bw.draw(ctx, statics, true);
    };

    const build = () => {
      if (!mod) return;
      cssW = screen.clientWidth;
      bw = new mod.BotWorld(flow, cssW < 480, mod.readPalette(screen), cap);
      fit();
    };

    const load = () => {
      if (loading) return;
      loading = true;
      import('./director').then((m) => {
        if (disposed) return;
        mod = m;
        build();
        sync();
      });
    };

    const tick = () => {
      if (!bw) return;
      const now = performance.now();
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      view();
      bw.frame(dt);
      bw.draw(ctx, statics, true);
      if (import.meta.env.DEV) {
        ms += performance.now() - now;
        if (++frames === 60) {
          canvas.dataset.ms = (ms / 60).toFixed(3);
          ms = 0;
          frames = 0;
        }
      }
    };

    const sync = () => {
      // the full screen lab covers the cards, so they rest while it is open
      const want = visible && !document.hidden && !locked && !still && !!bw;
      if (want && !running) {
        last = 0;
        bw?.resume();
        gsap.ticker.add(tick);
        running = true;
      } else if (!want && running) {
        gsap.ticker.remove(tick);
        running = false;
      }
    };
    // #endregion

    // #region Observers
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) load();
        sync();
      },
      { rootMargin: '120px 0px' },
    );
    io.observe(screen);
    cssW = screen.clientWidth;
    if (cssW) aspect();
    let raf = 0;
    // a frame later, because a new aspect ratio resizes the observed screen and WebKit reports that as a loop
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(screen);
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      still = mq.matches;
      if (bw) build();
      else if (still) load();
      sync();
    };
    const mo = new MutationObserver(() => {
      locked = document.documentElement.classList.contains('is-locked');
      sync();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    mq.addEventListener('change', onMotion);
    const onVisibility = () => sync();
    document.addEventListener('visibilitychange', onVisibility);
    const onScroll = () => (lastScroll = performance.now());
    window.addEventListener('scroll', onScroll, { passive: true });
    document.fonts?.ready.then(() => !disposed && fit());
    if (still) load();
    // #endregion

    // #region Input
    const toWorld = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale];
    };
    const setCursor = (c: string) => {
      if (c === cursor) return;
      cursor = c;
      canvas.style.cursor = c;
    };
    const sample = (x: number, y: number) => {
      const k = (sn++ % SAMPLES) * 3;
      samples[k] = x;
      samples[k + 1] = y;
      samples[k + 2] = performance.now();
    };
    // Release speed from the last 80 ms of pointer samples.
    const fling = () => {
      const now = performance.now();
      let ax = 0;
      let ay = 0;
      let at = 0;
      let bx = 0;
      let by = 0;
      let bt = -1;
      for (let i = 0; i < SAMPLES; i++) {
        const t = samples[i * 3 + 2];
        if (now - t > 80 || !t) continue;
        if (bt < 0 || t < at) [ax, ay, at] = [samples[i * 3], samples[i * 3 + 1], t];
        if (bt < 0 || t > bt) [bx, by, bt] = [samples[i * 3], samples[i * 3 + 1], t];
      }
      const dt = (bt - at) / 1000;
      if (bt < 0 || dt < 0.008) return [0, 0];
      let vx = (bx - ax) / dt;
      let vy = (by - ay) / dt;
      const v = Math.hypot(vx, vy);
      if (v > 1400) {
        vx *= 1400 / v;
        vy *= 1400 / v;
      }
      return [vx, vy];
    };
    const drop = (e: PointerEvent, velocity: boolean) => {
      if (!down || !bw) return;
      if (down.grab) {
        const [vx, vy] = velocity ? fling() : [0, 0];
        bw.release(vx, vy);
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      }
      down = undefined;
      setCursor(still ? '' : 'grab');
    };

    const onDown = (e: PointerEvent) => {
      if (!bw || still) return;
      const touch = e.pointerType !== 'mouse';
      const [x, y] = toWorld(e);
      const hit = bw.pick3(x, y, (touch ? 22 : 16) / scale);
      down = { id: e.pointerId, cx: e.clientX, cy: e.clientY, t: performance.now(), kind: hit.kind, idx: hit.idx, sub: hit.sub, touch, grab: false, moved: 0 };
      samples.fill(0);
      sample(x, y);
      if (!touch && (hit.kind === 1 || hit.kind === 2)) e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!bw || still) return;
      const [x, y] = toWorld(e);
      if (e.pointerType === 'mouse' && !down) {
        const hit = bw.pick3(x, y, 16 / scale);
        bw.px = x;
        bw.py = y;
        bw.hover = hit.kind === 1 ? hit.idx : -1;
        setCursor(hit.kind === 1 || hit.kind === 2 ? 'grab' : hit.kind === 3 ? 'pointer' : '');
      }
      if (!down || e.pointerId !== down.id) return;
      sample(x, y);
      const dx = e.clientX - down.cx;
      const dy = e.clientY - down.cy;
      down.moved = Math.max(down.moved, Math.hypot(dx, dy));
      if (down.grab) {
        bw.w.gx = x;
        bw.w.gy = y;
      } else if (down.moved > 6 && (down.kind === 1 || down.kind === 2) && (!down.touch || Math.abs(dx) > Math.abs(dy))) {
        down.grab = true;
        bw.grab(down.kind, down.idx, down.sub, x, y);
        canvas.setPointerCapture(e.pointerId);
        setCursor('grabbing');
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!down || !bw || e.pointerId !== down.id) return;
      const tap = !down.grab && performance.now() - down.t < 250 && down.moved < 6;
      const recentScroll = down.touch && performance.now() - lastScroll < 300;
      if (tap && !recentScroll) {
        const [x, y] = toWorld(e);
        bw.poke(x, y, (down.touch ? 22 : 16) / scale);
      }
      drop(e, true);
    };
    const onCancel = (e: PointerEvent) => drop(e, false);
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !bw || down?.grab) return;
      bw.px = bw.py = -999;
      bw.hover = -1;
      setCursor('');
    };
    const onMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onMenu);
    // #endregion

    return () => {
      disposed = true;
      if (running) gsap.ticker.remove(tick);
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      mo.disconnect();
      mq.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('contextmenu', onMenu);
      if (down && canvas.hasPointerCapture(down.id)) canvas.releasePointerCapture(down.id);
    };
  }, [flow]);

  return (
    <>
      <canvas className='acard__bots' ref={canvasRef} aria-hidden='true' />
      <p className='acard__caption' ref={capRef} aria-hidden='true' />
    </>
  );
};
