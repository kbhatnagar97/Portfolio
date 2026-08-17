import type { CSSProperties, FC } from 'react';
import type { IconType } from 'react-icons';
import {
  SiReact,
  SiTypescript,
  SiJavascript,
  SiNextdotjs,
  SiNodedotjs,
  SiThreedotjs,
  SiPython,
  SiFirebase,
  SiGooglecloud,
  SiTailwindcss,
  SiSass,
  SiFramer,
  SiChartdotjs,
  SiVite,
  SiJest,
  SiDocker,
  SiPostgresql,
  SiGraphql,
  SiRedux,
  SiOpenai,
  SiGit,
  SiVercel,
} from 'react-icons/si';
import './TechMarquee.scss';

interface Tech {
  name: string;
  Icon: IconType;
  color: string;
}

const TECHS: Tech[] = [
  { name: 'React', Icon: SiReact, color: '#61dafb' },
  { name: 'TypeScript', Icon: SiTypescript, color: '#3178c6' },
  { name: 'JavaScript', Icon: SiJavascript, color: '#f7df1e' },
  { name: 'Next.js', Icon: SiNextdotjs, color: '#ffffff' },
  { name: 'Node.js', Icon: SiNodedotjs, color: '#5fa04e' },
  { name: 'Three.js', Icon: SiThreedotjs, color: '#ffffff' },
  { name: 'Python', Icon: SiPython, color: '#4b8bbe' },
  { name: 'Firebase', Icon: SiFirebase, color: '#ffca28' },
  { name: 'Google Cloud', Icon: SiGooglecloud, color: '#4285f4' },
  { name: 'Tailwind CSS', Icon: SiTailwindcss, color: '#06b6d4' },
  { name: 'Sass', Icon: SiSass, color: '#cc6699' },
  { name: 'Framer Motion', Icon: SiFramer, color: '#7c4dff' },
  { name: 'Chart.js', Icon: SiChartdotjs, color: '#ff6384' },
  { name: 'Vite', Icon: SiVite, color: '#646cff' },
  { name: 'Jest', Icon: SiJest, color: '#c21325' },
  { name: 'Docker', Icon: SiDocker, color: '#2496ed' },
  { name: 'PostgreSQL', Icon: SiPostgresql, color: '#4169e1' },
  { name: 'GraphQL', Icon: SiGraphql, color: '#e10098' },
  { name: 'Redux', Icon: SiRedux, color: '#764abc' },
  { name: 'OpenAI', Icon: SiOpenai, color: '#ffffff' },
  { name: 'Git', Icon: SiGit, color: '#f05032' },
  { name: 'Vercel', Icon: SiVercel, color: '#ffffff' },
];

const TechMarquee: FC = () => (
  <section className='marquee' aria-label='Technologies I work with'>
    <div className='marquee__track'>
      {[...TECHS, ...TECHS].map(({ name, Icon, color }, i) => (
        <span
          className='marquee__item'
          key={i}
          style={{ '--brand': color } as CSSProperties}
        >
          <Icon className='marquee__logo' aria-hidden='true' />
          <span className='marquee__label'>{name}</span>
        </span>
      ))}
    </div>
  </section>
);

export default TechMarquee;
