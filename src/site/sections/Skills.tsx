import type { CSSProperties } from 'react';
import { PROFILE, projectById, shapeOf } from '../data';

const Skills = ({ onOpen }: { onOpen: (id: string) => void }) => (
  <section id='skills' className='skills' aria-labelledby='skills-title'>
    <header className='section-head'>
      <p className='section-head__index'>01 / What I do</p>
      <h2 id='skills-title' data-split>
        Four things I do well, and the work that proves each one.
      </h2>
    </header>

    {PROFILE.skills.map((skill, i) => (
      <article className='skill' key={skill.id} data-shape={shapeOf(skill.shape)} aria-labelledby={`skill-${skill.id}`}>
        <div className='skill__body'>
          <p className='skill__num'>
            <span>0{i + 1}</span> / 0{PROFILE.skills.length}
          </p>
          <h3 id={`skill-${skill.id}`} data-split>
            {skill.title}
          </h3>
          <p className='skill__text' data-fade>
            {skill.body}
          </p>
          <ul className='skill__proof' data-fade>
            {skill.proof.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <ul className='chips' data-fade aria-label='Tools'>
            {skill.tools.map((t) => (
              <li key={t} className='chip'>
                {t}
              </li>
            ))}
          </ul>
          <div className='skill__seen' data-fade>
            <span>Seen in</span>
            {skill.projects.map((id) => {
              const p = projectById(id);
              return p ? (
                <button type='button' key={id} className='link-pill' onClick={() => onOpen(id)} style={{ '--accent': p.accent } as CSSProperties}>
                  {p.name}
                </button>
              ) : null;
            })}
          </div>
        </div>
      </article>
    ))}
  </section>
);

export default Skills;
