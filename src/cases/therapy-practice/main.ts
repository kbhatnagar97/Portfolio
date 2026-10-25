import { boot } from '../shared/boot';
import { breathe } from './breath';
import './case.scss';

// The kit wires the turn's fade and the version tabs by their markup; this world adds only the stage's breath.
boot(() => {
  const path = document.querySelector<HTMLElement>('[data-path]');
  if (path) breathe(path);
});
