import { EASE, EASE_MOVE } from './ease';
import { gsap, reducedMotion } from './motion';
import { belowFold, onceInView } from './view';

// The turn block's one motion: a marker travels the L drawn in CSS, then the new way rises into view.

const DIMMED = 0.55;

// #region The L
// arc length sampling (straight, quarter circle, straight), so the marker's speed never changes at the corner
const pointAt = (s: number, w: number, h: number, r: number): [number, number] => {
  const down = h - r;
  const arc = (Math.PI * r) / 2;
  if (s <= down) return [0, s];
  if (s <= down + arc) {
    const a = (s - down) / r;
    return [r - r * Math.cos(a), down + r * Math.sin(a)];
  }
  return [Math.min(w, r + (s - down - arc)), h];
};
// #endregion

export const turn = (block: HTMLElement) => {
  const path = block.querySelector<HTMLElement>('.turn__path');
  const marker = block.querySelector<HTMLElement>('.turn__marker');
  const old = [...block.querySelectorAll<HTMLElement>('.turn__old')];
  const fresh = [...block.querySelectorAll<HTMLElement>('.turn__new > *')];
  const strikes = [...block.querySelectorAll<HTMLElement>('.turn__strike')];
  if (!path || !marker || !old.length) return;
  const withMarker = block.dataset.turnMarker !== 'none';
  const ms = Number(block.dataset.turnMs ?? 1200);
  const steps = Number(block.dataset.turnSteps ?? 0);

  // #region Measuring the marker's path
  const size = () => {
    const r = parseFloat(getComputedStyle(path).borderBottomLeftRadius) || 0;
    return { w: path.clientWidth, h: path.clientHeight, r: Math.min(r, path.clientWidth, path.clientHeight) };
  };
  const place = (s: number) => {
    const { w, h, r } = size();
    const [x, y] = pointAt(s, w, h, r);
    marker.style.transform = `translate(${x}px, ${y}px)`;
  };
  const total = () => {
    const { w, h, r } = size();
    return h - r + (Math.PI * r) / 2 + (w - r);
  };
  // #endregion

  // #region Motion
  // reduced motion, or a block already on screen at load: the end state at once
  if (reducedMotion() || !belowFold(block)) {
    if (withMarker) {
      gsap.set(old, { opacity: DIMMED });
      place(total());
    }
    return;
  }

  // the new way is hidden only at run time, and only because the block starts below the fold
  gsap.set(fresh, { opacity: 0, y: 8 });
  // GSAP warns about an empty target, and most turns rule nothing out
  if (strikes.length) gsap.set(strikes, { scaleX: 0 });
  const rise = () => gsap.to(fresh, { opacity: 1, y: 0, duration: withMarker ? 0.6 : ms / 1000, ease: EASE, stagger: 0.04 });
  if (!withMarker) {
    onceInView(block, rise);
    return;
  }
  place(0);
  onceInView(block, () => {
    const { h, r } = size();
    const corner = h - r + (Math.PI * r) / 4;
    const marks = strikes.map((st) => ({ st, y: st.getBoundingClientRect().top - path.getBoundingClientRect().top, done: false }));
    let turned = false;
    const s = { v: 0 };
    gsap.to(s, {
      v: total(),
      duration: ms / 1000,
      ease: steps ? `steps(${steps})` : 'none',
      onUpdate: () => {
        place(s.v);
        // each dropped plan is struck as the marker passes its name
        for (const m of marks)
          if (!m.done && s.v >= m.y) {
            m.done = true;
            gsap.to(m.st, { scaleX: 1, duration: 0.24, ease: EASE_MOVE });
          }
        if (!turned && s.v >= corner) {
          turned = true;
          gsap.to(old, { opacity: DIMMED, duration: 0.4, ease: EASE });
          rise();
        }
      },
    });
  });
  // #endregion
};
