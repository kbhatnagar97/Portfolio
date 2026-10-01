export type TTone = 'text' | 'muted' | 'gold' | 'live' | 'holo' | 'violet';
export type TKind = 'chip' | 'medal' | 'plank' | 'stat';
export type TTile = {
  t: string;
  k: TKind;
  tone: TTone;
  dot?: string;
  live?: boolean;
  sub?: string;
  serif?: boolean;
  r?: number;
  wave?: string;
};
export type TPlaySet = { caption: string; tiles: TTile[]; band?: TTile[]; bot?: boolean };
export type TPlayData = { v: 1; mq: string; sets: Record<string, TPlaySet> };
