import { reducedMotion } from '../shared/motion';

// Try an old address: saved results of the 25 Oct 2026 check ride in the options, so nothing is fetched or sent.

export const checker = (root: HTMLElement) => {
  const select = root.querySelector<HTMLSelectElement>('.checker__select');
  const out = root.querySelector<HTMLOutputElement>('.checker__out');
  const open = root.querySelector<HTMLAnchorElement>('.checker__open');
  if (!select || !out || !open) return;
  const ease = getComputedStyle(root).getPropertyValue('--ease').trim() || 'ease-out';
  select.disabled = false;
  select.addEventListener('change', () => {
    out.textContent = select.selectedOptions[0]?.dataset.line ?? '';
    open.href = new URL(select.value, open.dataset.base).href;
    // the new result fades in where the old one stood; nothing moves
    out.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducedMotion() ? 150 : 200, easing: ease });
  });
  // the full list prints open
  const all = root.querySelector<HTMLDetailsElement>('.checker__all');
  if (all) addEventListener('beforeprint', () => (all.open = true));
};
