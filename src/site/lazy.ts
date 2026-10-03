import { lazy, type ComponentType } from 'react';

// A chunk that fails to load renders nothing, so a network blip never blanks the whole page.
export const lazyOrNothing = <P extends object>(load: () => Promise<{ default: ComponentType<P> }>) =>
  lazy<ComponentType<P>>(() => load().catch(() => ({ default: () => null })));
