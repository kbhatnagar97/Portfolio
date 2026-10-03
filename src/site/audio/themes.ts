// Pure data and timing: no audio here, so the lab can import it even when muted.

type TPat = readonly [string, string];

export interface ITheme {
  id: string;
  bpm: number;
  root: number;
  swing: number;
  scale: readonly number[];
  chords: readonly (readonly number[])[];
  bass: readonly number[];
  pad: { fm: boolean; cutoff: number };
  arp: { kind: 'tri' | 'saw' | 'marimba'; low: number; a: number; d: number; peak: number };
  texture: 'teleprinter' | 'ticktock' | 'droplet';
  snare: 'rim' | 'clap' | 'softRim';
  hat: 'hat' | 'shaker';
  traffic: 'hat16' | 'hat8' | 'echo';
  bassSaw: boolean;
  motif: readonly { n: readonly number[]; s: readonly number[] }[];
  pat: { kick: TPat; snare: TPat; hat: TPat; ohat: TPat; bass: TPat; arp: TPat };
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const S3 = [0, 6, 10];
const S4 = [0, 4, 8, 12];

const NEWSROOM: ITheme = {
  id: 'linkedin-newsroom',
  bpm: 120,
  root: 50,
  swing: 0,
  scale: DORIAN,
  chords: [
    [50, 53, 57, 60, 64],
    [55, 59, 62, 64, 69],
    [52, 55, 57, 60, 64],
    [52, 55, 59, 60, 62],
  ],
  bass: [38, 43, 45, 48],
  pad: { fm: false, cutoff: 1800 },
  arp: { kind: 'tri', low: 62, a: 0.003, d: 0.09, peak: -30 },
  texture: 'teleprinter',
  snare: 'rim',
  hat: 'hat',
  traffic: 'hat16',
  bassSaw: false,
  motif: [
    { n: [10, 7, 3], s: S3 },
    { n: [7, 10, 14], s: S3 },
    { n: [3, 5, 7, 12], s: S4 },
  ],
  pat: {
    kick: ['X.....x.x.......', 'X.....x.x...x...'],
    snare: ['....X.......X...', '....X.......X.xx'],
    hat: ['x.X.x.X.x.X.x.X.', 'xxXxxxXxxxXxXXXX'],
    ohat: ['................', '..............x.'],
    bass: ['r..r..r.r..r..o.', 'r..r..r.r..r.ro.'],
    arp: ['0.2.1.3.2.1.4.2.', '0242131430241432'],
  },
};

const FIRST_TO_APPLY: ITheme = {
  id: 'first-to-apply',
  bpm: 136,
  root: 52,
  swing: 0,
  scale: AEOLIAN,
  chords: [
    [52, 55, 59, 62, 66],
    [52, 55, 59, 60, 64],
    [50, 55, 59, 62, 64],
    [50, 54, 57, 62, 64],
  ],
  bass: [40, 36, 43, 38],
  pad: { fm: false, cutoff: 1400 },
  arp: { kind: 'saw', low: 64, a: 0.003, d: 0.12, peak: -30 },
  texture: 'ticktock',
  snare: 'clap',
  hat: 'hat',
  traffic: 'hat8',
  bassSaw: true,
  motif: [
    { n: [7, 3, 0], s: S3 },
    { n: [0, 3, 7, 10], s: S4 },
    { n: [12, 10, 7], s: S3 },
  ],
  pat: {
    kick: ['X...x...X...x...', 'X...x...X...x.x.'],
    snare: ['....X.......X...', '....X.......XxXX'],
    hat: ['................', '.x.x.x.x.xxxxxxx'],
    ohat: ['..x...x...x...x.', '..x...x...x...x.'],
    bass: ['r.r.r.r.r.r.r.o.', 'r.r.r.o.r.r.r.o.'],
    arp: ['0.1.2.0.1.2.0.3.', '0213021302130213'],
  },
};

const INBOX_TRIAGE: ITheme = {
  id: 'inbox-triage',
  bpm: 96,
  root: 53,
  swing: 0.1,
  scale: LYDIAN,
  chords: [
    [53, 57, 60, 64, 67],
    [53, 55, 59, 62, 67],
    [52, 55, 59, 62],
    [52, 55, 57, 60],
  ],
  bass: [41, 41, 40, 45],
  pad: { fm: true, cutoff: 1400 },
  arp: { kind: 'marimba', low: 65, a: 0.002, d: 0.3, peak: -28 },
  texture: 'droplet',
  snare: 'softRim',
  hat: 'shaker',
  traffic: 'echo',
  bassSaw: false,
  motif: [
    { n: [4, 7, 9], s: S3 },
    { n: [9, 7, 4, 2], s: S4 },
    { n: [0, 4, 11], s: S3 },
  ],
  pat: {
    kick: ['................', '................'],
    snare: ['........X.......', '........X.....x.'],
    hat: ['x.X.x.X.x.X.x.X.', 'xxXxxxXxxxXxxXXx'],
    ohat: ['................', '................'],
    bass: ['r.......r.....5.', 'r.......r...5.o.'],
    arp: ['0...2.3...1...3.', '3...2.0...3...1.'],
  },
};

export const THEMES: Record<string, ITheme> = {
  'linkedin-newsroom': NEWSROOM,
  'first-to-apply': FIRST_TO_APPLY,
  'inbox-triage': INBOX_TRIAGE,
  // newer flows play an existing score under their own id, because the music lines up its downbeat by theme id
  'trading-lab': { ...FIRST_TO_APPLY, id: 'trading-lab', bpm: 124 },
  'claude-watchdog': { ...NEWSROOM, id: 'claude-watchdog', bpm: 110 },
};

let current: ITheme = THEMES['inbox-triage'];

export const themeOf = (id: string) => THEMES[id] ?? THEMES['inbox-triage'];
export const theme = () => current;
export function setTheme(id: string) {
  current = themeOf(id);
}

// travel is 1.5 beats and the gap half a beat, so couriers land on the grid whether or not music plays
export const hop = (id?: string) => {
  const spb = 60 / (id ? themeOf(id) : current).bpm;
  return { spb, travel: 1.5 * spb, gap: 0.5 * spb };
};

// #region Pitch helpers
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const pcs = (chord: readonly number[]) => new Set(chord.map((n) => ((n % 12) + 12) % 12));

// every chord tone from MIDI 0 to 127, ascending
const tones = (chord: readonly number[]) => {
  const set = pcs(chord);
  const out: number[] = [];
  for (let m = 0; m < 128; m++) if (set.has(m % 12)) out.push(m);
  return out;
};

export const inChord = (chord: readonly number[], n: number) => pcs(chord).has(((Math.round(n) % 12) + 12) % 12);

// the lowest chord tone in R+36 to R+47
export const anchor = (chord: readonly number[], r: number) => {
  const set = pcs(chord);
  for (let m = r + 36; m < r + 48; m++) if (set.has(m % 12)) return m;
  return r + 36;
};

// the chord tone j steps above (or below) n
export const step = (chord: readonly number[], n: number, j: number) => {
  const t = tones(chord);
  let i = t.findIndex((m) => m >= n);
  if (i < 0) i = t.length - 1;
  const exact = t[i] === n;
  const k = j === 0 ? i : exact ? i + j : j > 0 ? i + j - 1 : i + j;
  return t[Math.min(t.length - 1, Math.max(0, k))];
};

export const nearest = (chord: readonly number[], n: number) => tones(chord).reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));

// the first chord tone at or above lo and below hi, or lo when none fits
export const toneIn = (chord: readonly number[], lo: number, hi: number, nth = 0) => {
  const t = tones(chord).filter((m) => m >= lo && m <= hi);
  return t[Math.min(nth, t.length - 1)] ?? lo;
};

// Peggle ladder: chord tones rising from R+36 over one octave plus one tone, then back to the bottom
export const ladder = (chord: readonly number[], r: number) => {
  const t = tones(chord).filter((m) => m >= r + 36 && m < r + 48);
  t.push(t[0] + 12);
  return t;
};
export const rung = (chord: readonly number[], r: number, k: number) => {
  const l = ladder(chord, r);
  return l[((Math.round(k) % l.length) + l.length) % l.length];
};

// the next tone of the mode above n, the deliberate rub for alt and reroute
export const modeUp = (scale: readonly number[], r: number, n: number) => {
  for (let m = n + 1; m < n + 13; m++) if (scale.includes((((m - r) % 12) + 12) % 12)) return m;
  return n + 2;
};

export const degree = (scale: readonly number[], r: number, d: number) => r + 24 + scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);

// the voicing with its third raised to the fourth
export const sus4 = (chord: readonly number[], root: number) =>
  chord.map((n) => {
    const iv = (((n - root) % 12) + 12) % 12;
    return iv === 3 || iv === 4 ? n + (5 - iv) : n;
  });
// #endregion
