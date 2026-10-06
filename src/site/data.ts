import projectsData from '../content/projects.json';
import profileData from '../content/profile.json';
import professionalData from '../content/professional.json';
import achievementsData from '../content/achievements.json';
import claudeStoryData from '../content/claude-story.json';
import automationCards from 'virtual:automation-cards';
import automationsMoreData from '../content/automations-more.json';
import type { MouseEvent } from 'react';

export type TProjectStatus = 'Live' | 'In progress' | 'Private' | 'Research' | 'Open source';

export interface IProject {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  status: TProjectStatus;
  live: boolean;
  url: string;
  repo: string;
  writeup?: string;
  year: string;
  accent: string;
  stack: string[];
  summary: string;
  spark: string;
  build: string;
  architecture: string[];
  highlights: string[];
  featured?: boolean;
  poster?: string;
  video?: string;
  film?: string;
}

export type TFlowKind = 'trigger' | 'source' | 'ai' | 'rule' | 'human' | 'output' | 'drop';

export interface IFlowNode {
  id: string;
  kind: TFlowKind;
  label: string;
  sub: string;
  body: string;
  at: [number, number];
  m: [number, number];
  // designed but not built yet: drawn dashed, and its run lines are marked planned
  planned?: boolean;
  // what happens when a visitor knocks the node offline: hand over to `via`, then carry on, or end the run there;
  // a `via` that is a later run step jumps the run ahead to that step
  fallback?: { via?: string; log: string; then?: 'end' };
}

export interface IFlowHop {
  node: string;
  log: string;
}

export interface IFlowChoice {
  label: string;
  log: string;
  tone?: string;
  route: IFlowHop[];
  // after the route: end the run (default), carry on with the next step, or ask the same question again
  then?: 'next' | 'again';
}

export interface IFlowStep extends IFlowHop {
  // a shorter line for the card's two line caption; the lab always shows the full log
  card?: string;
  branches?: { to: string; log: string; tone?: string }[];
  ask?: { prompt: string; choices: IFlowChoice[] };
}

export interface IAutomation {
  id: string;
  name: string;
  tagline: string;
  cadence: string;
  accent: string;
  // shown instead of "Live" while a workflow is not running yet
  status?: string;
  note?: string;
  writeup?: string;
  stats: { value: number; label: string }[];
  nodes: IFlowNode[];
  edges: string[][];
  run: IFlowStep[];
  // a polling flow: after each run the lab logs this line and fires the trigger again, until the visitor stops it
  loop?: string;
  // the run steps the card's bot crew acts out, for a run too long for the card; defaults to the whole run
  crew?: string[];
}

// What the card's bot floor acts out: built at compile time from the full flow (vite.config.ts), so node bodies,
// board positions and the full run only ship with the lab chunk.
export type TCrewNode = Pick<IFlowNode, 'id' | 'kind' | 'label' | 'fallback'>;
export interface ICrew {
  id: string;
  nodes: TCrewNode[];
  run: IFlowStep[];
}

export type IAutomationCard = Pick<IAutomation, 'id' | 'name' | 'tagline' | 'cadence' | 'accent' | 'status' | 'note' | 'writeup' | 'stats'> & {
  stages: number;
  lines: number;
  crew: ICrew;
};

export interface IAutomationLine {
  name: string;
  does: string;
  cadence: string;
  status?: string;
  lab?: string;
  project?: string;
}

export const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const PROJECTS: IProject[] = (projectsData as Omit<IProject, 'slug'>[]).map((p) => ({ ...p, slug: slugOf(p.name) }));
export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug);

// real links for crawlers and new tabs; a plain click stays in the page and opens the story
export const storyLink = (p: IProject, onOpen: (id: string) => void) => ({
  href: `/projects/${p.slug}/`,
  onClick: (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(p.id);
  },
});
export const AUTOMATIONS: IAutomationCard[] = automationCards;
export const automationById = (id: string) => AUTOMATIONS.find((a) => a.id === id);
// a flow with a status other than "Live" is not running yet, so it never shows the live pulse
export const isLive = (a: Pick<IAutomation, 'status'>) => (a.status ?? 'Live') === 'Live';
export const runLabel = (a: Pick<IAutomation, 'status' | 'cadence'>) => `${a.status ?? 'Live'} · ${a.cadence}`;
export const ledClass = (a: Pick<IAutomation, 'status'>) => `lab__led ${isLive(a) ? 'lab__led--live' : 'lab__led--soon'}`;

// every personal automation in one list: the interactive boards first, then the ones without a board
export const AUTOMATION_INDEX: IAutomationLine[] = [
  ...AUTOMATIONS.map((a) => ({ name: a.name, does: a.tagline, cadence: a.cadence, status: isLive(a) ? undefined : a.status, lab: a.id })),
  ...(automationsMoreData as IAutomationLine[]),
];
export const PROFILE = profileData;
export const ROLES = professionalData.ROLES;
export const EARLY = professionalData.EARLY_EXPERIENCE;
export const AWARDS = achievementsData;
export const STORY = claudeStoryData;

export const FEATURED = PROJECTS.filter((p) => p.featured);
export const LIVE_COUNT = PROJECTS.filter((p) => p.live).length;
export const CATEGORIES = [...new Set(PROJECTS.map((p) => p.category))];
export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);

export const YEARS_EXPERIENCE = (() => {
  const [y, m] = PROFILE.careerStart.split('-').map(Number);
  const now = new Date();
  return Math.floor((now.getFullYear() - y) + (now.getMonth() + 1 - m) / 12);
})();

export const monogram = (name: string) => {
  const caps = name.match(/[A-Z]/g) ?? [];
  if (caps.length >= 2) return caps.slice(0, 2).join('');
  const words = name.split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
};

export const statusLabel = (p: IProject) => (p.live ? 'Live' : p.status);
