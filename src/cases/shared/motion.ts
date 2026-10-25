import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './kit.scss';

// copies the shape of src/site/smooth.ts on purpose: importing it would ship the home's modules, SplitText included
gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// one shared context, so every sequence reverts the moment a reader turns reduced motion on
const mm = gsap.matchMedia();
export const withMotion = (run: () => void | (() => void)) => {
  mm.add('(prefers-reduced-motion: no-preference)', run);
};

let lenis: Lenis | undefined;

// opt in only: case pages scroll natively unless a world has a camera scene
export const startSmoothScroll = () => {
  if (reducedMotion() || lenis) return;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
};

const headerHeight = () => document.querySelector<HTMLElement>('.top')?.offsetHeight ?? 0;

// Lenis 1.3.8, the version Vercel installs, takes an offset but no scroll margin, so the header height is passed in
export const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -headerHeight() });
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${id}`);
};

// overlays call this so wheel and touch stay inside them; a stopped Lenis ignores scrollTo, so unlock before scrolling
export const lockScroll = (locked: boolean) => {
  if (locked) lenis?.stop();
  else lenis?.start();
  document.documentElement.classList.toggle('is-locked', locked);
};

export { gsap, ScrollTrigger };
