import type { ICalcResult } from '../build/types';
import type { ICalcSentences } from './types';

// The hours calculator's arithmetic, shared by page.ts (the build time result) and the browser. No DOM, no Node.

export interface IHoursCopy {
  sentence: ICalcSentences;
  // templates with {issues} {minutes} {review} {monthMinutes} {monthHours} {yearHours}
  math: string[];
}

const grouped = (n: number, digits = 2) => n.toLocaleString('en-US', { maximumFractionDigits: digits });

// two significant figures, the page's rule for modelled results
const sig2 = (n: number) => Number(n.toPrecision(2));

// "10 hours", "2.5 hours", "45 minutes": under an hour the reader thinks in minutes
const duration = (hours: number) => {
  if (hours >= 1) {
    const h = sig2(hours);
    return `${grouped(h)} ${h === 1 ? 'hour' : 'hours'}`;
  }
  const m = sig2(hours * 60);
  return `${grouped(m)} ${m === 1 ? 'minute' : 'minutes'}`;
};

const figure = (hours: number) => (hours > 0 && hours < 1 ? `${grouped(sig2(hours * 60))} min` : `${grouped(hours < 1 ? 0 : sig2(hours))} h`);

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

// the math shows exact values; a rounded one reads "≈" so the page never states a false equality
const exact = (n: number) => ({ text: grouped(n), rounded: Math.abs(n * 100 - Math.round(n * 100)) > 1e-9 });

export const hoursModel =
  (copy: IHoursCopy) =>
  (v: Record<string, number>, edited: boolean): ICalcResult => {
    const { issues, minutes, review } = v;
    const perDrawing = Math.max(minutes - review, 0);
    const monthMinutes = issues * perDrawing;
    const monthHours = monthMinutes / 60;
    const yearHours = monthHours * 12;

    const values: Record<string, string> = {
      issues: grouped(issues),
      minutes: grouped(minutes),
      review: grouped(review),
      monthMinutes: exact(monthMinutes).text,
      monthHours: exact(monthHours).text,
      yearHours: exact(yearHours).text,
      month: duration(monthHours),
      year: duration(yearHours),
    };
    const math = copy.math.map((line, i) => {
      // a review longer than the hand work clamps the saving at zero, and the first line says so
      const clamped = i === 0 && review > minutes ? line.replace('({minutes} min − {review} min)', 'max({minutes} min − {review} min, 0)') : line;
      const rounded = (i === 1 && exact(monthHours).rounded) || (i === 2 && exact(yearHours).rounded);
      return fill(rounded ? clamped.replace(' = ', ' ≈ ') : clamped, values);
    });

    let sentence = fill(edited ? copy.sentence.yours : copy.sentence.example, values);
    if (issues === 0) sentence = copy.sentence.empty;
    else if (perDrawing === 0) sentence = copy.sentence.none;
    return { figure: figure(monthHours), sentence, math };
  };
