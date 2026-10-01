import { useEffect, useRef, type MouseEvent } from 'react';
import { gsap, SplitText, scrollToHash } from '../smooth';
import { useMagnetic } from '../motion';
import { AWARDS, LIVE_COUNT, PROFILE, PROJECTS, YEARS_EXPERIENCE } from '../data';
import { SHAPE } from '../scene/shapes';

const AWARD_COUNT = AWARDS.filter((a) => /award/i.test(a.TITLE)).reduce((n, a) => n + a.IMAGES.length, 0);

const STATS = [
  { value: PROJECTS.length, label: 'projects built' },
  { value: LIVE_COUNT, label: 'live right now' },
  { value: YEARS_EXPERIENCE, label: 'years shipping' },
  { value: AWARD_COUNT, label: 'awards at work' },
];

const Hero = () => {
  const root = useRef<HTMLElement>(null);
  const primary = useRef<HTMLAnchorElement>(null);
  useMagnetic(primary);

  useEffect(() => {
    let ctx: gsap.Context | undefined;
    let cancelled = false;
    // split only once the display fonts are in, otherwise the chars are measured on fallback metrics
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]).then(() => {
      if (cancelled || !root.current) return;
      root.current.classList.add('is-ready');
      ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          // chars fade as they rise instead of sliding under a clip mask, so no glyph is ever sliced mid-reveal
          const split = SplitText.create('.hero__line', { type: 'chars' });
          gsap
            .timeline({ defaults: { ease: 'expo.out' } })
            .from(split.chars, { yPercent: 60, opacity: 0, duration: 1.4, stagger: 0.035 }, 0.15)
            .fromTo('.hero__stat', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.9)
            .fromTo('.hero__hint', { opacity: 0 }, { opacity: 1, duration: 1 }, 1.4);
          gsap.utils.toArray<HTMLElement>('.hero__count').forEach((el) => {
            const target = Number(el.dataset.value);
            const counter = { v: 0 };
            gsap.to(counter, { v: target, duration: 1.8, delay: 1, ease: 'power2.out', onUpdate: () => {
                el.textContent = String(Math.round(counter.v));
              },
            });
          });
        });
      }, root);
    });
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  const go = (e: MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    scrollToHash(hash);
  };

  return (
    <section id='top' className='hero' ref={root} data-shape={SHAPE.orb}>
      <div className='hero__inner'>
        <div className='hero__who'>
          <p className='hero__eyebrow'>
            <span className='pulse' aria-hidden='true' />
            {PROFILE.headline}
          </p>
          <p className='hero__loc'>
            <svg className='hero__pin' viewBox='0 0 16 16' width='12' height='12' aria-hidden='true' focusable='false'>
              <path d='M8 14.5s4.5-4.3 4.5-8a4.5 4.5 0 0 0-9 0c0 3.7 4.5 8 4.5 8Z' />
              <circle cx='8' cy='6.5' r='1.6' />
            </svg>
            {PROFILE.location}
          </p>
        </div>
        <h1 className='hero__title'>
          <span className='hero__line'>Kshitij</span>{' '}
          <span className='hero__line hero__line--serif'>Bhatnagar</span>
        </h1>
        <p className='hero__intro'>{PROFILE.intro}</p>
        <div className='hero__actions'>
          <a ref={primary} className='btn btn--solid' href='#work' onClick={(e) => go(e, '#work')}>
            See the work
          </a>
          <a className='btn btn--ghost' href='#skills' onClick={(e) => go(e, '#skills')}>
            What I do
          </a>
          <a className='btn btn--ghost' href='/about/'>
            Who I am
          </a>
        </div>
      </div>
      <dl className='hero__stats'>
        {STATS.map((s) => (
          <div className='hero__stat' key={s.label}>
            <dt>{s.label}</dt>
            <dd className='hero__count' data-value={s.value}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className='hero__hint' aria-hidden='true'>
        <span className='hero__mouse' /> Scroll to explore. The particles react to your cursor.
      </p>
    </section>
  );
};

export default Hero;
