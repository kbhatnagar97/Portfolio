import profileJson from '../../content/profile.json';
import { esc } from '../../html/core';
import { caseStatus, enquiryHref, posterImg, prov, purposeGlyph, purposes } from '../build/parts';
import { PURPOSES } from '../build/terms';
import type { ICase, IMetric, IOverview, TOverviewRender, TPurpose } from '../build/types';

// Build time only. /case-studies/: the hero, the purpose filter, a card per case, How I work and the enquiry line.

// #region Hero
// the case hero's type without a ledger, chips or image
const hero = (o: IOverview) => `<header class="ov-hero w-wide">
<h1 class="title">${esc(o.title)}</h1>
<p class="deck">${esc(o.deck)}</p>
<p class="case-meta"><span>${esc(o.kicker)}</span></p>
${o.lede.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n')}
</header>`;
// #endregion

// #region Filter
const claimedBy = (cases: ICase[], p: TPurpose) => cases.filter((c) => c.purposes.includes(p)).length;

// radios, so Tab and the arrow keys work natively and CSS filters without JavaScript; a purpose no case claims gets no radio
const filter = (cases: ICase[]) => {
  const option = (id: string, label: string, n: number, glyph = '') =>
    `<input class="sr-only" type="radio" name="for" id="for-${id}" value="${id}"${id === 'all' ? ' checked' : ''} /><label for="for-${id}">${glyph}${esc(label)} <span class="ofilter__n">${n}</span></label>`;
  const shown = (Object.keys(PURPOSES) as TPurpose[]).filter((p) => claimedBy(cases, p) > 0);
  return `<fieldset class="ofilter w-wide">
<legend class="label">Show cases that</legend>
<div class="ofilter__opts">
${[option('all', 'All cases', cases.length), ...shown.map((p) => option(p, PURPOSES[p], claimedBy(cases, p), purposeGlyph(p)))].join('\n')}
</div>
</fieldset>
<p class="ofilter__count w-wide" aria-live="polite"></p>`;
};
// #endregion

// #region Cards
const pageOf = (c: ICase) => `/case-studies/${c.slug}/`;

// a card's chip opens the numbered source on the case page itself; the note travels with its number, as in the hero ledger
const proof = (c: ICase, m: IMetric) =>
  `<div class="metric metric--tile"><p class="metric__line"><span class="metric__value">${esc(m.value)}</span> <span class="metric__label">${esc(m.label)}</span> ${prov(c, m, pageOf(c))}</p>${m.note ? `<p class="metric__note">${esc(m.note)}</p>` : ''}</div>`;

// the title link covers the card; the flagship shows up to three proofs, the others the first, the row each hero ledger leads with
const card = (c: ICase) => {
  const meta = [c.industry, c.year].filter((x) => x.trim());
  const proofs = c.impact.slice(0, c.flagship ? 3 : 1);
  return `<li class="ocard${c.flagship ? ' ocard--flagship' : ''}" data-for="${esc(c.purposes.join(' '))}" style="--a:${esc(c.accent)}">
<div class="ocard__media">${c.poster.src ? posterImg(c.poster) : ''}</div>
<div class="ocard__text">
<p class="case-meta ocard__meta">${meta.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
<h2 class="ocard__title"><a href="${esc(pageOf(c))}">${esc(c.title || c.slug)}</a></h2>
${c.kicker ? `<p class="ocard__kicker">${esc(c.kicker)}</p>\n` : ''}<p class="ocard__deck">${esc(c.deck)}</p>
${c.status ? `${caseStatus(c.status)}\n` : ''}${purposes(c.purposes, { links: false, small: true })}
</div>
${proofs.length ? `<div class="ocard__proofs">${proofs.map((m) => proof(c, m)).join('')}</div>\n` : ''}</li>`;
};
// #endregion

// #region How I work and the enquiry
// the beat names appear only here; every case page tells them in its own words
const how = (o: IOverview) => `<section class="how w-wide" aria-labelledby="how-h">
<h2 id="how-h">How I work</h2>
<ol class="how__steps">
${o.how.map((s, i) => `<li><span class="how__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.step)}</h3><p>${esc(s.text)}</p></li>`).join('\n')}
</ol>
</section>`;

// the offer's action row, so every enquiry reaches the one public address in profile.json
const enquiry = (o: IOverview) => `<section class="enquiry w-wide">
<p class="enquiry__text">${esc(o.cta.text)}</p>
<div class="offer__act"><a class="pill pill--solid offer__cta" href="${esc(enquiryHref(o.cta.subject))}">Email me</a><p class="offer__addr">${esc(profileJson.email)}</p></div>
</section>`;
// #endregion

const render: TOverviewRender = (o, cases) => `${hero(o)}
${filter(cases)}
<ol class="ocards w-wide">
${cases.map(card).join('\n')}
</ol>
${how(o)}
${enquiry(o)}`;

export default render;
