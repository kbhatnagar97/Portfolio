import { LIVE_COUNT, PROJECTS, STORY } from '../data';
import { SHAPE } from '../scene/shapes';

const STATS = [{ value: String(PROJECTS.length), label: 'products and experiments' }, { value: String(LIVE_COUNT), label: 'live on the web' }, ...STORY.stats];

const Process = () => (
  <section id='process' className='process' aria-labelledby='process-title'>
    <header className='section-head'>
      <p className='section-head__index'>05 / How I work</p>
      <h2 id='process-title' data-split>
        {STORY.intro}
      </h2>
    </header>
    <div className='process__grid' data-shape={SHAPE.field}>
      <p className='process__text' data-fade>
        {STORY.summary}
      </p>
      <dl className='process__stats'>
        {STATS.map((s) => (
          <div key={s.label} data-fade>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);

export default Process;
