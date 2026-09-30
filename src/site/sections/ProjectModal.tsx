import { useEffect, useRef, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { lockScroll } from '../smooth';
import { PROJECTS, statusLabel, type IProject } from '../data';
import Media from '../Media';

interface IProjectModalProps {
  project: IProject;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const ProjectModal = ({ project, onClose, onNavigate }: IProjectModalProps) => {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const index = PROJECTS.indexOf(project);
  const prev = PROJECTS[(index - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(index + 1) % PROJECTS.length];

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    lockScroll(true);
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      lockScroll(false);
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    card.current?.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(next.id);
      if (e.key === 'ArrowLeft') onNavigate(prev.id);
      if (e.key === 'Tab' && card.current) {
        const focusable = card.current.querySelectorAll<HTMLElement>('a[href], button, video[controls]');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [project, next.id, prev.id, onClose, onNavigate]);

  const showcase = { ...project, video: project.film ?? project.video };

  return (
    <motion.div className='modal' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={onClose}>
      <motion.div
        ref={card}
        className='modal__card'
        role='dialog'
        aria-modal='true'
        aria-labelledby='modal-title'
        data-lenis-prevent
        style={{ '--accent': project.accent } as CSSProperties}
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className='modal__bar'>
          <p className='modal__crumb'>
            {String(index + 1).padStart(2, '0')} / {PROJECTS.length} · {project.category}
          </p>
          <button ref={closeBtn} type='button' className='modal__close' onClick={onClose} aria-label='Close project'>
            <span aria-hidden='true'>×</span>
          </button>
        </header>

        <div className='modal__hero'>
          <div>
            <p className='modal__status'>
              <span className={`status status--${statusLabel(project).toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel(project)}</span>
              <span>{project.year}</span>
            </p>
            <h2 id='modal-title'>{project.name}</h2>
            <p className='modal__tagline'>{project.tagline}</p>
          </div>
          <div className='modal__links'>
            {project.url && (
              <a className='btn btn--solid' href={project.url} target='_blank' rel='noopener noreferrer'>
                Visit site <span aria-hidden='true'>↗</span>
              </a>
            )}
            {project.repo && (
              <a className='btn btn--ghost' href={project.repo} target='_blank' rel='noopener noreferrer'>
                Source <span aria-hidden='true'>↗</span>
              </a>
            )}
            {project.writeup && (
              <a className='btn btn--ghost' href={project.writeup} target='_blank' rel='noopener noreferrer'>
                How it works <span aria-hidden='true'>↗</span>
              </a>
            )}
            {!project.url && !project.repo && !project.writeup && <p className='modal__private'>Not publicly available yet.</p>}
          </div>
        </div>

        <div className='modal__media' key={project.id}>
          <Media project={showcase} play controls={!!showcase.video} />
        </div>

        <div className='modal__grid'>
          <div className='modal__story'>
            <p className='modal__summary'>{project.summary}</p>
            <h3>Why it exists</h3>
            <p>{project.spark}</p>
            <h3>What I built</h3>
            <p>{project.build}</p>
          </div>
          <aside className='modal__facts'>
            <h3>Architecture</h3>
            <ul className='ticks'>
              {project.architecture.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <h3>Highlights</h3>
            <ul className='ticks'>
              {project.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <h3>Built with</h3>
            <ul className='chips chips--small'>
              {project.stack.map((t) => (
                <li className='chip' key={t}>
                  {t}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <nav className='modal__nav' aria-label='More projects'>
          <button type='button' onClick={() => onNavigate(prev.id)}>
            <span aria-hidden='true'>←</span> {prev.name}
          </button>
          <button type='button' onClick={() => onNavigate(next.id)}>
            {next.name} <span aria-hidden='true'>→</span>
          </button>
        </nav>
      </motion.div>
    </motion.div>
  );
};

export default ProjectModal;
