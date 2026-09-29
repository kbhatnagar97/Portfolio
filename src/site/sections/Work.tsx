import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { gsap } from '../smooth';
import { CATEGORIES, FEATURED, LIVE_COUNT, PROJECTS, statusLabel, type IProject } from '../data';
import { SHAPE } from '../scene/shapes';
import Media from '../Media';

const statusClass = (p: IProject) => `status status--${statusLabel(p).toLowerCase().replace(/\s+/g, '-')}`;

// #region Featured card
const FeaturedCard = ({ project, index, onOpen }: { project: IProject; index: number; onOpen: (id: string) => void }) => {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.55 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
    e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
  };

  return (
    <article ref={ref} className='fcard' style={{ '--accent': project.accent } as CSSProperties} aria-labelledby={`f-${project.id}`}>
      <div className='fcard__media' onPointerMove={tilt} onPointerLeave={(e) => e.currentTarget.style.cssText = ''}>
        <Media project={project} play={inView} />
        <span className={statusClass(project)}>{statusLabel(project)}</span>
      </div>
      <div className='fcard__info'>
        <p className='fcard__meta'>
          <span>{String(index + 1).padStart(2, '0')}</span>
          {project.category} · {project.year}
        </p>
        <h3 id={`f-${project.id}`}>{project.name}</h3>
        <p className='fcard__tag'>{project.tagline}</p>
        <p className='fcard__sum'>{project.summary}</p>
        <ul className='chips chips--small' aria-label='Built with'>
          {project.stack.slice(0, 5).map((t) => (
            <li className='chip' key={t}>
              {t}
            </li>
          ))}
        </ul>
        <div className='fcard__actions'>
          <button type='button' className='btn btn--solid' onClick={() => onOpen(project.id)}>
            Read the story
          </button>
          {project.url && (
            <a className='btn btn--ghost' href={project.url} target='_blank' rel='noopener noreferrer'>
              Visit site <span aria-hidden='true'>↗</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
};
// #endregion

// #region Cursor preview
const Preview = ({ project }: { project?: IProject }) => {
  const ref = useRef<HTMLDivElement>(null);
  // mount a preview only once it has been hovered, so posters are not all fetched on load
  const [seen, setSeen] = useState<string[]>([]);
  if (project && !seen.includes(project.id)) setSeen([...seen, project.id]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    const move = (e: globalThis.PointerEvent) => {
      x(e.clientX + 28);
      y(e.clientY - 120);
    };
    addEventListener('pointermove', move, { passive: true });
    return () => removeEventListener('pointermove', move);
  }, []);

  return (
    <div ref={ref} className={`preview ${project ? 'is-visible' : ''}`} aria-hidden='true'>
      {PROJECTS.filter((p) => seen.includes(p.id)).map((p) => (
        <div key={p.id} className={`preview__item ${project?.id === p.id ? 'is-active' : ''}`}>
          <Media project={p} play={project?.id === p.id} />
        </div>
      ))}
    </div>
  );
};
// #endregion

const Work = ({ onOpen }: { onOpen: (id: string) => void }) => {
  const [filter, setFilter] = useState('All');
  const [hover, setHover] = useState<IProject>();
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  const filters = useMemo(
    () => [
      { id: 'All', count: PROJECTS.length },
      { id: 'Live', count: LIVE_COUNT },
      ...CATEGORIES.map((c) => ({ id: c, count: PROJECTS.filter((p) => p.category === c).length })),
    ],
    [],
  );

  const list = PROJECTS.filter((p) => filter === 'All' || (filter === 'Live' ? p.live : p.category === filter));

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const el = track.current;
      if (!el) return;
      const distance = () => el.scrollWidth - innerWidth;
      gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id='work' className='work' aria-labelledby='work-title'>
      <header className='section-head' data-shape={SHAPE.field}>
        <p className='section-head__index'>02 / Work</p>
        <h2 id='work-title' data-split>
          {PROJECTS.length} projects, {LIVE_COUNT} of them live. Each one started with a real problem.
        </h2>
      </header>

      <div className='featured' ref={pin}>
        <div className='featured__track' ref={track}>
          <div className='featured__intro'>
            <p className='eyebrow'>Featured</p>
            <p className='featured__lead'>Six products people can use today. Each opens into the full story: why it exists, how it is built, what it does.</p>
            <p className='featured__hint' aria-hidden='true'>
              Keep scrolling <span>→</span>
            </p>
          </div>
          {FEATURED.map((p, i) => (
            <FeaturedCard key={p.id} project={p} index={i} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <div className='index'>
        <div className='index__head'>
          <h3 data-split>Every project</h3>
          <div className='filters' role='group' aria-label='Filter projects'>
            {filters.map((f) => (
              <button key={f.id} type='button' className={`filter ${filter === f.id ? 'is-active' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.id} <span>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        <ul className='index__list' onPointerLeave={() => setHover(undefined)}>
          {list.map((p) => (
            <li key={p.id}>
              <button
                type='button'
                className='row'
                style={{ '--accent': p.accent } as CSSProperties}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p)}
                onClick={() => onOpen(p.id)}
                aria-label={`${p.name}: ${p.tagline}. Open the story`}
              >
                <span className='row__num'>{String(PROJECTS.indexOf(p) + 1).padStart(2, '0')}</span>
                <span className='row__name'>{p.name}</span>
                <span className='row__tag'>{p.tagline}</span>
                <span className='row__cat'>{p.category}</span>
                <span className='row__year'>{p.year}</span>
                <span className={statusClass(p)}>{statusLabel(p)}</span>
                <span className='row__arrow' aria-hidden='true'>
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Preview project={hover} />
      </div>
    </section>
  );
};

export default Work;
