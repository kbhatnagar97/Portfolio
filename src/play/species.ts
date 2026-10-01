// copied so the playground chunk shares nothing with the home bundle
export const BOT = {
  chassis: { x: 0, y: -12, d: 'M-5.5-6h11a3.5 3.5 0 0 1 3.5 3.5v5a3.5 3.5 0 0 1-3.5 3.5h-11a3.5 3.5 0 0 1-3.5-3.5v-5a3.5 3.5 0 0 1 3.5-3.5z' },
  stripe: { x: 0, y: -12, d: 'M-9 2.5h18v1.5h-18z' },
  head: { x: 0, y: -25.5, d: 'M-4-5h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z' },
  visor: { x: 1, y: -25.75, d: 'M-3.25-1.25h6.5a1.25 1.25 0 0 1 0 2.5h-6.5a1.25 1.25 0 0 1 0-2.5z' },
  neck: { x1: 0, y1: -18, x2: 0, y2: -20.5 },
  antenna: { x1: 0, y1: -30.5, x2: 0, y2: -37, tip: 1.6, glow: 3.5 },
  wheel: { r: 3.5, x: 6, y: -3.5 },
  arm: { sx: 5, sy: -14, len: 8, hand: 1.8 },
  pupil: { r: 0.9, dx: 2, slide: 1.5 },
  height: 40,
  width: 20,
} as const;
