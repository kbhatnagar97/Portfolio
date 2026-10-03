import { Suspense, useState } from 'react';
import { AWARDS, EARLY, PROFILE, ROLES } from '../data';
import { SHAPE } from '../scene/waypoints';
import { lazyOrNothing } from '../lazy';
import type { ILightbox } from './Lightbox';

const Lightbox = lazyOrNothing(() => import('./Lightbox'));

// the employer is named once, as the group label, so the page stays about the person
const EMPLOYER = ROLES[0].COMPANY;
const SINCE = new Date(`${PROFILE.careerStart}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const Journey = () => {
  const [box, setBox] = useState<ILightbox>();
  const [boxOn, setBoxOn] = useState(false);
  const show = (b: ILightbox) => {
    setBoxOn(true);
    setBox(b);
  };

  return (
    <section id='journey' className='journey' aria-labelledby='journey-title'>
      <header className='section-head' data-shape={SHAPE.field}>
        <p className='section-head__index'>04 / Journey</p>
        <h2 id='journey-title' data-split>
          From circuits and GSM modules to enterprise frontends and AI products.
        </h2>
      </header>

      <div className='block'>
        <h3 className='block__label'>Experience</h3>
        <ol className='timeline'>
          <li className='timeline__group'>
            <p className='eyebrow timeline__org' data-fade>
              {EMPLOYER}, {SINCE} to present
            </p>
            <ol>
              {ROLES.map((r) => (
                <li className='timeline__item' key={r.POSITION} data-fade>
                  <p className='timeline__when'>{r.DURATION}</p>
                  <div>
                    <h4>{r.POSITION}</h4>
                    <p className='timeline__focus'>{r.TYPE}</p>
                    <ul className='ticks'>
                      {r.ACHIEVEMENTS.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </li>
          {EARLY.map((e) => (
            <li className='timeline__item timeline__item--early' key={e.COMPANY} data-fade>
              <p className='timeline__when'>{e.DURATION}</p>
              <div>
                <h4>
                  {e.ROLE} <span>· {e.COMPANY}</span>
                </h4>
                <p className='timeline__focus'>{e.FOCUS}</p>
                {'CERTIFICATE' in e && e.CERTIFICATE && (
                  <button type='button' className='text-link' onClick={() => show({ title: `${e.COMPANY} internship`, images: [e.CERTIFICATE as string] })}>
                    View certificate
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className='block'>
        <h3 className='block__label'>Recognition</h3>
        <ul className='awards'>
          {AWARDS.map((a) => (
            <li key={a.TITLE} data-fade>
              <button type='button' className='award' onClick={() => show({ title: a.TITLE, images: a.IMAGES })}>
                <span className='award__thumb'>
                  <img src={a.IMAGES[0]} alt={/certificate$/i.test(a.TITLE) ? a.TITLE : `${a.TITLE} certificate`} loading='lazy' decoding='async' />
                  {a.IMAGES.length > 1 && <span className='award__count'>{a.IMAGES.length}</span>}
                </span>
                <span className='award__title'>{a.TITLE}</span>
                <span className='award__sub'>
                  {a.SUBTITLE === EMPLOYER ? '' : `${a.SUBTITLE}. `}
                  {a.DESCRIPTION}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className='block'>
        <h3 className='block__label'>Education</h3>
        <div className='edu'>
          {PROFILE.education.map((e) => (
            <div className='edu__item' key={e.institution} data-fade>
              <p className='timeline__when'>{e.duration}</p>
              <h4>{e.institution}</h4>
              <p>
                {e.degree}
                {'minor' in e && e.minor ? `, ${e.minor}` : ''}
                {'grade' in e && e.grade ? `. ${e.grade}` : ''}
              </p>
              <button type='button' className='text-link' onClick={() => show({ title: e.institution, images: e.certificates })}>
                View {e.certificates.length} certificates
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className='block'>
        <h3 className='block__label'>Before software</h3>
        <div>
          <ul className='mini-grid'>
            {PROFILE.collegeProjects.map((c) => (
              <li className='mini' key={c.title} data-fade>
                <p className='timeline__when'>{c.year}</p>
                <h4>{c.title}</h4>
                <p>{c.body}</p>
                <p className='mini__tech'>{c.tech}</p>
              </li>
            ))}
          </ul>
          <ul className='chips chips--roles' data-fade aria-label='Leadership at VIT'>
            {PROFILE.leadership.map((l) => (
              <li className='chip' key={l}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {boxOn && (
        <Suspense fallback={null}>
          <Lightbox box={box} onClose={() => setBox(undefined)} />
        </Suspense>
      )}
    </section>
  );
};

export default Journey;
