import { reducedMotion } from '../shared/motion';
import type { TView } from './blocks';

// The stage's two screens: the Desktop and Phone switch. The kit's compare moves each handle and its floor light.

const PHONE = '(max-width: 699px)';
const OUT_MS = 130;
const IN_MS = 200;

export const views = (root: HTMLElement) => {
  const panes = new Map([...root.querySelectorAll<HTMLElement>('.views__pane')].map((p) => [p.dataset.view, p]));
  const radios = [...root.querySelectorAll<HTMLInputElement>('.views__radio')];

  // the screen width picks the first view, as the CSS already did before this ran, so nothing moves
  let shown: TView = matchMedia(PHONE).matches ? 'phone' : 'desktop';
  root.dataset.view = shown;
  for (const r of radios) r.checked = r.value === shown;

  const ease = getComputedStyle(root).getPropertyValue('--ease').trim() || 'ease-out';
  let fade: Animation | undefined;

  const show = async (next: TView) => {
    // the latest choice wins: a cancelled fade hands its pane back at full opacity
    fade?.cancel();
    const from = panes.get(shown);
    const to = panes.get(next);
    if (next === shown || !from || !to) return;
    // the split stays where the reader left it; the kit repaints a range on input
    const was = from.querySelector<HTMLInputElement>('.cmp__range');
    const range = to.querySelector<HTMLInputElement>('.cmp__range');
    if (was && range) {
      range.value = was.value;
      range.dispatchEvent(new Event('input'));
    }
    let out: Animation | undefined;
    if (!reducedMotion()) {
      // linear, so the outgoing screen stays readable for its whole 130ms instead of vanishing at once
      out = from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: 'linear', fill: 'forwards' });
      fade = out;
      try {
        await out.finished;
      } catch {
        return;
      }
    }
    shown = next;
    root.dataset.view = next;
    // the outgoing pane is hidden now, so its held opacity can go; it returns whole next time
    out?.cancel();
    fade = reducedMotion() ? undefined : to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: IN_MS, easing: ease });
  };

  root.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.classList.contains('views__radio')) void show(input.value as TView);
  });
};
