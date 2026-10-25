// The hero's chapter index marks the chapter at the reading line, 45% down the screen.

const LINE = 0.45;

export const chapterIndex = () => {
  const pairs = [...document.querySelectorAll<HTMLAnchorElement>('.case-index a[href^="#"]')]
    .map((a) => ({ a, target: document.getElementById(decodeURIComponent(a.hash.slice(1))) }))
    .filter((x): x is { a: HTMLAnchorElement; target: HTMLElement } => !!x.target);
  if (!pairs.length) return;
  // chapters follow DOM order, so the current one is the last whose top has passed the line
  const mark = () => {
    const line = innerHeight * LINE;
    let current: HTMLAnchorElement | undefined;
    for (const { a, target } of pairs) if (target.getBoundingClientRect().top <= line) current = a;
    for (const { a } of pairs) {
      if (a === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  // a scroll listener, not an observer band: a jump (Home, an anchor, a restored position) can skip any band entirely
  let queued = false;
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  mark();
};
