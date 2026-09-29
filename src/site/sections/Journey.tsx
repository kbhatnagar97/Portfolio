import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AWARDS, EARLY, PROFILE, ROLES } from '../data';
import { SHAPE } from '../scene/shapes';
import Lightbox, { type ILightbox } from './Lightbox';

const Journey = () => {
  const [box, setBox] = useState<ILightbox>();

  return (
    <section id='journey' className='journey' aria-labelledby='journey-title'>
      <header className='section-head' data-shape={SHAPE.field}>
        <p className='section-head__index'>03 / Journey</p>
        <h2 id='journey-title' data-split>
          From circuits and GSM modules to enterprise frontends and AI products.
        </h2>
      </header>

      <div className='block'>
        <h3 className='block__label'>Experience</h3>
        <ol className='timeline'>
          {ROLES.map((r) => (
            <li className='timeline__item' key={r.POSITION} data-fade>
              <p className='timeline__when'>{r.DURATION}</p>
              <div>
                <h4>
                  {r.POSITION} <span>· {r.COMPANY}</span>
                </h4>
                <p className='timeline__focus'>{r.TYPE}</p>
                <ul className='ticks'>
                  {r.ACHIEVEMENTS.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
          {EARLY.map((e) => (
            <li className='timeline__item timeline__item--early' key={e.COMPANY} data-fade>
              <p className='timeline__when'>{e.DURATION}</p>
              <div>
                <h4>
                  {e.ROLE} <span>· {e.COMPANY}</span>
                </h4>
                <p className='timeline__focus'>{e.FOCUS}</p>
                {'CERTIFICATE' in e && e.CERTIFICATE && (
                  <button type='button' className='text-link' onClick={() => setBox({ title: `${e.COMPANY} internship`, images: [e.CERTIFICATE as string] })}>
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
              <button type='button' className='award' onClick={() => setBox({ title: a.TITLE, images: a.IMAGES })}>
                <span className='award__thumb'>
                  <img src={a.IMAGES[0]} alt='' loading='lazy' decoding='async' />
                  {a.IMAGES.length > 1 && <span className='award__count'>{a.IMAGES.length}</span>}
                </span>
                <span className='award__title'>{a.TITLE}</span>
                <span className='award__sub'>
                  {a.SUBTITLE}. {a.DESCRIPTION}
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
              <button type='button' className='text-link' onClick={() => setBox({ title: e.institution, images: e.certificates })}>
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

      <AnimatePresence>{box && <Lightbox key='lightbox' box={box} onClose={() => setBox(undefined)} />}</AnimatePresence>
    </section>
  );
};

export default Journey;
