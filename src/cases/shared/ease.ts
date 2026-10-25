// CSS cubic-bezier() as a GSAP ease, so scripted moves follow the CSS tokens without loading the CustomEase plugin.
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (u: number) => ((ax * u + bx) * u + cx) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  const y = (u: number) => ((ay * u + by) * u + cy) * u;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const err = x(u) - t;
      if (Math.abs(err) < 1e-6) return y(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    // Newton can stall on flat stretches of the curve; bisection always lands
    let lo = 0;
    let hi = 1;
    u = t;
    while (hi - lo > 1e-6) {
      if (x(u) < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return y(u);
  };
};

// --ease: arrivals and landings
export const EASE = bezier(0.16, 1, 0.3, 1);
// --ease-move: things already on screen moving from A to B
export const EASE_MOVE = bezier(0.77, 0, 0.175, 1);
