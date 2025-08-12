import React from 'react';
import './GalaxyToggleButton.scss';

interface GalaxyToggleButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const GalaxyToggleButton: React.FC<GalaxyToggleButtonProps> = ({ onClick, isOpen }) => {
  const buttonClassName = `galaxy-toggle ${isOpen ? 'is-open' : ''}`;

  return (
    <button className={buttonClassName} onClick={onClick} aria-label="Toggle Sidebar">
      <div className="galaxy-toggle__core"></div>
      <div className="galaxy-toggle__orbit galaxy-toggle__orbit--1"></div>
      <div className="galaxy-toggle__orbit galaxy-toggle__orbit--2"></div>
      <div className="galaxy-toggle__orbit galaxy-toggle__orbit--3"></div>
    </button>
  );
};

export default GalaxyToggleButton;