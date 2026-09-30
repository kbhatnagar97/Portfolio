import type { CSSProperties, PointerEvent } from 'react';
import { AUTOMATIONS, type IAutomation } from '../data';
import { NH, NW, edgePath, layoutOf, mainRoute } from '../flow';
import { SHAPE } from '../scene/shapes';
import '../lab.scss';

// #region Mini board
// A live thumbnail of the real board: same layout, edges and route, with packets looping through it.
const MiniFlow = ({ flow }: { flow: IAutomation }) => {
  const { pos, w, h } = layoutOf(flow, false);
  const route = mainRoute(flow, pos);
  return (
    <svg className='acard__flow' viewBox={`0 0 ${w} ${h}`} aria-hidden='true'>
      {flow.edges.map(([a, b, kind]) => (
        <path key={`${a}-${b}`} className={`acard__wire acard__wire--${kind ?? 'main'}`} d={edgePath(pos[a], pos[b], kind)} />
      ))}
      {flow.nodes.map((n) => (
        <rect key={n.id} className={`acard__node acard__node--${n.kind}`} x={pos[n.id].x - NW / 2} y={pos[n.id].y - NH / 2} width={NW} height={NH} rx={16} />
      ))}
      {[0, 1, 2].map((i) => (
        <circle key={i} className='acard__packet' r={12}>
          <animateMotion dur='7s' repeatCount='indefinite' begin={`${-i * 2.3}s`} path={route} />
        </circle>
      ))}
    </svg>
  );
};
// #endregion

const AutomationCard = ({ flow, index, onOpen }: { flow: IAutomation; index: number; onOpen: (id: string) => void }) => {
  const tilt = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
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
        <MiniFlow flow={flow} />
        <span className='acard__corner acard__corner--tl' aria-hidden='true' />
        <span className='acard__corner acard__corner--br' aria-hidden='true' />
        <p className='acard__live'>
          <span className='lab__led lab__led--live' aria-hidden='true' /> Live · {flow.cadence}
        </p>
      </div>
      <div className='acard__body'>
        <p className='acard__meta'>
          <span>A{String(index + 1).padStart(2, '0')}</span>
          {flow.nodes.length} stages · {flow.edges.length} data lines
        </p>
        <h3 id={`a-${flow.id}`}>{flow.name}</h3>
        <p className='acard__tag'>{flow.tagline}</p>
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

const Automations = ({ onOpen }: { onOpen: (id: string) => void }) => (
  <section id='automations' className='autos' aria-labelledby='autos-title'>
    <header className='section-head' data-shape={SHAPE.network}>
      <p className='section-head__index'>03 / My personal automations</p>
      <h2 id='autos-title' data-split>
        Small robots that run my day while I build.
      </h2>
      <p className='autos__lead' data-fade>
        Each one is a real workflow running on my Mac right now. Launch one to open its control room: drag the stages around, run the pipeline, make the human call, and knock an AI model offline to watch the fallback take over.
      </p>
    </header>
    <div className='autos__grid'>
      {AUTOMATIONS.map((a, i) => (
        <AutomationCard key={a.id} flow={a} index={i} onOpen={onOpen} />
      ))}
    </div>
  </section>
);

export default Automations;
