import { useRef, useEffect, useState, Suspense } from 'react';
import type { FC, MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  Float,
  Sparkles,
  MeshDistortMaterial,
  Environment,
  Lightformer,
} from '@react-three/drei';
import * as THREE from 'three';

type Vec = { x: number; y: number };

// #region 3D gem
interface GemProps {
  scrollRef: MutableRefObject<number>;
  pointerRef: MutableRefObject<Vec>;
}

const Gem: FC<GemProps> = ({ scrollRef, pointerRef }) => {
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const scroll = scrollRef.current;
    const p = pointerRef.current;
    const progress = Math.min(scroll / 900, 1);

    if (core.current) {
      core.current.rotation.y += delta * 0.2 + progress * 0.01;
      core.current.rotation.x = THREE.MathUtils.lerp(
        core.current.rotation.x,
        p.y * 0.4,
        0.05
      );
    }
    if (shell.current) {
      shell.current.rotation.y -= delta * 0.12;
      shell.current.rotation.z += delta * 0.05;
    }
    if (group.current) {
      // scroll pulls the gem back and to the side as you descend
      group.current.position.z = THREE.MathUtils.lerp(
        group.current.position.z,
        -progress * 2.4,
        0.06
      );
      group.current.position.x = THREE.MathUtils.lerp(
        group.current.position.x,
        p.x * 0.5 + progress * 0.6,
        0.05
      );
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        p.x * 0.1,
        0.05
      );
    }
  });

  return (
    <group ref={group} position={[0, -0.2, 0]}>
      <Float speed={1.3} rotationIntensity={0.5} floatIntensity={0.9}>
        <mesh ref={core}>
          <icosahedronGeometry args={[1.4, 6]} />
          <MeshDistortMaterial
            color='#e6b450'
            metalness={0.92}
            roughness={0.18}
            distort={0.32}
            speed={1.5}
            envMapIntensity={1.1}
          />
        </mesh>
        <mesh ref={shell} scale={1.4}>
          <icosahedronGeometry args={[1.4, 1]} />
          <meshBasicMaterial
            color='#f4d38a'
            wireframe
            transparent
            opacity={0.14}
          />
        </mesh>
      </Float>
      <Sparkles
        count={60}
        scale={[8, 5, 4]}
        size={2.4}
        speed={0.3}
        color='#f4d38a'
        opacity={0.65}
      />
    </group>
  );
};
// #endregion

const Hero3D: FC = () => {
  const scrollRef = useRef(0);
  const pointerRef = useRef<Vec>({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);

    const onScroll = () => {
      scrollRef.current = window.scrollY;
    };
    const onMove = (e: PointerEvent) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      };
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  if (reduced) {
    return <div className='hero3d hero3d--static' aria-hidden='true' />;
  }

  return (
    <div className='hero3d' aria-hidden='true'>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 6, 4]} intensity={2.4} color='#fff4d6' />
        <Suspense fallback={null}>
          <Gem scrollRef={scrollRef} pointerRef={pointerRef} />
          <Environment resolution={256}>
            <Lightformer
              intensity={2.2}
              position={[0, 3, 4]}
              scale={[7, 7, 1]}
              color='#fff0cf'
            />
            <Lightformer
              intensity={1.4}
              position={[-4, -2, -3]}
              scale={[5, 5, 1]}
              color='#7c4dff'
            />
            <Lightformer
              intensity={1.1}
              position={[4, -1, 2]}
              scale={[5, 5, 1]}
              color='#17b6c9'
            />
          </Environment>
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Hero3D;
