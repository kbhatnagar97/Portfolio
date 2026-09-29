import { useRef, useState } from 'react';
import { useMagnetic } from '../motion';
import { PROFILE } from '../data';
import { SHAPE } from '../scene/shapes';

const Contact = () => {
  const [copied, setCopied] = useState(false);
  const mail = useRef<HTMLAnchorElement>(null);
  useMagnetic(mail, 0.2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${PROFILE.email}`;
    }
  };

  return (
    <section id='contact' className='contact' aria-labelledby='contact-title'>
      <div className='contact__inner' data-shape={SHAPE.ring}>
        <p className='section-head__index'>05 / Contact</p>
        <h2 id='contact-title' data-split>
          Have an idea worth <em>building?</em>
        </h2>
        <p className='contact__lead' data-fade>
          Products, frontend architecture, 3D on the web or putting AI to real work. Write to me, it goes straight to my inbox.
        </p>
        <div className='contact__actions' data-fade>
          <a ref={mail} className='btn btn--solid btn--big' href={`mailto:${PROFILE.email}`}>
            {PROFILE.email}
          </a>
          <button type='button' className='btn btn--ghost' onClick={copy} aria-live='polite'>
            {copied ? 'Copied' : 'Copy email'}
          </button>
        </div>
        <ul className='contact__links' data-fade>
          {PROFILE.links.map((l) => (
            <li key={l.label}>
              <a href={l.href} target='_blank' rel='noopener noreferrer'>
                {l.label} <span aria-hidden='true'>↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <footer className='footer'>
        <p>© {new Date().getFullYear()} {PROFILE.name}</p>
        <p>Built with React, three.js, GSAP and Claude. Every particle is drawn in a shader.</p>
      </footer>
    </section>
  );
};

export default Contact;
