import type { ICalcResult } from '../build/types';

// The live side of parts.calculator: the case's model.ts computes, this only reads and writes; nothing is sent or stored.

export type TCompute = (values: Record<string, number>, edited: boolean) => ICalcResult;

// a rule across fields, checked once each field holds a valid number: the fields it names are marked invalid,
// and its message shows under the last of them
export type TValidate = (values: Record<string, number>) => { fields: string[]; message: string } | undefined;

export interface ICalcOptions {
  validate?: TValidate;
}

// #region Fields
interface IField {
  name: string;
  num: HTMLInputElement;
  range: HTMLInputElement | null;
  error: HTMLElement | null;
  chips: HTMLElement[];
  yours: HTMLElement | null;
  def: number;
}

const grouped = (n: number) => n.toLocaleString('en-US');

const fieldOf = (el: HTMLElement): IField | undefined => {
  const num = el.querySelector<HTMLInputElement>('input[type="number"]');
  if (!num) return undefined;
  const kind = el.querySelector<HTMLElement>('.calc__kind');
  return {
    name: num.name,
    num,
    range: el.querySelector<HTMLInputElement>('input[type="range"]'),
    error: el.querySelector<HTMLElement>('.calc__error'),
    chips: kind ? [...kind.children].filter((x): x is HTMLElement => x instanceof HTMLElement && !x.classList.contains('prov--yours')) : [],
    yours: kind?.querySelector<HTMLElement>('.prov--yours') ?? null,
    def: Number(el.dataset.default),
  };
};

// the browser's own validity covers an empty field, a value out of range and one off its step
const valueOf = (f: IField) => {
  const v = f.num.valueAsNumber;
  return Number.isFinite(v) && f.num.validity.valid ? v : undefined;
};

// the content file's own words when it has them, else the range, and the step only when the step is all that is wrong
const ownMessage = (f: IField) => {
  if (f.error?.dataset.message) return f.error.dataset.message;
  const range = `Enter a number from ${grouped(Number(f.num.min))} to ${grouped(Number(f.num.max))}`;
  const v = f.num.validity;
  return v.stepMismatch && !v.rangeOverflow && !v.rangeUnderflow ? `${range}, in steps of ${f.num.step}.` : `${range}.`;
};

const setFill = (range: HTMLInputElement) => {
  const min = Number(range.min);
  const span = Number(range.max) - min || 1;
  range.style.setProperty('--fill', `${((Number(range.value) - min) / span) * 100}%`);
};
// #endregion

export const calculator = (form: HTMLFormElement, compute: TCompute, o: ICalcOptions = {}) => {
  const fields = [...form.querySelectorAll<HTMLElement>('.calc__field')].map(fieldOf).filter((f): f is IField => !!f);
  const figure = form.querySelector<HTMLElement>('.calc__figure');
  const sentence = form.querySelector<HTMLElement>('.calc__sentence');
  const lines = form.querySelector<HTMLElement>('.calc__lines');
  const stale = form.querySelector<HTMLElement>('.calc__stale');
  const math = form.querySelector<HTMLDetailsElement>('.calc__math');
  let timer = 0;

  // #region Reading and checking
  const read = () => {
    const values: Record<string, number> = {};
    for (const f of fields) {
      const v = valueOf(f);
      if (v !== undefined) values[f.name] = v;
    }
    const whole = fields.every((f) => f.name in values);
    return { values, whole, rule: whole ? o.validate?.(values) : undefined };
  };

  // what each field should say: its own problem first, else the shared rule's, which the last field it names prints
  type TProblem = { message?: string; by: IField };
  const problems = () => {
    const { rule } = read();
    const out = new Map<IField, TProblem>();
    for (const f of fields) if (valueOf(f) === undefined) out.set(f, { message: ownMessage(f), by: f });
    const named = fields.filter((f) => rule?.fields.includes(f.name) && !out.has(f));
    const last = named.at(-1);
    if (rule && last) for (const f of named) out.set(f, { message: f === last ? rule.message : undefined, by: last });
    return out;
  };

  const show = (f: IField, p: TProblem | undefined) => {
    if (p) f.num.setAttribute('aria-invalid', 'true');
    else f.num.removeAttribute('aria-invalid');
    if (f.error) {
      const message = p?.by === f ? p.message : undefined;
      f.error.hidden = !message;
      f.error.textContent = message ?? '';
    }
    const errorId = p?.by.error?.id;
    const described = (f.num.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && !id.endsWith('-err'));
    f.num.setAttribute('aria-describedby', [...described, ...(errorId ? [errorId] : [])].join(' '));
  };

  // errors appear on blur and on reset, saying what is wrong and how to fix it; typing only clears one that changed or went away
  const shown = new Map<IField, TProblem>();
  const paint = (blurred: boolean) => {
    const now = problems();
    for (const f of fields) {
      const p = now.get(f);
      const was = shown.get(f);
      const same = !!was && !!p && was.message === p.message && was.by === p.by;
      const next = p && (blurred || same) ? p : undefined;
      if (next) shown.set(f, next);
      else shown.delete(f);
      show(f, next);
    }
  };
  // #endregion

  // the figure updates on every keystroke; the sentence is the one live region, so it speaks once per pause
  const update = () => {
    const { values, whole, rule } = read();
    let edited = false;
    for (const f of fields) {
      const mine = f.name in values && values[f.name] !== f.def;
      edited ||= mine;
      for (const chip of f.chips) chip.hidden = mine;
      if (f.yours) f.yours.hidden = !mine;
    }
    const valid = whole && !rule;
    form.classList.toggle('is-stale', !valid);
    if (stale) stale.hidden = valid;
    if (!valid) return;
    const r = compute(values, edited);
    if (figure) figure.textContent = r.figure;
    if (lines) lines.replaceChildren(...r.math.map((m) => Object.assign(document.createElement('li'), { textContent: m })));
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (sentence) sentence.textContent = r.sentence;
    }, 250);
  };

  // #region Wiring
  for (const f of fields) {
    f.num.disabled = false;
    if (f.range) {
      const range = f.range;
      range.disabled = false;
      range.addEventListener('input', () => {
        f.num.value = range.value;
        setFill(range);
        paint(false);
        update();
      });
    }
    f.num.addEventListener('input', () => {
      const v = valueOf(f);
      if (v !== undefined && f.range) {
        f.range.value = String(v);
        setFill(f.range);
      }
      paint(false);
      update();
    });
    f.num.addEventListener('blur', () => paint(true));
  }

  form.querySelector<HTMLButtonElement>('.calc__reset')?.addEventListener('click', () => {
    for (const f of fields) {
      f.num.value = String(f.def);
      if (f.range) {
        f.range.value = String(f.def);
        setFill(f.range);
      }
    }
    paint(true);
    update();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  // print shows the math; the reader's own open or closed choice comes back afterwards
  let wasOpen = false;
  addEventListener('beforeprint', () => {
    wasOpen = !!math?.open;
    if (math) math.open = true;
  });
  addEventListener('afterprint', () => {
    if (math) math.open = wasOpen;
  });
  // #endregion
};
