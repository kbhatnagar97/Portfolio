import { EASE_MOVE } from '../shared/ease';
import { gsap, withMotion } from '../shared/motion';
import { belowFold, onceInView } from '../shared/view';

// The folder path figure's one motion, to explain where each tag comes from: copies of the four path
// segments fly into their fields, then the frame values and the keywords fade in. Once, and only from below the fold.

const DIM = 0.55;

export const pathMotion = (fig: HTMLElement) =>
  withMotion(() => {
    if (!belowFold(fig)) return;
    const segments = [...fig.querySelectorAll<HTMLElement>('[data-seg]')];
    const targets = segments.map((s) => fig.querySelector<HTMLElement>(`[data-field="${s.dataset.seg}"] .path__value`));
    const frameValues = [...fig.querySelectorAll<HTMLElement>('.path__field--frames .path__value')];
    const keywords = fig.querySelector<HTMLElement>('.path__kw');
    if (!keywords || targets.some((t) => !t)) return;

    // the empty start state exists only at run time, so the figure reads complete without JavaScript
    gsap.set([...targets, ...frameValues, keywords], { opacity: 0 });
    const copies: HTMLElement[] = [];

    onceInView(fig, () => {
      const box = fig.getBoundingClientRect();
      segments.forEach((segment, i) => {
        const target = targets[i] as HTMLElement;
        const from = segment.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const copy = segment.cloneNode(true) as HTMLElement;
        copy.removeAttribute('data-seg');
        copy.setAttribute('aria-hidden', 'true');
        copy.classList.add('path__clone');
        copy.style.left = `${from.left - box.left}px`;
        copy.style.top = `${from.top - box.top}px`;
        fig.append(copy);
        copies.push(copy);
        const delay = i * 0.04;
        // the copy's text lands where the value's text starts, centred on its line; its chip padding stays outside
        const inset = parseFloat(getComputedStyle(segment).paddingLeft) + segment.clientLeft;
        gsap.to(segment, { opacity: DIM, duration: 0.4, ease: EASE_MOVE, delay });
        gsap.fromTo(
          copy,
          { x: 0, y: 0 },
          {
            x: to.left - from.left - inset,
            y: to.top + to.height / 2 - (from.top + from.height / 2),
            duration: 0.4,
            ease: EASE_MOVE,
            delay,
            // the mono copy hands over to the field's own value in one 120ms crossfade
            onComplete: () => {
              gsap.to(target, { opacity: 1, duration: 0.12, ease: 'none' });
              gsap.to(copy, { opacity: 0, duration: 0.12, ease: 'none', onComplete: () => copy.remove() });
            },
          },
        );
      });
      gsap.to(frameValues, { opacity: 1, duration: 0.12, ease: 'none', delay: 0.56, stagger: 0.04 });
      gsap.to(keywords, { opacity: 1, duration: 0.12, ease: 'none', delay: 0.84 });
    });

    // reduced motion turned on mid flight: the context reverts the tweens, and the copies go with them
    return () => {
      for (const copy of copies) copy.remove();
    };
  });
