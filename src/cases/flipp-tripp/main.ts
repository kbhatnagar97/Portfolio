import { boot } from '../shared/boot';
import { nearView } from '../shared/view';
import './case.scss';

// The stage module loads a screen early; the HTML already holds the complete first frame of both live parts.
boot(() => {
  const stage = document.getElementById('stage');
  if (!stage) return;
  nearView(stage, () =>
    void import('./stage/start')
      .then((m) => m.start(stage))
      .catch((e: unknown) => {
        console.error(e);
        // the controls stay disabled; the step texts under the drawing still describe the whole flip
        stage.querySelector<HTMLElement>('.ft-error')?.removeAttribute('hidden');
      }),
  );
});
