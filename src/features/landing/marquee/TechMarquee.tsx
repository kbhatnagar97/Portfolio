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
  SiGit,
  SiVercel,
} from 'react-icons/si';
import './TechMarquee.scss';

interface Tech {
  name: string;
  Icon: IconType;
  color: string;
  url: string;
}

const TECHS: Tech[] = [
  { name: 'React', Icon: SiReact, color: '#61dafb', url: 'https://react.dev' },
  {
    name: 'TypeScript',
    Icon: SiTypescript,
    color: '#3178c6',
    url: 'https://www.typescriptlang.org/docs/',
  },
  {
    name: 'JavaScript',
    Icon: SiJavascript,
    color: '#f7df1e',
    url: 'https://developer.mozilla.org/docs/Web/JavaScript',
  },
  {
    name: 'Next.js',
    Icon: SiNextdotjs,
    color: '#ffffff',
    url: 'https://nextjs.org/docs',
  },
  {
    name: 'Node.js',
    Icon: SiNodedotjs,
    color: '#5fa04e',
    url: 'https://nodejs.org/en/docs',
  },
  {
    name: 'Three.js',
    Icon: SiThreedotjs,
    color: '#ffffff',
    url: 'https://threejs.org/docs/',
  },
  {
    name: 'Python',
    Icon: SiPython,
    color: '#4b8bbe',
    url: 'https://docs.python.org/3/',
  },
  {
    name: 'Firebase',
    Icon: SiFirebase,
    color: '#ffca28',
    url: 'https://firebase.google.com/docs',
  },
  {
    name: 'Google Cloud',
    Icon: SiGooglecloud,
    color: '#4285f4',
    url: 'https://cloud.google.com/docs',
  },
  {
    name: 'Tailwind CSS',
    Icon: SiTailwindcss,
    color: '#06b6d4',
    url: 'https://tailwindcss.com/docs',
  },
  {
    name: 'Sass',
    Icon: SiSass,
    color: '#cc6699',
    url: 'https://sass-lang.com/documentation/',
  },
  {
    name: 'Framer Motion',
    Icon: SiFramer,
    color: '#7c4dff',
    url: 'https://www.framer.com/motion/',
  },
  {
    name: 'Chart.js',
    Icon: SiChartdotjs,
    color: '#ff6384',
    url: 'https://www.chartjs.org/docs/latest/',
  },
  {
    name: 'Vite',
    Icon: SiVite,
    color: '#646cff',
    url: 'https://vite.dev/guide/',
  },
  {
    name: 'Jest',
    Icon: SiJest,
    color: '#c21325',
    url: 'https://jestjs.io/docs/getting-started',
  },
  {
    name: 'Docker',
    Icon: SiDocker,
    color: '#2496ed',
    url: 'https://docs.docker.com/',
  },
  {
    name: 'PostgreSQL',
    Icon: SiPostgresql,
    color: '#4169e1',
    url: 'https://www.postgresql.org/docs/',
  },
  {
    name: 'GraphQL',
    Icon: SiGraphql,
    color: '#e10098',
    url: 'https://graphql.org/learn/',
  },
  {
    name: 'Redux',
    Icon: SiRedux,
    color: '#764abc',
    url: 'https://redux.js.org/',
  },
  {
    name: 'Git',
    Icon: SiGit,
    color: '#f05032',
    url: 'https://git-scm.com/doc',
  },
  {
    name: 'Vercel',
    Icon: SiVercel,
    color: '#ffffff',
    url: 'https://vercel.com/docs',
  },
];

const TechMarquee: FC = () => (
  <section className='marquee' aria-label='Technologies I work with'>
    <div className='marquee__track'>
      {[...TECHS, ...TECHS].map(({ name, Icon, color, url }, i) => (
        <a
          className='marquee__item'
          key={i}
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          title={`${name} — open documentation`}
          style={{ '--brand': color } as CSSProperties}
        >
          <Icon className='marquee__logo' aria-hidden='true' />
          <span className='marquee__label'>{name}</span>
        </a>
      ))}
    </div>
  </section>
);

export default TechMarquee;
