import { Suspense, useEffect, useState } from 'react';
import { startSmoothScroll, ScrollTrigger } from './smooth';
import { automationById, projectById, projectBySlug } from './data';
import { useReveals } from './motion';
import { lazyOrNothing } from './lazy';
import Nav from './sections/Nav';
import Hero from './sections/Hero';
import Skills from './sections/Skills';
import Work from './sections/Work';
import Automations from './sections/Automations';
import Journey from './sections/Journey';
import Process from './sections/Process';
import Contact from './sections/Contact';
import { unlockEarly } from './audio/early';
import './site.scss';

const Scene = lazyOrNothing(() => import('./scene/Scene'));
// the lab and its audio engine stay out of the main chunk
const loadLab = () => import('./sections/WorkflowLab');
const WorkflowLab = lazyOrNothing(loadLab);
// framer-motion only ships with the modal and lightbox, so it is fetched on idle instead of blocking first paint
const loadModal = () => import('./sections/ModalLayer');
const ModalLayer = lazyOrNothing(loadModal);

const Site = () => {
  const [openId, setOpenId] = useState<string>();
  const [modalOn, setModalOn] = useState(false);
  const [labId, setLabId] = useState<string>();
  const [sceneReady, setSceneReady] = useState(false);
  useReveals();

  const project = openId ? projectById(openId) : undefined;
  const flow = labId ? automationById(labId) : undefined;
  // automations open their interactive board instead of the story modal; the lab's sound unlocks inside this click
  const open = (id: string) => (automationById(id) ? (unlockEarly(), setLabId(id)) : (setModalOn(true), setOpenId(id)));

  useEffect(() => {
    const stop = startSmoothScroll();
    // three.js loads after first paint so the text is never waiting on WebGL
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    idle(() => {
      setSceneReady(true);
      void loadModal().catch(() => undefined);
      void import('./sections/Lightbox').catch(() => undefined);
    });
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    // fetch the lab a screen before its cards come into view, so the first open is instant
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void loadLab().catch(() => undefined);
      },
      { rootMargin: '100% 0px' },
    );
    const autos = document.getElementById('automations');
    if (autos) io.observe(autos);
    return () => {
      io.disconnect();
      stop();
    };
  }, []);

  // /?project=<slug> is the static project pages' way back into the interactive story
  useEffect(() => {
    const slug = new URLSearchParams(location.search).get('project');
    const target = slug ? projectBySlug(slug) : undefined;
    if (!slug) return;
    history.replaceState(history.state, '', location.pathname + location.hash);
    if (!target) return;
    if (automationById(target.id)) setLabId(target.id);
    else {
      setModalOn(true);
      setOpenId(target.id);
    }
  }, []);

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
      {modalOn && (
        <Suspense fallback={null}>
          <ModalLayer project={project} onNavigate={open} onClose={() => setOpenId(undefined)} />
        </Suspense>
      )}
      {flow && (
        <Suspense fallback={null}>
          <WorkflowLab key={flow.id} id={flow.id} onClose={() => setLabId(undefined)} />
        </Suspense>
      )}
    </div>
  );
};

export default Site;
