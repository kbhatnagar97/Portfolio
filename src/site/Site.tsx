import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { startSmoothScroll, ScrollTrigger } from './smooth';
import { projectById } from './data';
import { useReveals } from './motion';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Skills from './sections/Skills';
import Work from './sections/Work';
import Journey from './sections/Journey';
import Process from './sections/Process';
import Contact from './sections/Contact';
import ProjectModal from './sections/ProjectModal';
import './site.scss';

const Scene = lazy(() => import('./scene/Scene'));

const Site = () => {
  const [openId, setOpenId] = useState<string>();
  const [sceneReady, setSceneReady] = useState(false);
  useReveals();

  useEffect(() => {
    const stop = startSmoothScroll();
    // three.js loads after first paint so the text is never waiting on WebGL
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    idle(() => setSceneReady(true));
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    return stop;
  }, []);

  const project = openId ? projectById(openId) : undefined;

  return (
    <div className='site'>
      {sceneReady && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
      <div className='grain' aria-hidden='true' />
      <Nav />
      <main>
        <Hero />
        <Skills onOpen={setOpenId} />
        <Work onOpen={setOpenId} />
        <Journey />
        <Process />
        <Contact />
      </main>
      <AnimatePresence>
        {project && <ProjectModal key='modal' project={project} onNavigate={setOpenId} onClose={() => setOpenId(undefined)} />}
      </AnimatePresence>
    </div>
  );
};

export default Site;
