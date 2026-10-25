import { chapterIndex } from './chapters';
import { compare } from './compare';
import { counters } from './counter';
import { ScrollTrigger, scrollToId, startSmoothScroll } from './motion';
import { pairs } from './pair';
import { reveals } from './reveal';
import { turn } from './turn';
import { versions } from './versions';
import { clip, loop } from './video';

// Every case page's entry calls boot() once: it marks the page ready, wires the shared parts, then runs the case's own code.

export interface IBoot {
  // Lenis smooth scrolling, only for a world with a camera scene; case pages scroll natively by default
  smooth?: boolean;
}

// #region Helpers
// one broken part must not take the rest of the page down with it
const safely = (run: () => void) => {
  try {
    run();
  } catch (e) {
    console.error(e);
  }
};
const each = (selector: string, wire: (el: HTMLElement) => void) => {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) safely(() => wire(el));
};
// #endregion

// #region Deep links
const INPUTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

// a link into a case page (#src-2, #get-this) must land there, but each ScrollTrigger refresh restores the scroll it
// found and so stops the browser's smooth jump halfway; until the reader moves, every refresh lands on the target again
const holdHashTarget = () => {
  let target: HTMLElement | null = null;
  try {
    target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  } catch {
    return;
  }
  if (!target) return;
  const el = target;
  // the shell asks for smooth scrolling; the jump back to the target is instant, then the page's own setting returns
  const land = () => {
    const html = document.documentElement;
    const was = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    el.scrollIntoView({ block: 'start' });
    html.style.scrollBehavior = was;
  };
  const release = () => {
    ScrollTrigger.removeEventListener('refresh', land);
    for (const t of INPUTS) removeEventListener(t, release);
  };
  for (const t of INPUTS) addEventListener(t, release, { passive: true });
  ScrollTrigger.addEventListener('refresh', land);
  land();
};
// #endregion

export const boot = (run?: () => void, o: IBoot = {}) => {
  // behaviour keys off this class; only the stage and compare layouts use html.js, so they settle before first paint
  document.documentElement.classList.add('case-ready');
  if (o.smooth) {
    startSmoothScroll();
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a || a.hash.length < 2) return;
      e.preventDefault();
      scrollToId(decodeURIComponent(a.hash.slice(1)));
    });
  }
  safely(chapterIndex);
  safely(reveals);
  safely(counters);
  safely(pairs);
  each('[data-compare]', compare);
  each('[data-video]', clip);
  each('[data-loop]', loop);
  each('[data-versions]', versions);
  each('[data-turn]', turn);
  if (run) safely(run);
  safely(holdHashTarget);
  // trigger positions go stale once the web fonts and the stage media arrive
  const refresh = () => ScrollTrigger.refresh();
  void document.fonts?.ready.then(refresh);
  if (document.readyState === 'complete') refresh();
  else addEventListener('load', refresh, { once: true });
};
