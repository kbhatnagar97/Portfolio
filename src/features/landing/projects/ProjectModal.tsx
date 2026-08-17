import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  FaTimes,
  FaExternalLinkAlt,
  FaGithub,
  FaLock,
} from 'react-icons/fa';
import type { IProject } from './types';
import { monogram } from './types';

interface ProjectModalProps {
  project: IProject;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  Live: 'Live',
  'In progress': 'In progress',
  Private: 'Private build',
  Research: 'In research',
};

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const openProject = () => {
    if (project.url) {
      window.open(project.url, '_blank', 'noopener,noreferrer');
    }
  };

  return createPortal(
    <motion.div
      className='pm-overlay'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        className='pm-dialog'
        style={{ '--accent': project.accent } as React.CSSProperties}
        ref={dialogRef}
        tabIndex={-1}
        role='dialog'
        aria-modal='true'
        aria-label={`${project.name} — ${project.tagline}`}
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='pm-glow' aria-hidden='true' />

        <button
          className='pm-close'
          onClick={onClose}
          aria-label='Close'
          type='button'
        >
          <FaTimes />
        </button>

        <header className='pm-header'>
          <div className='pm-mono' aria-hidden='true'>
            {monogram(project.name)}
          </div>
          <div className='pm-heading'>
            <div className='pm-badges'>
              <span className={`pm-status pm-status--${project.status
                .toLowerCase()
                .replace(/\s+/g, '-')}`}
              >
                <span className='pm-dot' /> {STATUS_LABEL[project.status] ?? project.status}
              </span>
              <span className='pm-chip pm-chip--ghost'>{project.category}</span>
              <span className='pm-chip pm-chip--ghost'>{project.year}</span>
            </div>
            <h3 className='pm-title'>{project.name}</h3>
            <p className='pm-tagline'>{project.tagline}</p>
          </div>
        </header>

        <div className='pm-body'>
          <section className='pm-block'>
            <h4 className='pm-block__label'>The spark</h4>
            <p className='pm-block__text'>{project.spark}</p>
          </section>

          <section className='pm-block'>
            <h4 className='pm-block__label'>What I built</h4>
            <p className='pm-block__text'>{project.build}</p>
          </section>

          <section className='pm-block'>
            <h4 className='pm-block__label'>Architecture &amp; decisions</h4>
            <ul className='pm-arch'>
              {project.architecture.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section className='pm-block'>
            <h4 className='pm-block__label'>Highlights</h4>
            <div className='pm-highlights'>
              {project.highlights.map((item, i) => (
                <span key={i} className='pm-highlight'>
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className='pm-block'>
            <h4 className='pm-block__label'>Built with</h4>
            <div className='pm-stack'>
              {project.stack.map((tech) => (
                <span key={tech} className='pm-tech'>
                  {tech}
                </span>
              ))}
            </div>
          </section>
        </div>

        <footer className='pm-footer'>
          {project.live && project.url ? (
            <button className='pm-btn pm-btn--primary' onClick={openProject}>
              Open project <FaExternalLinkAlt />
            </button>
          ) : (
            <span className='pm-btn pm-btn--locked' aria-disabled='true'>
              <FaLock /> Private build
            </span>
          )}
          {project.repo && (
            <a
              className='pm-btn pm-btn--ghost'
              href={project.repo}
              target='_blank'
              rel='noopener noreferrer'
            >
              <FaGithub /> Source
            </a>
          )}
        </footer>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default ProjectModal;
