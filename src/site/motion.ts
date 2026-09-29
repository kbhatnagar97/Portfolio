import { useEffect, type RefObject } from 'react';
import { gsap, SplitText } from './smooth';

const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// Line mask reveals for [data-split] headings and a soft rise for [data-fade] blocks.
export const useReveals = () => {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.1,
              ease: 'expo.out',
              stagger: 0.08,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            }),
        });
      });
      gsap.utils.toArray<HTMLElement>('[data-fade]').forEach((el) => {
        // opacity, not autoAlpha: hidden visibility would drop these controls out of the Tab order
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      });
    });
    return () => mm.revert();
  }, []);
};

export const useMagnetic = (ref: RefObject<HTMLElement | null>, strength = 0.35) => {
  useEffect(() => {
    const el = ref.current;
    if (!el || !fine()) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * strength);
      y((e.clientY - r.top - r.height / 2) * strength);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [ref, strength]);
};
