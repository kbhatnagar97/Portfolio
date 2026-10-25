import { readData } from '../../shared/data';
import type { IStageData } from '../blocks';
import { typeBoard } from './board';
import { cutAway } from './cut';

// Starts both live parts of the stage; the HTML already holds their complete first frames, so nothing on screen waits for this.
export const start = (stage: HTMLElement) => {
  const data = readData<IStageData>('ft-data');
  if (!data) throw new Error('flipp-tripp: the stage data block is missing');
  cutAway(stage, data);
  typeBoard(stage, data);
};
