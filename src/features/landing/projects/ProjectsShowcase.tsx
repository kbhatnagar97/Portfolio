import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  animate,
} from 'framer-motion';
import { FaArrowRight } from 'react-icons/fa';
import projectsData from '../../../content/projects.json';
import claudeStory from '../../../content/claude-story.json';
import type { IProject, IClaudeStory } from './types';
import { monogram } from './types';
import ProjectModal from './ProjectModal';
import './projects.scss';

const PROJECTS = projectsData as IProject[];
const STORY = claudeStory as IClaudeStory;

const CLAUDE_TAB = 'Claude';
const ALL_TAB = 'All';
const CATEGORY_ORDER = [
  'AI & Agents',
  'Web Apps',
  'Data & Finance',
  'Tools & Automation',
];

const TABS = [CLAUDE_TAB, ALL_TAB, ...CATEGORY_ORDER];

// #region Project card
interface ProjectCardProps {
  project: IProject;
  onOpen: (project: IProject) => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onOpen }) => {
  const ref = React.useRef<HTMLButtonElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [5, -5]), {
    stiffness: 200,
    damping: 18,
  });
  const ry = useSpring(useTransform(px, [0, 1], [-5, 5]), {
    stiffness: 200,
    damping: 18,
  });

  const handleMove = (e: React.MouseEvent) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    px.set(x);
    py.set(y);
    node.style.setProperty('--mx', `${x * 100}%`);
    node.style.setProperty('--my', `${y * 100}%`);
  };

  const handleLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.button
      ref={ref}
      type='button'
      className='proj-card'
      style={{
        rotateX: rx,
        rotateY: ry,
        ...({ '--accent': project.accent } as React.CSSProperties),
      }}
      variants={cardVariants}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={() => onOpen(project)}
      aria-label={`${project.name} — ${project.tagline}. View details`}
    >
      <span className='proj-card__spotlight' aria-hidden='true' />
      <span className='proj-card__border' aria-hidden='true' />

      <span className='proj-card__top'>
        <span className='proj-card__mono' aria-hidden='true'>
          {monogram(project.name)}
        </span>
        <span
          className={`proj-card__status proj-card__status--${project.status
            .toLowerCase()
            .replace(/\s+/g, '-')}`}
        >
          <span className='proj-card__dot' />
          {project.live ? 'Live' : project.status}
        </span>
      </span>

      <span className='proj-card__name'>{project.name}</span>
      <span className='proj-card__tagline'>{project.tagline}</span>
      <span className='proj-card__summary'>{project.summary}</span>

      <span className='proj-card__stack'>
        {project.stack.slice(0, 4).map((tech) => (
          <span key={tech} className='proj-card__tech'>
            {tech}
          </span>
        ))}
      </span>

      <span className='proj-card__cta'>
        Read more <FaArrowRight />
      </span>
    </motion.button>
  );
};
// #endregion

// #region Claude story stat counter
const StatCounter: React.FC<{ value: string }> = ({ value }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const m = /^(\d+)(.*)$/.exec(value);
  const isNum = !!m;
  const target = m ? parseInt(m[1], 10) : 0;
  const suffix = m ? m[2] : '';
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || !isNum) return;
    const controls = animate(0, target, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, isNum, target]);

  return <span ref={ref}>{isNum ? `${display}${suffix}` : value}</span>;
};
// #endregion

// #region Claude story panel
const ClaudeStoryPanel: React.FC = () => (
  <motion.div
    className='claude-panel'
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <div className='claude-panel__intro'>
      <span className='claude-panel__eyebrow'>{STORY.eyebrow}</span>
      <h3 className='claude-panel__title'>{STORY.title}</h3>
      <p className='claude-panel__lead'>{STORY.intro}</p>

      <div className='claude-panel__stats'>
        {STORY.stats.map((stat) => (
          <div key={stat.label} className='claude-stat'>
            <span className='claude-stat__value'>
              <StatCounter value={stat.value} />
            </span>
            <span className='claude-stat__label'>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>

    <div className='claude-panel__grid'>
      {STORY.sections.map((section, i) => (
        <motion.div
          key={section.id}
          className='claude-card'
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
        >
          <div className='claude-card__head'>
            <span className='claude-card__num' aria-hidden='true'>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h4 className='claude-card__title'>{section.title}</h4>
          </div>
          <p className='claude-card__body'>{section.body}</p>
          <ul className='claude-card__points'>
            {section.points.map((point, p) => (
              <li key={p}>{point}</li>
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  </motion.div>
);
// #endregion

const ProjectsShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(CLAUDE_TAB);
  const [selected, setSelected] = useState<IProject | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === CLAUDE_TAB || activeTab === ALL_TAB) return PROJECTS;
    return PROJECTS.filter((p) => p.category === activeTab);
  }, [activeTab]);

  const liveCount = PROJECTS.filter((p) => p.live).length;

  return (
    <section id='projects' className='showcase'>
      <div className='showcase__aurora' aria-hidden='true'>
        <span className='showcase__aurora-a' />
        <span className='showcase__aurora-b' />
        <span className='showcase__aurora-c' />
      </div>

      <div className='showcase__inner'>
        <div className='showcase__header'>
          <span className='showcase__eyebrow'>The work</span>
          <h2 className='showcase__title'>
            Things I&apos;ve built <span className='showcase__grad'>with AI</span>
          </h2>
          <p className='showcase__subtitle'>
            {PROJECTS.length}+ products and experiments — {liveCount} live on the
            web. Every one started with a real problem. Open any card to read why
            it exists.
          </p>
        </div>

        <div className='showcase__tabs' role='tablist' aria-label='Filter projects'>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                role='tab'
                aria-selected={isActive}
                className={`showcase__tab ${
                  isActive ? 'showcase__tab--active' : ''
                } ${tab === CLAUDE_TAB ? 'showcase__tab--claude' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {isActive && (
                  <motion.span
                    layoutId='tab-pill'
                    className='showcase__tab-pill'
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
                <span className='showcase__tab-label'>{tab}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode='wait'>
          {activeTab === CLAUDE_TAB && (
            <ClaudeStoryPanel key='claude-panel' />
          )}
        </AnimatePresence>

        <AnimatePresence mode='wait'>
          <motion.div
            key={activeTab}
            className='showcase__grid'
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05 } },
            }}
            initial='hidden'
            animate='show'
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={setSelected}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selected && (
          <ProjectModal
            project={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

export default ProjectsShowcase;
