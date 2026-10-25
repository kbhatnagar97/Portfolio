import type { IRecordRow, ISample } from './types';

// The demo's transmittal as data: where a row goes and what a drop changes. Pure, so the page's storyboard and the live demo agree.

export type TPlan =
  | { kind: 'refuse' }
  | { kind: 'repeat' }
  // at is the new row's index; revoke is the index of the row it replaces, or -1 for a first issue
  | { kind: 'add'; row: IRecordRow; at: number; revoke: number };

const serial = (r: { no: string }) => Number(r.no);
const revision = (r: { rev: string }) => Number(r.rev.slice(1));

// rows stay sorted by serial, then revision, so a new revision lands directly under the one it replaces
const insertAt = (rows: IRecordRow[], row: IRecordRow) => {
  const i = rows.findIndex((r) => serial(r) > serial(row) || (serial(r) === serial(row) && revision(r) > revision(row)));
  return i < 0 ? rows.length : i;
};

// the engine compares the whole folder with the record, so a sheet already on it plans nothing
export const plan = (rows: IRecordRow[], sample: ISample): TPlan => {
  if (sample.refuse || !sample.row) return { kind: 'refuse' };
  const row: IRecordRow = { ...sample.row, state: 'current' };
  if (rows.some((r) => r.dwg === row.dwg && r.rev === row.rev)) return { kind: 'repeat' };
  const old = sample.revokes;
  const revoke = old ? rows.findIndex((r) => r.dwg === old.dwg && r.rev === old.rev && r.state === 'current') : -1;
  return { kind: 'add', row, at: insertAt(rows, row), revoke };
};

// the record after a plan; old rows are never removed, only marked
export const apply = (rows: IRecordRow[], p: TPlan, revoked: string): IRecordRow[] => {
  if (p.kind !== 'add') return rows;
  const next = rows.map((r, i) => (i === p.revoke ? { ...r, status: revoked, state: 'revoked' as const } : r));
  next.splice(p.at, 0, p.row);
  return next;
};

export const counts = (rows: IRecordRow[], look: number) => ({
  rows: rows.length,
  revoked: rows.filter((r) => r.state === 'revoked').length,
  look,
});

// "Rows {rows} · Revoked {revoked} · Needs a look {look}"
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
