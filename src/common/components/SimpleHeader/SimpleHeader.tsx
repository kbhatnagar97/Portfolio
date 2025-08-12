import React from 'react';
import { Link } from 'react-router-dom';
import GalaxyToggleButton from '../GalaxyToggleButton/GalaxyToggleButton';
import './SimpleHeader.scss';

interface SimpleHeaderProps {
  title: string;
}

const SimpleHeader: React.FC<SimpleHeaderProps> = ({ title }) => {
  return (
    <header className='simple-header'>
      <div className='simple-header__content'>
        <h1 className='simple-header__title'>{title}</h1>
        <div className='simple-header__nav'>
          <Link to='/' className='simple-header__galaxy-nav'>
            <GalaxyToggleButton onClick={() => {}} isOpen={false} />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default SimpleHeader;
