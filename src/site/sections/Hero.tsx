import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
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

const Glyph = ({ children }: { children: ReactNode }) => (
  <svg className='hero__glyph' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'>
    {children}
  </svg>
);

const GLYPHS: Record<string, ReactNode> = {
  LinkedIn: (
    <Glyph>
      <rect x='1.5' y='1.5' width='13' height='13' rx='2.5' />
      <path d='M5 7v4.5M5 4.7v.1M8 11.5V7m0 2.3c0-1.4.9-2.3 2-2.3s1.8.8 1.8 2.1v2.4' />
    </Glyph>
  ),
  GitHub: (
    <Glyph>
      <path d='M6 13.2c-2.6.8-2.6-1.3-3.6-1.6m7.2 3.1v-2.2c0-.6.1-1-.3-1.4 1.8-.2 3.6-.9 3.6-3.9 0-.8-.3-1.5-.8-2.1.1-.7.1-1.4-.2-2.1 0 0-.7-.2-2.2.8a7.6 7.6 0 0 0-3.9 0C4.3 2.8 3.6 3 3.6 3c-.3.7-.3 1.4-.2 2.1-.5.6-.8 1.3-.8 2.1 0 3 1.8 3.7 3.6 3.9-.4.4-.4.8-.3 1.4v2.2' />
    </Glyph>
  ),
  DEV: (
    <Glyph>
      <rect x='1.5' y='3' width='13' height='10' rx='2' />
      <path d='M4.2 6v4h.7c.8 0 1.2-.5 1.2-2s-.4-2-1.2-2h-.7Zm4.8 0H7.6v4H9M7.6 8h1.2m1.4-2 .9 4 .9-4' />
    </Glyph>
  ),
  'Stack Overflow': (
    <Glyph>
      <path d='M3 9.5V14h10V9.5M5.5 11.8h5M5.7 9.4l4.9.9M6.4 6.9l4.5 2M7.8 4.5l3.8 3.1M10 2.5l2.4 3.9' />
    </Glyph>
  ),
  Instagram: (
    <Glyph>
      <rect x='1.5' y='1.5' width='13' height='13' rx='4' />
      <circle cx='8' cy='8' r='3' />
      <path d='M11.8 4.2v.1' />
    </Glyph>
  ),
  Email: (
    <Glyph>
      <rect x='1.5' y='3' width='13' height='10' rx='2' />
      <path d='m2 4.5 6 4.5 6-4.5' />
    </Glyph>
  ),
};

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
        <div className='hero__id'>
          <img className='hero__photo' src='/images/kshitij-bhatnagar.jpg' alt='Kshitij Bhatnagar' width={480} height={480} fetchPriority='high' />
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
          <ul className='hero__social' aria-label='Kshitij Bhatnagar online'>
            {PROFILE.links.map((l) => (
              <li key={l.label}>
                <a href={l.href} target='_blank' rel='noopener noreferrer me'>
                  {GLYPHS[l.label]}
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${PROFILE.email}`}>
                {GLYPHS.Email}
                Email
              </a>
            </li>
          </ul>
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
