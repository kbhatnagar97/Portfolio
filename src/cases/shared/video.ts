import { reducedMotion } from './motion';
import { nearView } from './view';

// Click to play and silent loops. Never a poster attribute in the HTML: it cannot lazy load and races LCP.

const seconds = (t: string) => t.split(':').reduce((a, b) => a * 60 + Number(b), 0);
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

// #region Click to play
// the facade is a real link to the file; the script swaps in the player and keeps the poster on top until it plays
export const clip = (fig: HTMLElement) => {
  const open = fig.querySelector<HTMLAnchorElement>('.vid__open');
  const media = fig.querySelector<HTMLElement>('.vid__media');
  const text = fig.querySelector<HTMLElement>('.vid__text');
  if (!open || !media) return;
  let player: HTMLVideoElement | undefined;
  let stall = 0;
  const wait = Object.assign(document.createElement('p'), { className: 'vid__wait', textContent: 'Loading video', hidden: true });

  const load = () => {
    if (player) return player;
    const v = document.createElement('video');
    v.controls = true;
    v.playsInline = true;
    v.preload = 'none';
    v.width = Number(open.dataset.w);
    v.height = Number(open.dataset.h);
    if (text?.id) v.setAttribute('aria-describedby', text.id);
    v.src = open.getAttribute('href') ?? '';
    // a loading line only after playback stalls for 300ms, so a quick start never flashes it
    v.addEventListener('waiting', () => {
      clearTimeout(stall);
      stall = window.setTimeout(() => (wait.hidden = false), 300);
    });
    v.addEventListener('playing', () => {
      clearTimeout(stall);
      wait.hidden = true;
      open.classList.add('is-gone');
      window.setTimeout(() => open.remove(), 120);
    });
    media.prepend(v);
    media.append(wait);
    player = v;
    return v;
  };

  const play = (from?: number) => {
    const v = load();
    if (from !== undefined) {
      if (v.readyState >= 1) v.currentTime = from;
      else v.addEventListener('loadedmetadata', () => (v.currentTime = from), { once: true });
    }
    void v.play().catch(() => undefined);
    v.focus();
  };

  open.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    play();
  });
  // links answer Enter natively; Space would scroll the page instead
  open.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    play();
  });

  // each timecode becomes a button that loads the clip if needed and seeks
  for (const t of text?.querySelectorAll<HTMLElement>('.vid__t') ?? []) {
    const at = t.textContent ?? '0:00';
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'vid__t', textContent: at });
    b.setAttribute('aria-label', `Play from ${at}`);
    b.addEventListener('click', () => play(seconds(at)));
    t.replaceWith(b);
  }
};
// #endregion

// #region Loops
// plays only in view and in a visible tab; reduced motion and Save-Data start paused, with the still showing
export const loop = (fig: HTMLElement) => {
  const v = fig.querySelector<HTMLVideoElement>('video[data-src]');
  const toggle = fig.querySelector<HTMLButtonElement>('.vid__toggle');
  if (!v || !toggle) return;
  let paused = reducedMotion() || saveData();
  let inView = false;
  const load = () => {
    if (v.src) return;
    v.poster = v.dataset.poster ?? '';
    v.src = v.dataset.src ?? '';
  };
  const label = () => {
    toggle.textContent = paused ? 'Play the loop' : 'Pause the loop';
  };
  const sync = () => {
    if (inView && !paused && !document.hidden) {
      load();
      void v.play().catch(() => undefined);
    } else v.pause();
  };
  label();
  toggle.hidden = false;
  if (!paused) nearView(fig, load);
  new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(fig);
  document.addEventListener('visibilitychange', sync);
  toggle.addEventListener('click', () => {
    paused = !paused;
    label();
    sync();
  });
};
// #endregion
