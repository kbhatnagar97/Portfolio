import { EASE } from '../shared/ease';
import { gsap, reducedMotion, withMotion } from '../shared/motion';
import { belowFold, onceInView } from '../shared/view';

// The weight race, counted on the beat: one row of 100 KB blocks lands per count, then the requests land as dots.

const DROP = { y: -24, opacity: 0 };
const DOTS_FROM = { opacity: 0, scale: 0.96 };

export const race = (fig: HTMLElement) => {
  const cols = fig.querySelector<HTMLElement>('.race__cols');
  const replay = fig.querySelector<HTMLButtonElement>('.race__replay');
  if (!cols || !replay) return;
  const old = [...fig.querySelectorAll<HTMLElement>('.race__col--old .race__row')];
  const fresh = [...fig.querySelectorAll<HTMLElement>('.race__col--new .race__row')];
  const dots = [...fig.querySelectorAll<HTMLElement>('.race__dots')];
  const digits = [...fig.querySelectorAll<HTMLElement>('.race__digit')];
  const count = Number(fig.dataset.countMs ?? 500) / 1000;
  let tl: gsap.core.Timeline | undefined;

  // the current count is lit; the count dot jumps with it, so it lands on the beat rather than gliding
  const light = (n: number) => digits.forEach((d, i) => d.classList.toggle('is-now', i === n - 1));
  const done = () => {
    fig.classList.remove('race--playing');
    replay.removeAttribute('aria-disabled');
  };

  const play = () => {
    if (reducedMotion()) return;
    tl?.kill();
    fig.classList.add('race--playing');
    replay.setAttribute('aria-disabled', 'true');
    tl = gsap.timeline({ onComplete: done });
    const land = { y: 0, opacity: 1, duration: count, ease: EASE };
    old.forEach((row, i) => tl?.fromTo(row, DROP, land, i * count));
    fresh.forEach((row, i) => tl?.fromTo(row, DROP, land, i * count));
    tl.fromTo(dots, DOTS_FROM, { ...land, scale: 1 }, old.length * count);
    digits.forEach((_, i) => tl?.call(light, [i + 1], i * count));
    // the last count is a hold, so the phrase ends on the bar line
    tl.set({}, {}, digits.length * count);
  };

  withMotion(() => {
    if (belowFold(cols)) {
      gsap.set([...old, ...fresh], DROP);
      gsap.set(dots, DOTS_FROM);
      light(0);
      onceInView(cols, play);
    } else light(digits.length);
    const again = () => {
      if (!fig.classList.contains('race--playing')) play();
    };
    replay.addEventListener('click', again);
    return () => {
      tl?.kill();
      gsap.set([...old, ...fresh, ...dots], { clearProps: 'transform,opacity' });
      replay.removeEventListener('click', again);
      done();
    };
  });
};
