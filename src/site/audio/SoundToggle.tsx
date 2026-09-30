import { useSyncExternalStore } from 'react';
import { audio } from './engine';

// WCAG 1.4.2: the music runs past 3 s, so this sits first in the lab actions and answers to M
export default function SoundToggle() {
  const s = useSyncExternalStore(audio.subscribe, audio.snapshot, () => 'all' as const);
  const na = s === 'na';
  const label = na ? 'Sound unavailable' : s === 'all' ? 'Mute sound' : 'Turn sound on';
  return (
    <button type='button' className='lab__icon lab__sound' aria-label={label} aria-pressed={na ? undefined : s === 'off'} title={na ? label : `${label} (M)`} disabled={na} onClick={() => audio.cycle()}>
      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
        <path d='M4 9.5h3.5L12 5.5v13l-4.5-4H4z' />
        {s === 'all' && <path d='M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11' />}
        {(s === 'off' || na) && <path d='M15.5 9.5l5 5M20.5 9.5l-5 5' />}
      </svg>
    </button>
  );
}
