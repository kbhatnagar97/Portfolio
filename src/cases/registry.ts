import type { ICase, IOverview } from './build/types';
import postAura from '../content/cases/post-aura.json';
import drawingTransmittal from '../content/cases/drawing-transmittal.json';
import buskers from '../content/cases/buskers.json';
import therapyPractice from '../content/cases/therapy-practice.json';
import flippTripp from '../content/cases/flipp-tripp.json';
import overview from '../content/cases/overview.json';

// Build time only. Keys are file names in display order; production refuses drafts, so ship fewer cases by deleting entries.
// Each pager shows a case's two neighbours in this order, wrapping around; the neighbours are chosen on purpose, so check every pager after a reorder.
export const CASE_FILES: Record<string, unknown> = {
  'post-aura': postAura,
  'drawing-transmittal': drawingTransmittal,
  'flipp-tripp': flippTripp,
  buskers,
  'therapy-practice': therapyPractice,
};

// the shapes are proven at build time by validateCase, so the JSON types are not trusted here
export const CASES = Object.values(CASE_FILES) as ICase[];
export const OVERVIEW = overview as IOverview;
