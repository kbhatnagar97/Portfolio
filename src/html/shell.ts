import profileJson from '../content/profile.json';
import { esc, ld, SITE } from './core';

// Build time only: the shell every static page shares (head, header, main, foot), used by vite.config.ts and the case pages.

const P = profileJson;

// #region Static CSS
// shared by the CSS below and the playground, so the rail and its canvas switch at the same width
export const MQ = '(min-width: 1024px) and (min-height: 700px)';
// metric matched local faces hold the layout while the web fonts swap in, measured against Geist, Geist Mono and Instrument Serif
export const STATIC_CSS = `@font-face{font-family:'Geist Fallback';src:local('Arial'),local('ArialMT'),local('Helvetica');size-adjust:102.04%;ascent-override:98.98%;descent-override:28.42%;line-gap-override:0%}
@font-face{font-family:'Geist Mono Fallback';src:local('Menlo'),local('Menlo-Regular'),local('Courier New');size-adjust:99.66%;ascent-override:101.35%;descent-override:29.1%;line-gap-override:0%}
@font-face{font-family:'Instrument Serif Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Times');size-adjust:82.23%;ascent-override:120.4%;descent-override:37.7%;line-gap-override:0%}
@font-face{font-family:'Instrument Serif Fallback';font-style:italic;src:local('Times New Roman Italic'),local('TimesNewRomanPS-ItalicMT'),local('Times-Italic');size-adjust:86.76%;ascent-override:114.1%;descent-override:35.73%;line-gap-override:0%}
:root{--bg:#0b0a09;--bg-raise:#141210;--surface:rgba(255,246,235,.035);--surface-2:rgba(255,246,235,.07);--line:rgba(255,240,225,.1);--line-strong:rgba(255,240,225,.22);--text:#f2ebe1;--muted:#a89e92;--faint:#8a8076;--gold:#f0b44c;--gold-soft:rgba(240,180,76,.14);--live:#5ee49a;--live-soft:rgba(94,228,154,.14);--play-holo:#7fe7ff;--play-violet:#a9a4ff;--ease:cubic-bezier(.16,1,.3,1);--gutter:clamp(16px,4vw,56px);--sans:'Geist','Geist Fallback',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;--serif:'Instrument Serif','Instrument Serif Fallback',Georgia,serif;--mono:'Geist Mono','Geist Mono Fallback',ui-monospace,'SF Mono',Menlo,monospace}
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:dark;-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.7 var(--sans);-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
h1,h2,h3,h4{margin:0;font-weight:400}
p{margin:0 0 16px;max-width:64ch}
ul,ol{margin:0;padding:0;list-style:none}
img{display:block;max-width:100%;height:auto}
a{color:var(--text);text-decoration-line:underline;text-decoration-color:var(--gold);text-decoration-thickness:1px;text-underline-offset:3px;transition:color .2s,border-color .2s,background-color .2s}
@media (hover:hover) and (pointer:fine){a:hover{color:var(--gold)}}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:4px}
.serif{font-family:var(--serif);font-style:italic;font-weight:400;color:var(--gold);letter-spacing:-.02em;padding-inline-end:.08em;margin-inline-end:-.08em}
.eyebrow,.num{display:block;margin:0 0 16px;font:500 12px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.label{margin:0 0 8px;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.top{position:sticky;top:0;z-index:10;height:64px;background:rgba(11,10,9,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.top__in{display:flex;align-items:center;justify-content:space-between;gap:8px;height:100%;max-width:1320px;margin:0 auto;padding-inline:var(--gutter)}
.brand{display:inline-block;line-height:40px;font:500 17px/40px var(--sans);letter-spacing:-.03em;color:var(--text);text-decoration:none;white-space:nowrap}
.brand .serif{font-size:1.3em;letter-spacing:-.01em}
.top nav{display:flex}
.top nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 7px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-decoration:none}
.top nav a:hover,.top nav a[aria-current="page"]{color:var(--text)}
.layout{max-width:1320px;margin:0 auto;padding:0 var(--gutter) 64px}
.layout>*{min-width:0}
html{scroll-padding-top:80px}
.sec{margin-top:clamp(40px,5vw,64px);padding-top:clamp(64px,8vw,112px);border-top:1px solid var(--line)}
.sec h2{margin:0 0 clamp(24px,3vw,40px);font:400 clamp(36px,5vw,64px)/1.02 var(--serif);letter-spacing:-.02em}
.group{display:flex;align-items:baseline;gap:12px;margin:56px 0 20px;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.sec h2+.group{margin-top:0}
.group small{font-size:12px;color:var(--faint)}
.opener{padding-top:clamp(40px,6vw,72px)}
.opener__head{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"eye pic" "h1 h1";align-items:end;gap:20px 24px}
.opener__head .eyebrow{grid-area:eye;align-self:center;margin:0}
.opener__head h1{grid-area:h1}
.portrait{grid-area:pic;width:88px;height:88px;border-radius:50%;object-fit:cover;border:1px solid rgba(240,180,76,.5)}
.hero{font:500 clamp(56px,min(14vw,18vh),112px)/.9 var(--sans);letter-spacing:-.05em}
.hero>span{display:block}
.lede{margin:40px 0 0;max-width:60ch;font:400 clamp(19px,1.7vw,22px)/1.55 var(--sans)}
.lede::first-letter{float:left;margin:.06em .08em 0 0;font-family:var(--serif);font-size:4.1em;line-height:.82;color:var(--gold)}
.stats{display:grid;grid-template-columns:1fr 1fr;margin:48px 0 0;border-block:1px solid var(--line)}
.stats li{padding:24px 0 24px 16px}
.stats li:nth-child(odd){padding-left:0}
.stats li:nth-child(even){border-left:1px solid var(--line)}
.stats li:nth-child(n+3){border-top:1px solid var(--line)}
.stat__n{display:block;font:400 clamp(44px,5.5vw,72px)/1 var(--serif);letter-spacing:-.02em}
.stat__l{display:block;margin-top:10px;font:500 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.pull{max-width:22ch;margin:56px 0;font:italic 400 clamp(30px,3.4vw,46px)/1.15 var(--serif);letter-spacing:-.01em}
.pull::before{content:"";display:block;width:40px;height:1px;margin-bottom:24px;background:var(--gold)}
.opener .pull{margin-bottom:40px}
.play,.play-band{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--bg-raise);contain:strict}
.play{display:none}
.play-band{height:180px;margin:32px 0}
html:not(.js) .play,html:not(.js) .play-band{display:none}
.play>canvas,.play-band>canvas{display:block;width:100%;height:100%;touch-action:pan-y;opacity:0;transition:opacity .4s var(--ease)}
.play[data-ready]>canvas,.play-band[data-ready]>canvas{opacity:1}
[data-hint]::after{content:attr(data-hint);position:absolute;top:12px;left:14px;font:500 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint);pointer-events:none}
.rail{margin:40px calc(-1 * var(--gutter)) 0}
.toc ol{display:flex;gap:8px;overflow-x:auto;margin:-6px 0;padding:6px var(--gutter);scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 var(--gutter),#000 calc(100% - var(--gutter)),transparent);mask-image:linear-gradient(90deg,transparent,#000 var(--gutter),#000 calc(100% - var(--gutter)),transparent)}
.toc ol::-webkit-scrollbar{display:none}
.toc li{flex:none}
.toc a{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:var(--muted);text-decoration:none}
.toc a:hover{color:var(--text)}
.toc a[aria-current="true"]{color:var(--gold);border-color:var(--gold)}
.toc__n{color:var(--faint)}
.toc__n:empty{display:none}
.cards{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.card{display:flex;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);transition:border-color .3s var(--ease)}
.card:hover{border-color:var(--line-strong)}
.card__media{overflow:hidden;aspect-ratio:16/10;margin:0 0 20px;border-radius:12px;background:var(--bg-raise)}
.card__media img{width:100%;height:100%;object-fit:cover;transition:transform .6s var(--ease)}
.card__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.card__year{font:500 12.5px/1 var(--mono);color:var(--muted)}
.card__name{font:400 26px/1.1 var(--serif);letter-spacing:-.01em}
.card__name a{display:inline-flex;align-items:center;gap:10px;min-height:40px;text-decoration:none}
.card__name a::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--a,var(--muted))}
.card__tag{margin:4px 0 0;font-size:15px;line-height:1.5;color:var(--muted)}
.card__cat{margin:12px 0 0;font:500 12px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.card__facts{margin:8px 0 0;font:500 12.5px/1.5 var(--mono);color:var(--muted)}
.card__links{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:20px}
.card__links .pill:first-child{flex:none}
.pill{display:inline-flex;align-items:center;gap:6px;min-width:0;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);color:var(--text);text-decoration:none;white-space:nowrap}
.pill span{overflow:hidden;text-overflow:ellipsis}
.pill--out::after{content:"\\2197";content:"\\2197"/"";flex:none}
.pill--solid{background:var(--text);border-color:var(--text);color:var(--bg)}
@media (hover:hover) and (pointer:fine){
.pill:hover{color:var(--gold);border-color:var(--gold)}
.pill--solid:hover{background:var(--gold);border-color:var(--gold);color:var(--bg)}
}
.status{display:inline-flex;align-items:center;gap:8px;height:24px;padding:0 10px;border:1px solid var(--line);border-radius:999px;font:500 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:var(--text)}
.status::before{content:"";width:6px;height:6px;border:1px solid var(--faint);border-radius:50%}
.status--live{background:var(--live-soft);border-color:transparent}
.status--live::before{background:var(--live);border-color:var(--live)}
.status--progress::before{background:var(--gold);border-color:var(--gold)}
.status--open::before{border-color:var(--text)}
@keyframes pulse{50%{opacity:.35}}
.skill{padding:32px 0;border-top:1px solid var(--line)}
.skill:last-child{padding-bottom:0}
.skill__i{display:block;margin-bottom:12px;font:500 12px/1 var(--mono);letter-spacing:.14em;color:var(--gold)}
.skill__t{margin-bottom:20px;font:400 30px/1.1 var(--serif);letter-spacing:-.01em}
.proofs{margin:0 0 8px}
.proofs li,.marks li{position:relative;margin:8px 0;padding-left:22px}
.proofs li::before,.marks li::before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;background:var(--gold)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.chips li{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);white-space:nowrap}
.chips li::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--tone,var(--muted))}
.timeline{position:relative;display:grid;gap:40px;margin-top:32px;padding-left:32px}
.timeline::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:1px;background:var(--line-strong)}
.tl{position:relative}
.tl::before{content:"";position:absolute;left:-32px;top:3px;width:15px;height:15px;border:1px solid var(--gold);border-radius:50%;background:var(--bg)}
.tl--now::before{background:var(--gold);outline:4px solid var(--gold-soft)}
.timeline--early .tl::before{left:-30px;top:5px;width:11px;height:11px;border-color:var(--faint)}
.tl__date{display:block;margin-bottom:6px;font:500 12.5px/1.4 var(--mono);color:var(--muted)}
.tl__role{font:500 20px/1.3 var(--sans);letter-spacing:-.01em}
.tl__type{margin:4px 0 12px;font:500 12px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.tl__list li{position:relative;margin:6px 0;padding-left:20px;color:var(--muted)}
.tl__list li::before{content:"";position:absolute;left:0;top:.85em;width:8px;height:1px;background:var(--line-strong)}
.divider{display:flex;align-items:center;gap:16px;margin:56px 0 0;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.divider::after{content:"";flex:1;height:1px;background:var(--line)}
.duo,.before{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.edu,.bcard{padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.edu h3{margin-bottom:12px;font:400 22px/1.2 var(--serif)}
.edu p{margin:0;color:var(--muted)}
.edu__yrs{display:block;margin-top:16px;font:500 12.5px/1 var(--mono);color:var(--muted)}
.numchip{display:inline-flex;align-items:center;height:28px;margin-top:16px;padding:0 12px;border:1px solid var(--line-strong);border-radius:999px;font:500 12.5px/1 var(--mono)}
.rows{display:grid;grid-template-columns:minmax(0,1fr);column-gap:32px;border-top:1px solid var(--line)}
.rows>li{padding:16px 0;border-bottom:1px solid var(--line)}
.row__a{display:block}
.row__b{display:block;margin-top:2px;font:500 12.5px/1.5 var(--mono);color:var(--muted)}
.award h3{font:400 20px/1.25 var(--serif)}
.award p{margin:4px 0 0;font-size:15px;line-height:1.5;color:var(--muted)}
.award .row__b{margin-top:6px}
.bcard__y{display:block;margin-bottom:16px;font:400 44px/1 var(--serif);color:var(--muted)}
.bcard h3{margin-bottom:8px;font:500 20px/1.3 var(--sans)}
.bcard p{margin:0;font-size:15px;line-height:1.55;color:var(--muted)}
.bcard .chips{margin-top:16px}
.qa{padding:24px 0;border-top:1px solid var(--line)}
.qa h3{margin-bottom:12px;font:400 24px/1.2 var(--serif)}
.qa p{margin:0;font-size:17px;line-height:1.65}
.qa__more{display:inline-flex;align-items:center;gap:8px;min-height:40px;margin-top:4px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gold);text-decoration:none}
.qa__more::after{content:"\\2192";content:"\\2192"/"";transition:transform .3s var(--ease)}
.qa__more:hover{color:var(--text)}
.qa__more:hover::after{transform:translateX(3px)}
.online{display:grid;grid-template-columns:minmax(0,1fr);column-gap:32px;border-top:1px solid var(--line)}
.online a{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:16px;min-height:56px;padding:10px 8px;border-bottom:1px solid var(--line);text-decoration:none}
.online a:hover{background:var(--surface-2);color:var(--text)}
.online a::after{content:"\\2197";content:"\\2197"/"";grid-area:1/2/3/3;color:var(--muted)}
.online__h{grid-column:1;margin-top:4px;overflow-wrap:anywhere;font:500 12.5px/1.4 var(--mono);color:var(--muted)}
.updated{margin:32px 0 0;font:500 12.5px/1.4 var(--mono);color:var(--faint)}
.crumbs{display:flex;flex-wrap:wrap;column-gap:8px;font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--muted)}
.crumbs li{display:flex;align-items:center;min-height:40px;white-space:nowrap}
.crumbs li:not(:last-child)::after{content:"/";margin-left:8px;color:var(--faint)}
.crumbs a{display:inline-flex;align-items:center;min-height:40px;color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--gold)}
.statusrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:24px 0 20px;font:500 12.5px/1 var(--mono);color:var(--muted)}
.title{font:500 clamp(48px,8vw,96px)/.95 var(--sans);letter-spacing:-.045em}
.deck{max-width:30ch;margin:16px 0 0;font:italic 400 clamp(26px,3vw,36px)/1.2 var(--serif)}
.poster{width:100%;aspect-ratio:16/10;object-fit:cover;margin:40px 0 0;border:1px solid var(--line);border-radius:12px;background:var(--bg-raise)}
.cta{display:grid;gap:8px;margin:32px 0 0}
.cta .pill{justify-content:center}
.steps{counter-reset:s}
.steps li{position:relative;padding:16px 0 16px 48px;border-top:1px solid var(--line);counter-increment:s}
.steps li::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:20px;font:500 12px/1.4 var(--mono);letter-spacing:.1em;color:var(--gold)}
.pager{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin-top:clamp(64px,8vw,112px)}
.pager a{display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-decoration:none}
.pager a:hover{border-color:var(--line-strong);color:var(--text)}
.pager small{font:500 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pager strong{font:400 26px/1.1 var(--serif)}
.foot{margin-top:64px;padding-top:32px;border-top:1px solid var(--line);color:var(--muted)}
.foot p{margin:0}
.foot .updated{margin-top:24px}
.foot>.updated:first-child{margin-top:0}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
@media (max-width:639px){body{font-size:16px;line-height:1.65}}
@media (min-width:640px){
.layout{max-width:calc(680px + 2 * var(--gutter))}
.opener__head{grid-template-areas:"eye eye" "h1 pic"}
.portrait{width:120px;height:120px}
.stats{grid-template-columns:repeat(4,1fr)}
.stats li:nth-child(n){padding-left:20px;border-top:0;border-left:1px solid var(--line)}
.stats li:first-child{padding-left:0;border-left:0}
.cards,.duo,.before,.rows,.pager{grid-template-columns:repeat(2,minmax(0,1fr))}
.online a{display:flex}
.online a>span:first-child{flex:none}
.online__h{flex:1;margin:0;text-align:right;white-space:nowrap}
.card--lead{grid-column:1/-1}
.skill{display:grid;grid-template-columns:200px minmax(0,1fr);column-gap:32px}
.cta{display:flex;flex-wrap:wrap}
.pager a[rel="next"]{align-items:flex-end;text-align:right}
}
@media (min-width:768px){
.qa{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);column-gap:32px;align-items:start}
.qa h3{grid-row:span 2;margin:0}
.qa p,.qa__more{grid-column:2}
.qa__more{justify-self:start}
}
@media ${MQ}{
.layout{display:grid;grid-template-columns:minmax(0,720px) clamp(300px,28vw,400px);column-gap:clamp(48px,5vw,96px);justify-content:space-between;max-width:1320px}
.layout>*{grid-column:1}
.layout{padding-bottom:24px}
.opener{padding-top:40px}
.layout>.rail{grid-column:2;grid-row:1/span 20;margin:0;padding-top:40px}
.rail__in{position:sticky;top:104px;display:flex;flex-direction:column;gap:24px;height:calc(100vh - 128px);height:calc(100svh - 128px)}
.toc ol{display:block;overflow:visible;margin:0;padding:0;-webkit-mask-image:none;mask-image:none}
.toc a{position:relative;display:flex;gap:0;min-height:26px;padding:0;border:0;border-radius:0}
.toc__n{width:36px}
.toc__n:empty{display:inline}
.toc a::before{content:"";position:absolute;left:-24px;top:50%;width:16px;height:1px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .3s var(--ease)}
.toc a[aria-current="true"]::before{transform:scaleX(1)}
.play{display:block;flex:1;min-height:240px}
.play-band{display:none}
.pull{margin-left:max(-32px,calc(16px - var(--gutter)))}
.card{padding:24px}
}
@media (orientation:landscape) and (max-height:500px){
html{scroll-padding-top:0}
.top{position:relative}
.play-band{height:132px}
.portrait{width:72px;height:72px}
}
@media (prefers-reduced-motion:no-preference){
html{scroll-behavior:smooth}
.card:hover .card__media img{transform:scale(1.02)}
.status--live::before{animation:pulse 2.4s var(--ease) infinite}
}
@media (prefers-reduced-motion:reduce){.play>canvas,.play-band>canvas{transition:none}}
.top nav a[aria-current="true"]{color:var(--text)}
@media (max-width:479px){.top{height:auto}.top__in{flex-wrap:wrap;column-gap:8px;padding-block:4px}.top nav{width:100%;margin-inline:-7px}.top nav a{min-height:36px}html{scroll-padding-top:104px}}`;
// #endregion

// #region Page shell
export interface IPage {
  path: string;
  title: string;
  description: string;
  ogType: 'profile' | 'website' | 'article';
  image: string;
  imageAlt: string;
  jsonld: object;
  body: string;
  foot: string;
  // extra tags after the JSON-LD: stylesheets, modulepreloads, the module script
  head?: string;
  // the lines before </body>; an empty tail adds none
  tail: string;
  // the main element's class, 'layout' by default
  main?: string;
}

export const REL_ME = P.links.map((l) => `<link rel="me" href="${esc(l.href)}" />`).join('\n    ');
export const [FIRST_NAME, ...LAST_NAME] = P.name.split(' ');

// a page inside a section marks the section link "true": "page" would claim the link opens this very page
const current = (path: string, href: string) => (path === href ? ' aria-current="page"' : path.startsWith(href) ? ' aria-current="true"' : '');

export const page = (o: IPage) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <script>document.documentElement.classList.add('js')</script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(o.title)}</title>
    <meta name="description" content="${esc(o.description)}" />
    <link rel="canonical" href="${SITE}${o.path}" />
    <meta name="author" content="${esc(P.name)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="#0b0a09" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    ${REL_ME}
    <link rel="alternate" type="text/plain" title="Profile of Kshitij Bhatnagar for AI assistants" href="/llms.txt" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" />
    <meta property="og:type" content="${o.ogType}" />
    <meta property="og:site_name" content="${esc(P.name)}" />
    <meta property="og:url" content="${SITE}${o.path}" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.description)}" />
    <meta property="og:image" content="${esc(o.image)}" />
    <meta property="og:image:alt" content="${esc(o.imageAlt)}" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(o.title)}" />
    <meta name="twitter:description" content="${esc(o.description)}" />
    <meta name="twitter:image" content="${esc(o.image)}" />
    <meta name="twitter:image:alt" content="${esc(o.imageAlt)}" />
    <style>${STATIC_CSS}</style>
    ${ld(o.jsonld)}${o.head ? `\n    ${o.head}` : ''}
  </head>
  <body>
    <header class="top">
      <div class="top__in">
        <a class="brand" href="/">${esc(FIRST_NAME)} <span class="serif">${esc(LAST_NAME.join(' '))}</span></a>
        <nav aria-label="Site"><a href="/about/"${current(o.path, '/about/')}>About</a><a href="/#work">Work</a><a href="/case-studies/"${current(o.path, '/case-studies/')}>Case studies</a><a href="/#contact">Contact</a></nav>
      </div>
    </header>
    <main class="${o.main ?? 'layout'}">
${o.body}
<footer class="foot">
${o.foot}
</footer>
    </main>${o.tail ? `\n${o.tail}` : ''}
  </body>
</html>
`;

// the last crumb is the page itself, so it takes no link
export const crumbs = (trail: [label: string, href?: string][]) =>
  `<ol class="crumbs">${trail.map(([label, href]) => (href ? `<li><a href="${esc(href)}">${esc(label)}</a></li>` : `<li aria-current="page">${esc(label)}</li>`)).join('')}</ol>`;

export const siteFoot = (today: string) => `<p>Built by <a href="/about/">${esc(P.name)}</a></p>
<ul class="links" aria-label="${esc(P.name)} online">${P.links.map((l) => `<li><a class="pill" href="${esc(l.href)}" rel="me noopener">${esc(l.label)}</a></li>`).join('')}</ul>
<p class="updated">Updated ${today}</p>`;
// #endregion
