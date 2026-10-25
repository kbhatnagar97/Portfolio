import { boot } from '../shared/boot';
import { checker } from './checker';
import { race } from './race';
import { views } from './views';
import './case.scss';

// boot() wires the shared parts first (the two compares and the turn among them), then this world's own pieces
boot(() => {
  const stage = document.querySelector<HTMLElement>('.views');
  if (stage) views(stage);
  const weight = document.querySelector<HTMLElement>('.race');
  if (weight) race(weight);
  const addresses = document.querySelector<HTMLElement>('[data-checker]');
  if (addresses) checker(addresses);
});
