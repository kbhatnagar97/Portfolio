import type { FC } from 'react';
import './TechMarquee.scss';

const TECHS = [
  'React',
  'TypeScript',
  'Next.js',
  'Node.js',
  'Three.js',
  'Python',
  'Firebase',
  'Google Cloud',
  'Tailwind CSS',
  'SCSS',
  'Framer Motion',
  'Chart.js',
  'Vite',
  'Jest',
  'Docker',
  'PostgreSQL',
  'GraphQL',
  'Redux',
  'WebGL',
  'Vercel',
];

const TechMarquee: FC = () => (
  <section className='marquee' aria-label='Technologies I work with'>
    <div className='marquee__track'>
      {[...TECHS, ...TECHS].map((tech, i) => (
        <span className='marquee__item' key={i}>
          <span className='marquee__label'>{tech}</span>
          <span className='marquee__sep' aria-hidden='true' />
        </span>
      ))}
    </div>
  </section>
);

export default TechMarquee;
