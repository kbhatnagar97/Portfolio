import { boot } from '../shared/boot';
import { EASE } from '../shared/ease';
import { gsap, withMotion } from '../shared/motion';
import { belowFold, onceInView } from '../shared/view';
import './overview.scss';

// the filter itself is CSS; this checks the radio a case page's purpose chip names in the hash, and says how many cases show
const filter = () => {
  const set = document.querySelector<HTMLFieldSetElement>('.ofilter');
  const count = document.querySelector<HTMLElement>('.ofilter__count');
  if (!set || !count) return;
  const cards = [...document.querySelectorAll<HTMLElement>('.ocard')];
  const show = (id: string) => {
    const n = cards.filter((c) => c.dataset.for?.split(' ').includes(id)).length;
    count.textContent = id === 'all' ? '' : `Showing ${n} of ${cards.length} cases`;
  };
  set.addEventListener('change', (e) => {
    if (e.target instanceof HTMLInputElement) show(e.target.value);
  });
  const named = document.getElementById(location.hash.slice(1));
  if (named instanceof HTMLInputElement && named.name === 'for') {
    named.checked = true;
    show(named.value);
  }
};

// the steps are a sequence, so they arrive in order, once; fired by the kit's view check, as a ScrollTrigger's refresh cuts short a #for- hash scroll
const steps = () =>
  withMotion(() => {
    const list = document.querySelector('.how__steps');
    if (!list || !belowFold(list)) return;
    const items = [...list.children];
    gsap.set(items, { opacity: 0, y: 16 });
    onceInView(list, () => gsap.to(items, { opacity: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.04 }));
  });

boot(() => {
  filter();
  steps();
});
