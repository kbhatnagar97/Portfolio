import projectsData from '../content/projects.json';
import profileData from '../content/profile.json';
import professionalData from '../content/professional.json';
import achievementsData from '../content/achievements.json';
import claudeStoryData from '../content/claude-story.json';
import { SHAPE, type TShapeName } from './scene/shapes';

export type TProjectStatus = 'Live' | 'In progress' | 'Private' | 'Research' | 'Open source';

export interface IProject {
  id: string;
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

export const PROJECTS = projectsData as IProject[];
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

export const shapeOf = (name: string) => SHAPE[name as TShapeName] ?? SHAPE.field;

export const monogram = (name: string) => {
  const caps = name.match(/[A-Z]/g) ?? [];
  if (caps.length >= 2) return caps.slice(0, 2).join('');
  const words = name.split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
};

export const statusLabel = (p: IProject) => (p.live ? 'Live' : p.status);
