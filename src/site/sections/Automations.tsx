import type { CSSProperties, PointerEvent } from 'react';
import { AUTOMATIONS, AUTOMATION_INDEX, ledClass, projectById, runLabel, storyLink, type IAutomationCard, type IAutomationLine } from '../data';
import { SHAPE } from '../scene/waypoints';
import '../lab.scss';
import { BotFloor } from '../bots/BotFloor';

const AutomationCard = ({ flow, index, onOpen }: { flow: IAutomationCard; index: number; onOpen: (id: string) => void }) => {
  const page = projectById(flow.id);
  const tilt = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    // a tilted card would skew the bot floor's pointer mapping
    if ((e.target as HTMLElement).closest('.acard__screen')) {
      ['--rx', '--ry'].forEach((p) => e.currentTarget.style.removeProperty(p));
      return;
    }
    e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -5}deg`);
    e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 7}deg`);
  };

  return (
    <article
      className='acard'
      style={{ '--accent': flow.accent } as CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={(e) => ['--rx', '--ry'].forEach((p) => e.currentTarget.style.removeProperty(p))}
      aria-labelledby={`a-${flow.id}`}
      data-fade
    >
      <div className='acard__screen'>
        <BotFloor flow={flow.crew} />
        <span className='acard__corner acard__corner--tl' aria-hidden='true' />
        <span className='acard__corner acard__corner--br' aria-hidden='true' />
        <p className='acard__live'>
          <span className={ledClass(flow)} aria-hidden='true' /> {runLabel(flow)}
        </p>
      </div>
      <div className='acard__body'>
        <p className='acard__meta'>
          <span>A{String(index + 1).padStart(2, '0')}</span>
          {flow.stages} stages · {flow.lines} data lines
        </p>
        <h3 id={`a-${flow.id}`}>
          {page ? (
            <a className='acard__name' {...storyLink(page, onOpen)}>
              {flow.name}
            </a>
          ) : (
            flow.name
          )}
        </h3>
        <p className='acard__tag'>{flow.tagline}</p>
        {flow.note && <p className='acard__note'>{flow.note}</p>}
        <dl className='acard__stats'>
          {flow.stats.map((s) => (
            <div key={s.label}>
              <dd>{s.value.toLocaleString('en-IN')}</dd>
              <dt>{s.label}</dt>
            </div>
          ))}
        </dl>
        <button type='button' className='acard__launch' onClick={() => onOpen(flow.id)}>
          <span className='acard__core' aria-hidden='true' />
          Launch the workflow
          <span aria-hidden='true'>→</span>
        </button>
      </div>
    </article>
  );
};

// #region Full list
const LineName = ({ line, onOpen }: { line: IAutomationLine; onOpen: (id: string) => void }) => {
  const page = line.project ? projectById(line.project) : undefined;
  if (line.lab) {
    const lab = line.lab;
    return (
      <button type='button' className='autos__name' onClick={() => onOpen(lab)}>
        {line.name}
        <span className='sr-only'>, open its workflow board</span>
      </button>
    );
  }
  if (page) {
    return (
      <a className='autos__name' {...storyLink(page, onOpen)}>
        {line.name}
        <span className='sr-only'>, read the project story</span>
      </a>
    );
  }
  return <span className='autos__name'>{line.name}</span>;
};

const AutomationIndex = ({ onOpen }: { onOpen: (id: string) => void }) => (
  <aside className='autos__index' aria-labelledby='autos-index-title' data-fade>
    <p className='eyebrow'>The full list</p>
    <h3 id='autos-index-title'>Every personal automation I have built, one line each.</h3>
    <ul className='autos__lines'>
      {AUTOMATION_INDEX.map((line) => (
        <li key={line.name} className={`autos__line ${line.lab ? 'autos__line--lab' : ''}`}>
          <LineName line={line} onOpen={onOpen} />
          <span className='autos__does'>{line.does}</span>
          <span className='autos__cadence'>
            {line.cadence}
            {line.status && <span className='autos__status'>{line.status}</span>}
          </span>
          {line.lab && <span className='autos__shown'>Shown above</span>}
        </li>
      ))}
    </ul>
  </aside>
);
// #endregion

const Automations = ({ onOpen }: { onOpen: (id: string) => void }) => (
  <section id='automations' className='autos' aria-labelledby='autos-title'>
    <header className='section-head' data-shape={SHAPE.field}>
      <p className='section-head__index'>03 / My personal automations</p>
      <h2 id='autos-title' data-split>
        Small robots that run my day while I build.
      </h2>
      <p className='autos__lead' data-fade>
        Each one is a real workflow I built for myself, and the ones marked live are running today. Launch one to open its control room: drag the stages around, run the pipeline, make the human call, and knock an AI model offline to watch the fallback take over.
      </p>
    </header>
    <div className='autos__grid'>
      {AUTOMATIONS.map((a, i) => (
        <AutomationCard key={a.id} flow={a} index={i} onOpen={onOpen} />
      ))}
    </div>
    <AutomationIndex onOpen={onOpen} />
  </section>
);

export default Automations;
