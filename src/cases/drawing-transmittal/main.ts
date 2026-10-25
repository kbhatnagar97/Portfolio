import { boot } from '../shared/boot';
import { readData } from '../shared/data';
import { nearView } from '../shared/view';
import { hoursModel } from './model';
import type { IHoursCopy } from './model';
import './case.scss';

// Drawing Ledger's entry: the kit, then the demo and the calculator, each wired a screen before the reader gets there.

// a labelled scroller is a tab stop only while it really scrolls, so wide screens skip the empty stop
const scrollers = () => {
  const fit = (el: HTMLElement) => {
    if (el.scrollWidth <= el.clientWidth + 1) {
      el.removeAttribute('tabindex');
      return;
    }
    el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
    if (el.dataset.label && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.label);
  };
  const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target as HTMLElement)));
  for (const el of document.querySelectorAll<HTMLElement>('[data-scroller]')) ro.observe(el);
};

boot(() => {
  scrollers();

  // the demo loads a screen early; if it cannot start, the stage shows its storyboard instead (case.scss, is-static)
  const stage = document.getElementById('stage');
  const frame = document.querySelector<HTMLElement>('[data-dt]');
  if (stage && frame)
    nearView(frame, () =>
      void import('./stage')
        .then((m) => m.start(frame))
        .catch((e: unknown) => {
          console.error(e);
          stage.classList.add('is-static');
        }),
    );

  const form = document.querySelector<HTMLFormElement>('[data-calc]');
  const copy = readData<IHoursCopy>('drawing-transmittal-calc');
  if (form && copy) nearView(form, () => void import('../shared/calculator').then((m) => m.calculator(form, hoursModel(copy))));
});
