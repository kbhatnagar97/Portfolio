// One clock for every flap on the page: a time ordered queue on one requestAnimationFrame loop that stops when it empties.

type TJob = { at: number; run: (now: number) => void };

const queue: TJob[] = [];
let ticking = false;

const tick = (now: number) => {
  // the flag stays set while jobs run, so a job that schedules more work never starts a second loop
  try {
    while (queue.length && queue[0].at <= now) {
      const job = queue.shift() as TJob;
      try {
        job.run(now);
      } catch (e) {
        console.error(e);
      }
    }
  } finally {
    if (queue.length) requestAnimationFrame(tick);
    else ticking = false;
  }
};

// jobs due at the same time run in the order they were added
export const at = (time: number, run: (now: number) => void) => {
  let i = queue.length;
  while (i > 0 && queue[i - 1].at > time) i--;
  queue.splice(i, 0, { at: time, run });
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
};
