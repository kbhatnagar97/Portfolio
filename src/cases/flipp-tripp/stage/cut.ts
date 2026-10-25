import { EASE } from '../../shared/ease';
import { reducedMotion } from '../../shared/motion';
import type { ILeafPose, IStageData } from '../blocks';
import { flipAt, readoutText, stepIndex, valueText } from '../model';

// Part 1 of the stage: the reader scrubs one flip by hand, or plays it ten times slower.

const HINGE = '28 168';

// #region Drawing one moment
const elements = (stage: HTMLElement) => {
  const cut = stage.querySelector<HTMLElement>('.ft-cut');
  const tile = cut?.querySelector<HTMLElement>('.ft-tile--big');
  const range = cut?.querySelector<HTMLInputElement>('.ft-range');
  const play = cut?.querySelector<HTMLButtonElement>('.ft-play');
  const readout = cut?.querySelector<HTMLElement>('.stage__readout');
  const speed = cut?.querySelector<HTMLElement>('.ft-view__speed');
  if (!cut || !tile || !range || !play || !readout || !speed) return undefined;
  const [top, bottom] = tile.querySelectorAll<HTMLElement>('.ft-half');
  const [fold, land] = tile.querySelectorAll<HTMLElement>('.ft-leaf');
  const side = (leaf: string) => cut.querySelector<SVGGElement>(`.ft-side__leaf[data-leaf="${leaf}"]`);
  return { cut, range, play, readout, speed, top, bottom, fold, land, sideFold: side('fold'), sideLand: side('land'), steps: [...stage.querySelectorAll<HTMLElement>('.stage__steps > li')] };
};

const pose = (leaf: HTMLElement, p?: ILeafPose) => {
  leaf.hidden = !p;
  if (!p) return;
  leaf.dataset.g = p.glyph;
  leaf.style.transform = `rotateX(${p.deg}deg)`;
  const shade = leaf.firstElementChild as HTMLElement | null;
  if (shade) shade.style.opacity = String(p.shade);
};
// #endregion

export const cutAway = (stage: HTMLElement, data: IStageData) => {
  const el = elements(stage);
  if (!el) return;
  const { cut, tempo } = data;
  const glyphs: [string, string, string] = [cut.example.from, cut.example.via, cut.example.to];
  const { min, max, step, page } = cut.slider;
  let playing = false;

  // the drawing follows t exactly, so slow play stays smooth; the slider and its value text follow the 5 ms value
  const draw = (t: number) => {
    const p = flipAt(t, glyphs, tempo, EASE);
    el.top.dataset.g = p.top;
    el.bottom.dataset.g = p.bottom;
    pose(el.fold, p.fold);
    pose(el.land, p.land);
    el.sideFold?.setAttribute('visibility', p.side.leaf === 'fold' ? 'visible' : 'hidden');
    el.sideLand?.setAttribute('visibility', p.side.leaf === 'land' ? 'visible' : 'hidden');
    (p.side.leaf === 'fold' ? el.sideFold : el.sideLand)?.setAttribute('transform', `rotate(${p.side.deg} ${HINGE})`);
    el.readout.textContent = readoutText(p, cut.readout, playing);
    const v = el.range.valueAsNumber;
    el.range.setAttribute('aria-valuetext', valueText(v, flipAt(v, glyphs, tempo, EASE), cut.valueText));
    const current = stepIndex(Math.round(t / step) * step, cut.steps);
    el.steps.forEach((li, i) => (i === current ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
  };

  // #region Slow play
  let raf = 0;
  const stop = () => {
    if (!playing) return;
    cancelAnimationFrame(raf);
    playing = false;
    el.play.textContent = cut.play.label;
    el.speed.hidden = true;
    draw(el.range.valueAsNumber);
  };
  const start = () => {
    const from = el.range.valueAsNumber >= max ? min : el.range.valueAsNumber;
    const t0 = performance.now();
    playing = true;
    el.play.textContent = cut.play.pause;
    el.speed.hidden = false;
    const frame = (now: number) => {
      const t = Math.min(max, from + Math.max(0, now - t0) / cut.play.factor);
      el.range.value = String(Math.round(t / step) * step);
      draw(t);
      if (t < max) raf = requestAnimationFrame(frame);
      else stop();
    };
    raf = requestAnimationFrame(frame);
  };
  el.play.addEventListener('click', () => (playing ? stop() : start()));
  // play pauses off screen, in a hidden tab, and the moment the reader asks for less motion
  new IntersectionObserver(([e]) => e.isIntersecting || stop()).observe(el.cut);
  document.addEventListener('visibilitychange', () => document.hidden && stop());
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (e.matches) stop();
    el.play.disabled = e.matches;
  });
  // #endregion

  // #region The slider
  let queued = false;
  const set = (v: number) => {
    stop();
    el.range.value = String(Math.min(max, Math.max(min, v)));
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw(el.range.valueAsNumber);
    });
  };
  el.range.addEventListener('input', () => set(el.range.valueAsNumber));
  // Page Up and Page Down move half a step in every browser, not each browser's own jump
  el.range.addEventListener('keydown', (e) => {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    set(el.range.valueAsNumber + (e.key === 'PageUp' ? page : -page));
  });
  // #endregion

  el.range.disabled = false;
  el.play.disabled = reducedMotion();
  draw(el.range.valueAsNumber);
};
