import type { TKind, TPurpose } from './types';

// Build time only. Key order is display order everywhere: chips, the overview filter, the sources key.

export const PURPOSES: Record<TPurpose, string> = {
  'saves-time': 'Saves time',
  'saves-money': 'Saves money',
  'grows-reach': 'Grows reach',
  'opens-reach': 'Opens reach',
  'reduces-risk': 'Removes risk',
};

export const KINDS: Record<TKind, string> = {
  measured: 'Measured',
  reported: 'Reported',
  modelled: 'Modelled',
  example: 'Example',
};

// the sources key, one line per kind, beside its chip
export const KIND_MEANS: Record<TKind, string> = {
  measured: 'Observed with a tool or a log.',
  reported: 'A person or a document said it; the source names who.',
  modelled: 'Computed from inputs shown on the page.',
  example: 'An illustration or a default you can change.',
};

export const isPurpose = (s: unknown): s is TPurpose => typeof s === 'string' && Object.hasOwn(PURPOSES, s);
export const isKind = (s: unknown): s is TKind => typeof s === 'string' && Object.hasOwn(KINDS, s);
