import React, { useEffect, useRef } from 'react';
import { FaTimes, FaArrowRight } from 'react-icons/fa';
import './FileViewerModal.scss';

export interface FileViewerModalProps {
  /** The file/image source URL */
  src: string;
  /** The title to display in the modal header */
  title: string;
  /** The subtitle to display in the modal header */
  subtitle: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback function when the modal is closed */
  onClose: () => void;
  /** Alternative text for the image */
  alt?: string;
  /** Whether to show the "Open in New Tab" button */
  showOpenInNewTab?: boolean;
  /** Custom CSS class for additional styling */
  className?: string;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  src,
  title,
  subtitle,
  isOpen,
  onClose,
  alt,
  showOpenInNewTab = true,
  className = '',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent page scroll when modal is open
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      // focus the modal content for better keyboard/scroll capture
      contentRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleOpenInNewTab = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`file-viewer-modal ${className}`}
      onClick={handleBackdropClick}
    >
      <div className='file-viewer-modal__backdrop'></div>
      <div
        className='file-viewer-modal__content'
        ref={contentRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className='file-viewer-modal__header'>
          <div className='file-viewer-modal__info'>
            <h3 className='file-viewer-modal__title'>{title}</h3>
            <p className='file-viewer-modal__subtitle'>{subtitle}</p>
          </div>
          <button
            className='file-viewer-modal__close'
            onClick={onClose}
            aria-label='Close file viewer'
            type='button'
          >
            <FaTimes />
          </button>
        </div>

        {/* Image Container */}
        <div className='file-viewer-modal__image-container'>
          <img
            src={src}
            alt={alt || `${title} file`}
            className='file-viewer-modal__image'
          />
        </div>

        {/* Modal Actions */}
        <div className='file-viewer-modal__actions'>
          {showOpenInNewTab && (
            <button
              onClick={handleOpenInNewTab}
              className='btn btn--primary'
              type='button'
            >
              Open in New Tab
              <FaArrowRight />
            </button>
          )}
          <button
            onClick={onClose}
            className='btn btn--secondary'
            type='button'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
