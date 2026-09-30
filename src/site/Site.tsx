import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { startSmoothScroll, ScrollTrigger } from './smooth';
import { automationById, projectById } from './data';
import { useReveals } from './motion';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Skills from './sections/Skills';
import Work from './sections/Work';
import Automations from './sections/Automations';
import Journey from './sections/Journey';
import Process from './sections/Process';
import Contact from './sections/Contact';
import ProjectModal from './sections/ProjectModal';
import WorkflowLab from './sections/WorkflowLab';
import './site.scss';

const Scene = lazy(() => import('./scene/Scene'));

const Site = () => {
  const [openId, setOpenId] = useState<string>();
  const [labId, setLabId] = useState<string>();
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
  const flow = labId ? automationById(labId) : undefined;
  // automations open their interactive board instead of the story modal
  const open = (id: string) => (automationById(id) ? setLabId(id) : setOpenId(id));

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
        <Skills onOpen={open} />
        <Work onOpen={open} />
        <Automations onOpen={open} />
        <Journey />
        <Process />
        <Contact />
      </main>
      <AnimatePresence>
        {project && <ProjectModal key='modal' project={project} onNavigate={open} onClose={() => setOpenId(undefined)} />}
      </AnimatePresence>
      {flow && <WorkflowLab key={flow.id} flow={flow} onClose={() => setLabId(undefined)} />}
    </div>
  );
};

export default Site;
