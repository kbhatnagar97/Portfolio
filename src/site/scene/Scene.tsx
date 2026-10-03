import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildShapes } from './shapes';
import { SHAPE } from './waypoints';
import { reducedMotion } from '../smooth';
import { sceneState } from './state';

const vertexShader = /* glsl */ `
  attribute vec3 posA;
  attribute vec3 posB;
  attribute float aRand;
  attribute float aGold;
  uniform float uT;
  uniform float uTime;
  uniform float uSpinA;
  uniform float uSpinB;
  uniform float uTiltX;
  uniform float uScale;
  uniform vec3 uOffA;
  uniform vec3 uOffB;
  uniform vec3 uRayO;
  uniform vec3 uRayD;
  uniform float uRepel;
  uniform float uSize;
  uniform float uPR;
  uniform float uSwirl;
  varying float vGold;
  varying float vTwinkle;

  vec3 spin(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  }

  void main() {
    // per particle delay so the morph ripples instead of moving in lockstep
    float s = smoothstep(aRand * 0.45, aRand * 0.45 + 0.55, uT);
    vec3 a = spin(posA, uSpinA) * uScale + uOffA;
    vec3 b = spin(posB, uSpinB) * uScale + uOffB;
    vec3 p = mix(a, b, s);
    float mid = sin(3.14159 * s) * uSwirl;
    p += mid * 0.7 * vec3(sin(p.y * 2.1 + aRand * 6.28), cos(p.z * 1.7 + aRand * 4.0), sin(p.x * 1.9 + aRand * 5.0));
    p += 0.02 * vec3(sin(uTime * 0.9 + aRand * 40.0), cos(uTime * 0.7 + aRand * 30.0), sin(uTime * 0.8 + aRand * 20.0));

    float cx = cos(uTiltX), sx = sin(uTiltX);
    p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec3 toP = world.xyz - uRayO;
    vec3 closest = uRayO + uRayD * dot(toP, uRayD);
    vec3 away = world.xyz - closest;
    float d = length(away);
    world.xyz += (away / max(d, 1e-4)) * uRepel * smoothstep(0.85, 0.0, d) * 0.5;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPR * (0.55 + aRand * 0.9) / -mv.z;
    vGold = aGold;
    vTwinkle = 0.6 + 0.4 * sin(uTime * 1.3 + aRand * 60.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uAlpha;
  varying float vGold;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    gl_FragColor = vec4(mix(uColA, uColB, vGold), a * vTwinkle * uAlpha);
  }
`;

// Shapes that read well spinning; the rest only sway so their silhouette stays legible.
const SPINNERS = new Set<number>([SHAPE.orb, SHAPE.globe]);
const ORIGIN = new THREE.Vector3();

const damp = (from: number, to: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(from, to, 1 - Math.exp(-lambda * dt));

const Particles = ({ count, reduced }: { count: number; reduced: boolean }) => {
  const { camera, size, viewport, gl } = useThree();
  const shapes = useMemo(() => buildShapes(count), [count]);
  const attrs = useMemo(() => shapes.positions.map((p) => new THREE.BufferAttribute(p, 3)), [shapes]);
  const current = useRef({ a: -1, b: -1 });
  const smooth = useRef({ y: 0, repel: 0, spin: 0, px: 0, py: 0 });
  const ray = useMemo(() => new THREE.Raycaster(), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', attrs[0]);
    g.setAttribute('posA', attrs[0]);
    g.setAttribute('posB', attrs[0]);
    g.setAttribute('aRand', new THREE.BufferAttribute(shapes.rand, 1));
    g.setAttribute('aGold', new THREE.BufferAttribute(shapes.gold, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    return g;
  }, [attrs, shapes]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uTime: { value: 0 },
          uSpinA: { value: 0 },
          uSpinB: { value: 0 },
          uTiltX: { value: 0 },
          uScale: { value: 1 },
          uOffA: { value: new THREE.Vector3() },
          uOffB: { value: new THREE.Vector3() },
          uRayO: { value: new THREE.Vector3(0, 0, 100) },
          uRayD: { value: new THREE.Vector3(0, 0, -1) },
          uRepel: { value: 0 },
          uSize: { value: 30 },
          uPR: { value: 1 },
          uSwirl: { value: reduced ? 0 : 1 },
          uAlpha: { value: 1 },
          uColA: { value: new THREE.Color('#f3e6d3') },
          uColB: { value: new THREE.Color('#f0b44c') },
        },
      }),
    [reduced],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useEffect(() => {
    smooth.current.y = window.scrollY;
    const onMove = () => (sceneState.lastPointer = performance.now());
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state, dt) => {
    const u = material.uniforms;
    const s = smooth.current;
    const time = state.clock.elapsedTime;
    const wide = size.width >= 900;
    const { width: vw, height: vh } = viewport.getCurrentViewport(camera, ORIGIN);

    s.y = reduced ? window.scrollY : damp(s.y, window.scrollY, 7, dt);
    const { a, b, t } = reduced ? { a: SHAPE.orb, b: SHAPE.orb, t: 0 } : sceneState.resolve(s.y + window.innerHeight / 2);

    if (a !== current.current.a) geometry.setAttribute('posA', attrs[a]);
    if (b !== current.current.b) geometry.setAttribute('posB', attrs[b]);
    current.current = { a, b };

    const offset = (k: number, out: THREE.Vector3) => {
      if (k === SHAPE.field || k === SHAPE.ring) return out.set(0, 0, 0);
      return wide ? out.set(vw * 0.24, 0, 0) : out.set(0, vh * 0.2, 0);
    };
    offset(a, u.uOffA.value);
    offset(b, u.uOffB.value);

    const alpha = (k: number) => (k === SHAPE.field ? 0.55 : k === SHAPE.ring ? 0.75 : wide ? 1 : 0.5);
    u.uAlpha.value = THREE.MathUtils.lerp(alpha(a), alpha(b), t);
    u.uT.value = t;
    u.uTime.value = time;
    u.uScale.value = wide ? Math.min(0.92, vw / 8.2) : Math.min(0.9, vw / 3.6);

    const sway = Math.sin(time * 0.3) * 0.35;
    u.uSpinA.value = (SPINNERS.has(a) ? time * 0.18 : sway) + s.px * 0.5;
    u.uSpinB.value = (SPINNERS.has(b) ? time * 0.18 : sway) + s.px * 0.5;

    s.px = damp(s.px, state.pointer.x, 3, dt);
    s.py = damp(s.py, state.pointer.y, 3, dt);
    u.uTiltX.value = -s.py * 0.18;

    const active = !reduced && performance.now() - sceneState.lastPointer < 1600;
    s.repel = damp(s.repel, active ? 1 : 0, 4, dt);
    u.uRepel.value = s.repel;
    ray.setFromCamera(state.pointer, camera);
    u.uRayO.value.copy(ray.ray.origin);
    u.uRayD.value.copy(ray.ray.direction);
    u.uPR.value = gl.getPixelRatio();
    u.uSize.value = wide ? 30 : 26;

    camera.position.x = damp(camera.position.x, s.px * 0.25, 2, dt);
    camera.position.y = damp(camera.position.y, s.py * 0.15, 2, dt);
    camera.lookAt(0, 0, 0);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const Scene = () => {
  const reduced = useMemo(reducedMotion, []);
  const count = useMemo(() => (innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4 ? 7000 : 16000), []);

  useEffect(() => {
    sceneState.measure();
    const ro = new ResizeObserver(() => sceneState.measure());
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  return (
    <SceneBoundary>
      <Canvas
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
        eventSource={document.body}
        eventPrefix='client'
        dpr={[1, 1.6]}
        camera={{ position: [0, 0, 7], fov: 35 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        fallback={null}
        aria-hidden='true'
      >
        <Particles count={count} reduced={reduced} />
      </Canvas>
    </SceneBoundary>
  );
};

export default Scene;
