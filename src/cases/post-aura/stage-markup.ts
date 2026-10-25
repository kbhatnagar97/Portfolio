import { esc } from '../../html/core';
import { badge, heroFigure, readout } from '../build/parts';
import type { ICase } from '../build/types';
import type { IBeat, IClip, IShot, IStageBlock } from './blocks';
import { fact, host, para, slate, when } from './markup';
import { panel } from './panels';

// Build time only. The stage, "the edit": an editor's viewer and four tracks beside the lane of dated
// clips. The HTML is the end state, so readers without JavaScript or with reduced motion get the whole story.

// #region Slots
// the ruler is ordinal: one event a slot, so V1 to V4 on one night stay readable beside the tagger's days
export const SLOTS = 16;

interface ISlotted {
  clip: IClip;
  slot: number;
  from: number;
  to: number;
}

const slotted = (s: IStageBlock): ISlotted[] => {
  const clips = s.beats.flatMap((b) => b.clips);
  if (clips.length !== SLOTS) throw new Error(`case-pages: post-aura: the ruler has ${SLOTS} slots, the stage lists ${clips.length} clips`);
  // the stage script reads a card's credits in figure order, so a second frame needs a picture before it
  const odd = clips.find((x) => x.frame2 && x.frame.type !== 'image');
  if (odd) throw new Error(`case-pages: post-aura: ${odd.id} has a second frame after a panel`);
  const at = new Map(clips.map((x, i) => [x.id, i]));
  return clips.map((clip, slot) => {
    const [a, b] = clip.span ?? [clip.id, clip.id];
    return { clip, slot, from: at.get(a) ?? slot, to: at.get(b) ?? slot };
  });
};

// a day label sits over the first slot of each recorded day, the month only where it changes;
// research clips carry no date, so they print none
const days = (slots: ISlotted[]) => {
  const seen = new Set<string>();
  let month = '';
  return slots.flatMap(({ clip, slot }) => {
    const m = /^(\d{1,2}) ([A-Z][a-z]{2}) \d{4}/.exec(clip.date);
    if (!m || seen.has(`${m[1]} ${m[2]}`)) return [];
    seen.add(`${m[1]} ${m[2]}`);
    const label = { slot, day: m[1], month: m[2] === month ? '' : m[2].toUpperCase() };
    month = m[2];
    return [label];
  });
};
// #endregion

// #region Media
// the viewer is about 60vw while pinned, up to 860px; the lane's pictures take the reading column, 720px at most.
// Each capture sits in the HTML once, in its lane card: the stage script copies it into the viewer with the viewer's
// sizes, so only the end frame, which readers without JavaScript see, carries its own picture
const VIEWER_SIZES = '(min-width: 1440px) 860px, (min-width: 900px) 60vw, 100vw';
const LANE_SIZES = '(min-width: 760px) 720px, calc(100vw - 32px)';

const img = (shot: IShot, sizes: string, alt: string) =>
  `<img src="${esc(shot.img.src)}"${shot.img.srcset ? ` srcset="${esc(shot.img.srcset)}" sizes="${sizes}"` : ''} width="${shot.img.width}" height="${shot.img.height}" alt="${esc(alt)}" loading="lazy" decoding="async" />`;

// the line under the viewer: the clip's title, and the credit of a picture that needs one
const captionOf = (clip: IClip, shot?: IShot) => (shot?.credit ? `${clip.title} · ${shot.credit}` : clip.title);
// #endregion

// #region The edit: viewer, caption, readout and timeline, all aria hidden
// the stage script names each frame from its lane card (title and credit), so the frames carry only their id
const frame = (id: string, body: string, current: boolean) => `<div class="frame" data-frame="${esc(id)}"${current ? ' data-end' : ' hidden'}>${body}</div>`;

const viewer = (s: IStageBlock, slots: ISlotted[], versions: string[]) =>
  slots
    .flatMap(({ clip, slot }) => {
      const last = slot === SLOTS - 1;
      const picture = (shot: IShot) => (last ? img(shot, VIEWER_SIZES, '') : '');
      const main =
        clip.frame.type === 'panel'
          ? frame(clip.id, panel(clip.frame.panel, s.panels, versions), last)
          : frame(clip.id, `${picture(clip.frame)}${clip.frame.badge ? badge(clip.frame.badge) : ''}`, last);
      return clip.frame2 ? [main, frame(`${clip.id}-cull`, '', false)] : [main];
    })
    .join('');

const block = ({ clip, from, to }: ISlotted) =>
  `<span class="tracks__clip${clip.track === 'marker' ? ' tracks__clip--marker' : ''}" data-from="${from}"${to === from ? '' : ` data-to="${to}"`} style="grid-column:${from + 1}/${to + 2}"><span>${esc(clip.label)}</span></span>`;

const timeline = (s: IStageBlock, slots: ISlotted[]) => {
  const marker = slots.filter((x) => x.clip.track === 'marker').map(block);
  const labels = days(slots).map((d) => `<span class="tracks__day" style="grid-column:${d.slot + 1}">${esc(d.day)}${d.month ? ` ${esc(d.month)}` : ''}</span>`);
  const rows = s.tracks.map(
    (t) => `<div class="tracks__row" data-track="${t.id}"><p class="tracks__name">${esc(t.label)}<span class="tracks__total">${esc(t.total)}</span></p>
<div class="tracks__slots">${slots.filter((x) => x.clip.track === t.id).map(block).join('')}</div></div>`,
  );
  return `<div class="tracks">
<div class="tracks__row tracks__row--ruler"><span></span><div class="tracks__slots">${[...labels, ...marker].join('')}</div></div>
${rows.join('\n')}
<p class="tracks__io"><span>${esc(s.ruler.in)}</span><span>${esc(s.ruler.out)}</span></p>
<div class="tracks__area"><span class="tracks__playhead"><svg viewBox="0 0 10 12" width="10" height="12" focusable="false"><path d="M0 0h10v7l-5 5-5-5z" /></svg></span></div>
</div>`;
};
// #endregion

// #region The lane: beats and their clips, real text in reading order
const figure = (shot: IShot) => `<figure class="clip__fig">
<div class="clip__media">${img(shot, LANE_SIZES, shot.img.alt)}${shot.badge ? badge(shot.badge) : ''}</div>
<figcaption><span class="fig__cap">${esc(shot.caption)}</span>${shot.credit ? ` <span class="fig__credit">${esc(shot.credit)}</span>` : ''}</figcaption>
</figure>`;

const card = (c: ICase, s: IStageBlock, { clip, slot }: ISlotted) => {
  const track = s.tracks.find((t) => t.id === clip.track)?.label ?? clip.label;
  const p = (cls: string, t?: { t: string }) => (t ? `<p class="clip__${cls}">${esc(t.t)}</p>` : '');
  const facts = clip.figures?.length ? `<ul class="clip__facts">${clip.figures.map((f) => `<li>${fact(c, f)}</li>`).join('')}</ul>` : '';
  const link = clip.href ? `<p class="clip__link"><a href="${esc(clip.href)}">${esc(host(clip.href))}</a></p>` : '';
  const shots = [clip.frame.type === 'image' ? clip.frame : undefined, clip.frame2].filter((x): x is IShot => !!x).map(figure).join('\n');
  return `<li class="clip" data-slot="${slot}" data-frame="${esc(clip.id)}" data-readout="${esc(clip.readout)}"${clip.frame2 ? ` data-frame2="${esc(clip.id)}-cull"` : ''}>
<p class="clip__meta">${when(clip.date)}<span>${esc(track)}</span></p>
<h4 class="clip__title">${esc(clip.title)}</h4>
${p('line', clip.line)}${p('change', clip.change)}${p('why', clip.why)}${p('note', clip.note)}${facts}${link}${shots}
</li>`;
};

const beat = (c: ICase, s: IStageBlock, b: IBeat, slots: ISlotted[]) => {
  const mine = slots.filter((x) => b.clips.includes(x.clip));
  return `<li class="beat" id="${esc(b.id)}" data-first="${mine[0].slot}">
<div class="beat__head">${slate(b.slate)}<h3>${esc(b.h3)}</h3>${para(c, b.text)}</div>
<ol class="lane__clips">
${mine.map((x) => card(c, s, x)).join('\n')}
</ol>
</li>`;
};

const end = (c: ICase, s: IStageBlock) => {
  const e = s.end;
  const site = c.links[0] ? `<p class="stage__site">${esc(e.site)}: <a href="${esc(c.links[0].href)}">${esc(host(c.links[0].href))}</a></p>` : '';
  return `<div class="stage__end">
${heroFigure(c, { value: e.figure, label: e.sentence.t, kind: e.kind, source: e.source })}
<ul class="stage__totals">${e.totals.map((t) => `<li>${fact(c, t)}</li>`).join('')}</ul>
${site}
</div>`;
};
// #endregion

export const stageSection = (c: ICase, s: IStageBlock) => {
  const slots = slotted(s);
  const versions = slots.filter((x) => x.clip.track === 'website').map((x) => x.clip.label);
  const last = slots[SLOTS - 1].clip;
  return `<section class="stage stage--post-aura" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-h" data-stage="static">
<div class="stage__head"><h2 id="${esc(s.id)}-h">${esc(s.h2)}</h2><p class="stage__intro">${esc(s.intro)}</p></div>
<div class="edit-track">
<div class="edit" aria-hidden="true">
<div class="edit__screen"><div class="edit__monitor">
<div class="edit__viewer" data-sizes="${VIEWER_SIZES}">
${viewer(s, slots, versions)}
</div>
<p class="edit__caption">${esc(captionOf(last))}</p>
</div></div>
<div class="edit__timeline">${readout(s.readoutOut)}${timeline(s, slots)}</div>
</div>
<div class="lane-col">
<p class="edit__now" aria-hidden="true">${esc(s.beats[0].slate)}</p>
<div class="lane__line" aria-hidden="true"></div>
<ol class="stage__steps lane">
${s.beats.map((b) => beat(c, s, b, slots)).join('\n')}
</ol>
${end(c, s)}
</div>
</div>
</section>`;
};
