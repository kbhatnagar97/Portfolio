import { EASE_MOVE } from './ease';
import { gsap, reducedMotion } from './motion';

// The before and after wipe: counter translation, transforms written on the three moving boxes directly.

const DRAG_START = 6;
const LABEL_ROOM = 64;

export const compare = (fig: HTMLElement) => {
  const frame = fig.querySelector<HTMLElement>('.cmp__frame');
  const clip = fig.querySelector<HTMLElement>('.cmp__clip');
  const inner = fig.querySelector<HTMLElement>('.cmp__inner');
  const handle = fig.querySelector<HTMLElement>('.cmp__handle');
  const range = fig.querySelector<HTMLInputElement>('.cmp__range');
  const before = fig.querySelector<HTMLElement>('.cmp__label--before');
  const after = fig.querySelector<HTMLElement>('.cmp__label--after');
  if (!frame || !clip || !inner || !handle || !range || !before || !after) return;
  // the spoken value comes from the page ({v} before, {w} after), so a label's visible extras never reach it
  const words = fig.dataset.valuetext ?? `{v} percent ${before.textContent ?? ''}, {w} percent ${after.textContent ?? ''}`;
  // anything under the frame that tracks the handle, such as a light on the floor
  const followers = [...fig.querySelectorAll<HTMLElement>('[data-cmp-follow]')];
  let p = Number(fig.dataset.start ?? range.value);
  let width = 0;
  let beforeEnd = 0;
  let afterStart = 0;

  // #region Painting
  // a label fades while the handle is near it, so the handle never sits on top of it
  const fadeLabels = () => {
    const x = (p / 100) * width;
    before.classList.toggle('is-near', x < beforeEnd + LABEL_ROOM);
    after.classList.toggle('is-near', x > afterStart - LABEL_ROOM);
  };

  const paint = (v: number) => {
    p = Math.min(100, Math.max(0, v));
    clip.style.transform = `translateX(${p - 100}%)`;
    inner.style.transform = `translateX(${100 - p}%)`;
    handle.style.transform = `translateX(${p}%)`;
    for (const f of followers) f.style.transform = handle.style.transform;
    const whole = Math.round(p);
    range.value = String(whole);
    range.setAttribute('aria-valuetext', words.replace('{v}', String(whole)).replace('{w}', String(100 - whole)));
    fadeLabels();
  };

  // measured on resize only, so a drag never reads layout
  const measure = () => {
    const box = frame.getBoundingClientRect();
    width = box.width;
    beforeEnd = before.getBoundingClientRect().right - box.left;
    afterStart = after.getBoundingClientRect().left - box.left;
    fadeLabels();
  };
  new ResizeObserver(measure).observe(frame);
  // #endregion

  // #region Keys and pointer
  let jump: gsap.core.Tween | undefined;
  // a press without movement jumps there over 200ms on --ease-move, at once under reduced motion
  const jumpTo = (v: number) => {
    jump?.kill();
    if (reducedMotion()) return paint(v);
    const s = { v: p };
    jump = gsap.to(s, { v, duration: 0.2, ease: EASE_MOVE, onUpdate: () => paint(s.v) });
  };

  // arrows, Home and End are the native range's; Page keys move by 10
  range.addEventListener('input', () => {
    jump?.kill();
    paint(Number(range.value));
  });
  range.addEventListener('keydown', (e) => {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    jumpTo(p + (e.key === 'PageUp' ? 10 : -10));
  });

  // touch-action: pan-y in the CSS keeps vertical swipes scrolling the page; a second touch is ignored
  let pointer: number | undefined;
  let x0 = 0;
  let dragging = false;
  const percentAt = (clientX: number) => ((clientX - frame.getBoundingClientRect().left) / (width || 1)) * 100;
  frame.addEventListener('pointerdown', (e) => {
    if (pointer !== undefined || range.disabled || e.button !== 0) return;
    pointer = e.pointerId;
    x0 = e.clientX;
    dragging = false;
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    if (!dragging && Math.abs(e.clientX - x0) < DRAG_START) return;
    dragging = true;
    jump?.kill();
    paint(percentAt(e.clientX));
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    if (!dragging && e.type === 'pointerup') jumpTo(percentAt(e.clientX));
    pointer = undefined;
  };
  frame.addEventListener('pointerup', release);
  frame.addEventListener('pointercancel', release);
  // images are draggable by default, and a native drag would cancel the pointer mid wipe
  frame.addEventListener('dragstart', (e) => e.preventDefault());
  // #endregion

  paint(p);
  // the handle wakes once both captures can paint, so the first drag never shows a half loaded image
  const images = [...fig.querySelectorAll('img')];
  void Promise.all(images.map((i) => i.decode().catch(() => undefined))).then(() => {
    range.disabled = false;
    fig.classList.add('cmp--ready');
  });
};
