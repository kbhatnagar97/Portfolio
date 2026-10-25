// Viewport triggers shared by the kit and the case scripts.

export const belowFold = (el: Element) => el.getBoundingClientRect().top > innerHeight;

type TWatch = { el: Element; run: () => void };
const watching = new Set<TWatch>();
let queued = false;

// fully in view, or 60% of the screen for a taller block; a block already scrolled past fires too, as a jump can skip both
const due = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.top < 0) return true;
  const seen = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
  return seen >= (r.height > innerHeight ? 0.6 * innerHeight : r.height - 1);
};

const sweep = () => {
  queued = false;
  for (const w of watching)
    if (due(w.el)) {
      watching.delete(w);
      w.run();
    }
  if (watching.size) return;
  removeEventListener('scroll', queue);
  removeEventListener('resize', queue);
};

const queue = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(sweep);
};

// timed sequences fire once and never again on scroll back; one frame throttled check serves every block on the page
export const onceInView = (el: Element, run: () => void) => {
  if (!watching.size) {
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue, { passive: true });
  }
  watching.add({ el, run });
  queue();
};

// stage modules and loop sources load a screen early, so the reader never waits on them
export const nearView = (el: Element, run: () => void, margin = '800px 0px') => {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    },
    { rootMargin: margin },
  );
  io.observe(el);
};
