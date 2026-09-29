// Bridges DOM sections and the particle scene. Sections declare `data-shape="<index>"`;
// the scene maps the viewport centre onto one continuous (a -> b, t) morph between them.
interface IAnchor {
  y: number;
  shape: number;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

let anchors: IAnchor[] = [];

export const sceneState = {
  lastPointer: -Infinity,

  measure() {
    anchors = [...document.querySelectorAll<HTMLElement>('[data-shape]')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { y: rect.top + window.scrollY + rect.height / 2, shape: Number(el.dataset.shape) };
      })
      .sort((p, q) => p.y - q.y);
  },

  resolve(centre: number): { a: number; b: number; t: number } {
    if (!anchors.length) return { a: 0, b: 0, t: 0 };
    const first = anchors[0];
    if (centre <= first.y) return { a: first.shape, b: first.shape, t: 0 };
    for (let i = 0; i < anchors.length - 1; i++) {
      const p = anchors[i];
      const q = anchors[i + 1];
      if (centre <= q.y) {
        // hold each shape while its section is centred, morph through the gap between them
        return { a: p.shape, b: q.shape, t: smoothstep(0.28, 0.72, (centre - p.y) / (q.y - p.y)) };
      }
    }
    const last = anchors[anchors.length - 1];
    return { a: last.shape, b: last.shape, t: 0 };
  },
};
