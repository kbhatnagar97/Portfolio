import { EASE } from '../shared/ease';
import { gsap, withMotion } from '../shared/motion';
import { belowFold, onceInView } from '../shared/view';

// The stage's one motion: words never move, only the line and the rings fill towards the end state the CSS draws.

// #region Types and constants
type TAxis = 'scaleX' | 'scaleY';

interface ITempo {
  breath: number;
  hold: number;
  ring: number;
}

// the row layout in case.scss starts here; under it the path runs down the left
const ROW = '(min-width: 1200px)';
// the hold falls halfway between Pick a time and Answer her questions: the client has a slot, the rest comes with it
const HOLD_AT = 2;
// #endregion

// #region Helpers
// the tempo lives in case.scss, and the minifier may rewrite 1800ms as 1.8s, so both units are read
const seconds = (el: Element, name: string) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v);
};

const tempoOf = (path: HTMLElement): ITempo | undefined => {
  const t = { breath: seconds(path, '--breath'), hold: seconds(path, '--hold'), ring: seconds(path, '--ring') };
  return Object.values(t).every((v) => v > 0) ? t : undefined;
};

// a link into a later chapter scrolls there only after this script runs, and that reader never watches the path fill
const opensPast = (path: HTMLElement) => {
  let target: HTMLElement | null = null;
  try {
    target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  } catch {
    return false;
  }
  return !!target && !(target.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING);
};
// #endregion

// #region Timeline
const timeline = (fills: HTMLElement[], nodes: HTMLElement[], axis: TAxis, tempo: ITempo, done: () => void) => {
  const { breath, hold, ring } = tempo;
  // read once at the trigger, after the fonts have set the layout; nothing is measured while it runs
  const lengths = fills.map((f) => (axis === 'scaleX' ? f.offsetWidth : f.offsetHeight));
  const total = lengths.reduce((a, b) => a + b, 0);
  const tl = gsap.timeline({ onComplete: done });
  let t = 0;
  fills.forEach((fill, i) => {
    // two breaths of line shared out by length, so the line keeps one speed when phone segments differ in height
    const d = (2 * breath * lengths[i]) / total;
    tl.to(nodes[i], { opacity: 1, duration: ring, ease: EASE }, t);
    if (i === HOLD_AT) {
      tl.to(fill, { [axis]: 0.5, duration: d / 2, ease: 'none' }, t);
      tl.to(fill, { [axis]: 1, duration: d / 2, ease: 'none' }, t + d / 2 + hold);
      t += d + hold;
    } else {
      tl.to(fill, { [axis]: 1, duration: d, ease: 'none' }, t);
      t += d;
    }
  });
  tl.to(nodes[fills.length], { opacity: 1, duration: ring, ease: EASE }, t);
  return tl;
};
// #endregion

// #region Wiring
export const breathe = (path: HTMLElement) => {
  // already in view or scrolled past at boot: the drawn path stays as the CSS left it
  if (!belowFold(path) || opensPast(path)) return;
  const fills = [...path.querySelectorAll<HTMLElement>('.path__fill')];
  const nodes = [...path.querySelectorAll<HTMLElement>('.path__on')];
  const tempo = tempoOf(path);
  if (!tempo || !fills.length || nodes.length !== fills.length + 1) return;
  // once per visit: turning reduced motion off again later never replays it
  let finished = false;
  withMotion(() => {
    if (finished) return;
    const row = matchMedia(ROW);
    const axis: TAxis = row.matches ? 'scaleX' : 'scaleY';
    let tl: gsap.core.Timeline | undefined;
    const settle = () => {
      finished = true;
      tl?.progress(1).kill();
      path.classList.remove('is-breathing');
      gsap.set([...fills, ...nodes], { clearProps: 'all' });
    };
    gsap.set(fills, { [axis]: 0 });
    gsap.set(nodes, { opacity: 0 });
    onceInView(path, () => {
      if (finished) return;
      path.classList.add('is-breathing');
      tl = timeline(fills, nodes, axis, tempo, settle);
    });
    // the axis is fixed at boot, so crossing the row breakpoint jumps straight to the drawn path
    row.addEventListener('change', settle, { once: true });
    return () => {
      row.removeEventListener('change', settle);
      settle();
    };
  });
};
// #endregion
