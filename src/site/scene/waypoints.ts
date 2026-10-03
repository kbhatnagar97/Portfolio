// Shape ids that sections declare as `data-shape`; kept apart from the point cloud builders so the main chunk skips them.
export const SHAPE = {
  orb: 0,
  interface: 1,
  globe: 2,
  network: 3,
  stack: 4,
  field: 5,
  ring: 6,
} as const;

type TShapeName = keyof typeof SHAPE;

export const shapeOf = (name: string) => SHAPE[name as TShapeName] ?? SHAPE.field;
