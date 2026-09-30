import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// hydrate the prerendered markup instead of rebuilding it, or the rebuilt hero counts as a late LCP
ReactDOM.hydrateRoot(
  document.getElementById('root') as HTMLElement,
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
