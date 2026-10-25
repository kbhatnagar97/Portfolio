import { EASE } from './ease';
import { gsap, reducedMotion } from './motion';
import { belowFold, onceInView } from './view';

// Stage numbers rolling between two real values. Never in the hero ledger or on cards.

const format = (v: number, decimals: number) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const textAt = (el: HTMLElement, v: number) => `${el.dataset.prefix ?? ''}${format(v, Number(el.dataset.decimals ?? 0))}${el.dataset.suffix ?? ''}`;

// screen readers keep the final value while the visible copy rolls, and the reserved width keeps the row still
const prepare = (el: HTMLElement) => {
  const done = el.querySelector<HTMLElement>(':scope > [aria-hidden="true"]');
  if (done) return done;
  const final = el.textContent ?? '';
  el.classList.add('count--on');
  el.style.minWidth = `${el.getBoundingClientRect().width}px`;
  el.dataset.final = final;
  const shown = document.createElement('span');
  shown.setAttribute('aria-hidden', 'true');
  shown.textContent = final;
  const said = document.createElement('span');
  said.className = 'sr-only';
  said.textContent = final;
  el.replaceChildren(shown, said);
  return shown;
};

export const count = (el: HTMLElement) => {
  const to = Number(el.dataset.count);
  const from = Number(el.dataset.from ?? 0);
  if (reducedMotion() || !Number.isFinite(to) || !Number.isFinite(from) || el.dataset.counted !== undefined) return;
  el.dataset.counted = '';
  const shown = prepare(el);
  const s = { v: from };
  gsap.to(s, {
    v: to,
    duration: 1.2,
    ease: EASE,
    onUpdate: () => {
      shown.textContent = textAt(el, s.v);
    },
    onComplete: () => {
      shown.textContent = el.dataset.final ?? '';
    },
  });
};

// a counter below the fold shows its start value until it rolls, so it never jumps back from the final one
export const counters = () => {
  if (reducedMotion()) return;
  for (const el of document.querySelectorAll<HTMLElement>('[data-count]')) {
    if (belowFold(el)) prepare(el).textContent = textAt(el, Number(el.dataset.from ?? 0));
    onceInView(el, () => count(el));
  }
};
