import { boot } from '../shared/boot';
import { readData } from '../shared/data';
import { nearView } from '../shared/view';
import type { ICalcModel } from './model';
import { tagging } from './model';
import { pathMotion } from './path-motion';
import './case.scss';

// Post Aura's browser entry: the kit's parts, then this world's calculator model, folder path motion and stage.
// The calculator and the stage load a screen early; until then the HTML holds their complete end states.

boot(() => {
  const form = document.querySelector<HTMLFormElement>('[data-calc]');
  const calc = readData<{ model: ICalcModel; orderError: string }>('calc-model');
  if (form && calc) {
    // the slowest time is never below the fastest; while it is, the result keeps its last valid value
    const order = (v: Record<string, number>) => (v.fast > v.slow ? { fields: ['fast', 'slow'], message: calc.orderError } : undefined);
    nearView(form, () => void import('../shared/calculator').then((m) => m.calculator(form, tagging(calc.model), { validate: order })));
  }

  const fig = document.getElementById('fig-path');
  if (fig) pathMotion(fig);

  const stage = document.getElementById('stage');
  if (stage) nearView(stage, () => void import('./stage').then((m) => m.start(stage)));
});
