import { EASE } from './ease';
import { gsap, withMotion } from './motion';
import { belowFold } from './view';

// opt in, two per page at most, never on a plain figure; only blocks below the fold at boot start hidden, so nothing flickers
export const reveals = () =>
  withMotion(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (!belowFold(el)) continue;
      gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    }
  });
