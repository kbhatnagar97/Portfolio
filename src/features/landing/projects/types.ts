export type TProjectStatus = 'Live' | 'In progress' | 'Private' | 'Research';

export interface IProject {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  category: string;
  status: TProjectStatus;
  live: boolean;
  url: string;
  repo: string;
  year: string;
  accent: string;
  stack: string[];
  summary: string;
  spark: string;
  build: string;
  architecture: string[];
  highlights: string[];
}

export interface IClaudeStorySection {
  id: string;
  emoji: string;
  title: string;
  body: string;
  points: string[];
}

export interface IClaudeStory {
  eyebrow: string;
  title: string;
  intro: string;
  stats: { value: string; label: string }[];
  sections: IClaudeStorySection[];
}

/** Two-letter typographic monogram derived from a project name (no emojis). */
export const monogram = (name: string): string => {
  const caps = name.match(/[A-Z]/g) ?? [];
  if (caps.length >= 2) return caps.slice(0, 2).join('');
  const words = name.split(/\s+/).filter((w) => !/^(the|of|a|and)$/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};
