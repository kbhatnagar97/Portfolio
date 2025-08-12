import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { IoInformationCircleOutline } from 'react-icons/io5';
import './index.scss';

interface TooltipProps {
  content: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content }) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  
  const boxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  // This effect calculates the tooltip's position once it's rendered into the DOM.
  useLayoutEffect(() => {
    if (isRendered) {
      const container = containerRef.current;
      const box = boxRef.current;

      if (!container || !box) return;

      const containerRect = container.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      const buffer = 10;
      const arrowOffset = 8;

      const top = containerRect.top - boxRect.height - arrowOffset;
      let left = containerRect.left + (containerRect.width / 2) - (boxRect.width / 2);

      if (left < buffer) {
        left = buffer;
      } else if (left + boxRect.width > viewportWidth - buffer) {
        left = viewportWidth - boxRect.width - buffer;
      }

      const arrowLeft = containerRect.left + (containerRect.width / 2) - left;
      
      setStyle({
        top: `${top}px`,
        left: `${left}px`,
        ['--arrow-left' as string]: `${arrowLeft}px`,
      });

      // After calculating position, trigger the animation by setting it to visible.
      // A tiny delay ensures the browser applies the initial styles before transitioning.
      timeoutRef.current = window.setTimeout(() => {
        setIsVisible(true);
      }, 10);
    }
  }, [isRendered]);

  const showTooltip = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    // Step 1: Render the component into the DOM. The useLayoutEffect will then run.
    setIsRendered(true);
  };

  const hideTooltip = () => {
    // Step 1: Trigger the fade-out animation.
    setIsVisible(false);

    // Step 2: After the animation completes (200ms), remove the component from the DOM.
    timeoutRef.current = window.setTimeout(() => {
      setIsRendered(false);
    }, 200); // This duration must match the CSS transition duration.
  };

  return (
    <div
      ref={containerRef}
      className="tooltip-container"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      tabIndex={0}
    >
      <IoInformationCircleOutline className="tooltip-icon" />
      {isRendered &&
        createPortal(
          <div
            ref={boxRef}
            className={`tooltip-box ${isVisible ? 'is-visible' : ''}`}
            style={style}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;