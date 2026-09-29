import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | undefined;

export const startSmoothScroll = () => {
  if (reducedMotion()) return () => undefined;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = undefined;
  };
};

export const scrollToHash = (hash: string) => {
  const el = document.querySelector<HTMLElement>(hash);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  history.replaceState(null, '', hash);
};

// Overlays call this so wheel and touch stay inside them.
export const lockScroll = (locked: boolean) => {
  if (locked) lenis?.stop();
  else lenis?.start();
  document.documentElement.classList.toggle('is-locked', locked);
};

export { gsap, ScrollTrigger, SplitText };
