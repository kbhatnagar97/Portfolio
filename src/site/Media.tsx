import { useEffect, useRef, type CSSProperties } from 'react';
import { monogram, type IProject } from './data';

interface IMediaProps {
  project: IProject;
  play?: boolean;
  controls?: boolean;
  className?: string;
}

// Demo video when there is one, else a screenshot, else generated cover art in the project's accent.
const Media = ({ project, play = false, controls = false, className = '' }: IMediaProps) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !project.video) return;
    if (play) {
      if (!video.getAttribute('src')) video.src = project.video;
      video.play().catch(() => undefined);
    } else video.pause();
  }, [play, project.video]);

  // a poster attribute cannot lazy load, so set it only near the viewport or it competes with first paint
  useEffect(() => {
    const video = ref.current;
    const poster = project.poster;
    if (!video || !poster) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        video.poster = poster;
        io.disconnect();
      },
      { rootMargin: '100%' },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [project.poster]);

  if (project.video) {
    return (
      <video
        ref={ref}
        className={`media ${className}`}
        muted
        loop
        playsInline
        preload='none'
        controls={controls}
        aria-label={`${project.name} demo recording`}
      />
    );
  }

  if (project.poster) {
    return <img className={`media ${className}`} src={project.poster} alt={`${project.name} screenshot`} loading='lazy' decoding='async' />;
  }

  return (
    <div className={`media media--art ${className}`} style={{ '--accent': project.accent } as CSSProperties} role='img' aria-label={`${project.name} cover`}>
      <span className='media__mono'>{monogram(project.name)}</span>
      <span className='media__name'>{project.name}</span>
    </div>
  );
};

export default Media;
