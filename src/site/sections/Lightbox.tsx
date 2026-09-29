import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { lockScroll } from '../smooth';

export interface ILightbox {
  title: string;
  images: string[];
}

const Lightbox = ({ box, onClose }: { box: ILightbox; onClose: () => void }) => {
  const [i, setI] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  const many = box.images.length > 1;
  const step = (d: number) => setI((n) => (n + d + box.images.length) % box.images.length);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    lockScroll(true);
    close.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % box.images.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + box.images.length) % box.images.length);
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      lockScroll(false);
      opener?.focus({ preventScroll: true });
    };
  }, [box, onClose]);

  return (
    <motion.div className='lightbox' role='dialog' aria-modal='true' aria-label={box.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-lenis-prevent>
      <div className='lightbox__bar' onClick={(e) => e.stopPropagation()}>
        <p>
          {box.title}
          {many && (
            <span>
              {' '}
              {i + 1} of {box.images.length}
            </span>
          )}
        </p>
        <button ref={close} type='button' className='modal__close' onClick={onClose} aria-label='Close'>
          <span aria-hidden='true'>×</span>
        </button>
      </div>
      <img className='lightbox__img' src={box.images[i]} alt={`${box.title}, document ${i + 1}`} onClick={(e) => e.stopPropagation()} />
      {many && (
        <div className='lightbox__nav' onClick={(e) => e.stopPropagation()}>
          <button type='button' onClick={() => step(-1)} aria-label='Previous document'>
            ←
          </button>
          <button type='button' onClick={() => step(1)} aria-label='Next document'>
            →
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Lightbox;
