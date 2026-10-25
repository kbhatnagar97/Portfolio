import type { ICalcResult } from '../build/types';

// The tagging calculator's model. Pure maths shared by page.ts and the browser: no DOM, no Node.
// Every constant and sentence comes from the content file, so the page and this model can never disagree.

export interface ICalcModel {
  constants: { id: 'tokensIn' | 'tokensOut' | 'priceIn' | 'priceOut'; value: number }[];
  figure: string;
  figureSingle: string;
  sentence: { example: string; yours: string; single: string; zero: string };
  math: string[];
}

// modelled outputs round to two significant figures; inputs print as typed, with grouping
const two = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 2 });
const grouped = (n: number) => n.toLocaleString('en-US');
const exact = (n: number, digits: number) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

export const tagging = (m: ICalcModel) => {
  const k = Object.fromEntries(m.constants.map((x) => [x.id, x.value])) as Record<ICalcModel['constants'][number]['id'], number>;
  const feePerClip = (k.tokensIn * k.priceIn + k.tokensOut * k.priceOut) / 1_000_000;

  return (v: Record<string, number>, edited: boolean): ICalcResult => {
    const hoursLow = (v.clips * v.fast) / 3600;
    const hoursHigh = (v.clips * v.slow) / 3600;
    const fees = v.clips * feePerClip;
    const values = {
      clips: grouped(v.clips),
      fast: grouped(v.fast),
      slow: grouped(v.slow),
      rate: money(v.rate),
      hours: two(hoursLow),
      hoursLow: two(hoursLow),
      hoursHigh: two(hoursHigh),
      cost: two(hoursLow * v.rate),
      costLow: two(hoursLow * v.rate),
      costHigh: two(hoursHigh * v.rate),
      fees: two(fees),
      hoursLowExact: exact(hoursLow, 1),
      hoursHighExact: exact(hoursHigh, 1),
      costLowExact: exact(hoursLow * v.rate, 2),
      costHighExact: exact(hoursHigh * v.rate, 2),
      feesExact: exact(fees, 4),
    };
    const single = v.fast === v.slow;
    const sentence = v.clips === 0 ? m.sentence.zero : single ? m.sentence.single : edited ? m.sentence.yours : m.sentence.example;
    return {
      figure: v.clips === 0 ? '0 h' : fill(single ? m.figureSingle : m.figure, values),
      sentence: fill(sentence, values),
      math: m.math.map((line) => fill(line, values)),
    };
  };
};
