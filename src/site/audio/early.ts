// Main chunk shim: the engine arrives with the lab chunk, but iOS starts a context only inside the opener's own gesture.
type TNav = Navigator & { audioSession?: { type: string } };

export const KEY = 'lab-sound';
// '1' after an explicit Off to on: iOS may then play through the silent switch
export const LOUD_KEY = 'lab-sound-loud';

export const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
export const session = (t: string) => {
  const s = (navigator as TNav).audioSession;
  if (s) s.type = t;
};

let full: (() => void) | undefined;
let parked: AudioContext | undefined;
let expiry = 0;

// the engine hands over its own unlock once its chunk has loaded
export const registerUnlock = (f: () => void) => {
  full = f;
};

// synchronously inside the opener click
export function unlockEarly() {
  if (full) return full();
  if (parked || read(KEY) === 'off') return;
  session(read(LOUD_KEY) === '1' ? 'playback' : 'ambient');
  try {
    parked = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    // the engine retries on open and then shows the toggle as unavailable
    return;
  }
  // one silent sample wakes iOS below 17
  const b = parked.createBufferSource();
  b.buffer = parked.createBuffer(1, 1, parked.sampleRate);
  b.connect(parked.destination);
  b.start();
  void parked.resume().catch(() => undefined);
  // the lab chunk never arrived: nothing may keep a context alive outside the lab
  expiry = window.setTimeout(() => {
    void adopt()
      ?.close()
      .catch(() => undefined)
      .finally(() => session('auto'));
  }, 10000);
}

export const hasParked = () => !!parked;

export function adopt() {
  clearTimeout(expiry);
  const c = parked;
  parked = undefined;
  return c;
}
