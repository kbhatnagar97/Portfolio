import type { CSSProperties } from 'react';
import cards from 'virtual:case-cards';
import { home } from '../../content/cases/overview.json';
import type { ICaseCard } from '../../cases/build/types';
import { SHAPE } from '../scene/waypoints';
import '../cases.scss';

// #region Card
// the title is the card's one link, a real page load; the cards ship the flagship's three proofs and one for the others
const CaseCard = ({ card: c }: { card: ICaseCard }) => (
  <article className={`ccard${c.flagship ? ' ccard--flagship' : ''}`} style={{ '--accent': c.accent } as CSSProperties} aria-labelledby={`cc-${c.slug}`}>
    <div className='ccard__media'>
      {c.poster.src && (
        <picture>
          {c.poster.webp && <source type='image/webp' srcSet={c.poster.webp} />}
          <img src={c.poster.src} width={c.poster.width} height={c.poster.height} alt={c.poster.alt} loading='lazy' decoding='async' />
        </picture>
      )}
    </div>
    <div className='ccard__body'>
      <p className='ccard__meta'>
        {c.industry} · {c.year}
      </p>
      <h3 id={`cc-${c.slug}`} className='ccard__title'>
        <a href={`/case-studies/${c.slug}/`}>{c.title}</a>
      </h3>
      <p className='ccard__kicker'>{c.kicker}</p>
      <p className='ccard__deck'>{c.line}</p>
      <p className={`ccard__status${/^Live\b/.test(c.status) ? ' ccard__status--live' : ''}`}>{c.status}</p>
    </div>
    <ul className='ccard__proofs'>
      {c.impact.map((m) => (
        <li key={m.label}>
          <span className='ccard__value'>{m.value}</span> {m.label} <span className='ccard__kind'>{m.kind}</span>
          {m.note && <span className='ccard__note'>{m.note}</span>}
        </li>
      ))}
    </ul>
  </article>
);
// #endregion

const CaseStudies = () => (
  <section id='case-studies' className='cases' aria-labelledby='cases-title'>
    <header className='section-head'>
      {/* the stack's stage: the calm field returns on both sides of it, so the shape forms, holds and settles where no type sits */}
      <div className='cases__stage' aria-hidden='true'>
        <span data-shape={SHAPE.field} />
        <span data-shape={SHAPE.stack} />
        <span data-shape={SHAPE.field} />
      </div>
      <p className='section-head__index'>{home.index}</p>
      <h2 id='cases-title' data-split>
        {home.title}
      </h2>
      <p className='cases__lead' data-fade>
        {home.line}
      </p>
    </header>
    <ol className='cases__grid' data-shape={SHAPE.field}>
      {cards.map((c) => (
        <li key={c.slug} className={`cases__item${c.flagship ? ' cases__item--flagship' : ''}`} data-fade>
          <CaseCard card={c} />
        </li>
      ))}
    </ol>
    <p className='cases__more'>
      <a className='btn btn--ghost' href='/case-studies/'>
        {home.cta}
      </a>
    </p>
  </section>
);

export default CaseStudies;
