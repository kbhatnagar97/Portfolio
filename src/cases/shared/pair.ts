import { gsap, withMotion } from './motion';
import { belowFold, onceInView } from './view';

// pairs marked data-grow grow their bars once in view, linear over 600ms, the after bar 120ms later
export const pairs = () =>
  withMotion(() => {
    for (const fig of document.querySelectorAll<HTMLElement>('.pair[data-grow]')) {
      if (!belowFold(fig)) continue;
      const bars = fig.querySelectorAll('.pair__bar');
      gsap.set(bars, { scaleX: 0 });
      onceInView(fig, () => gsap.to(bars, { scaleX: 1, duration: 0.6, ease: 'none', stagger: 0.12 }));
    }
  });
