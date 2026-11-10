'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, useGLTF, useProgress } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import * as THREE from 'three';
import { biomeAsset, type GenesisBiome, type GenesisCamera, type GenesisQuality } from '@/lib/genesis-biomes';
import WorldPerformance from './WorldPerformance';

function normalizeScene(scene: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(scene);
  if (bounds.isEmpty()) return { scale: 1, position: [0, 0, 0] as [number,number,number] };
  const dimensions = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 178 / Math.max(1, dimensions.x, dimensions.z);
  return {
    scale,
    position: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] as [number,number,number],
  };
}

function WorldModel({ biome, quality }: { biome: GenesisBiome; quality: GenesisQuality }) {
  const path = biomeAsset(biome.id, 'scene.glb');
  const { scene } = useGLTF(path);
  const fit = useMemo(() => normalizeScene(scene), [scene]);
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.receiveShadow = quality !== 'eco';
      // Avoid thousands of very expensive shadow casters in the scanned environments.
      obj.castShadow = quality === 'ultra' && /GATE|PORTAL|CROWN|HERO/i.test(obj.name);
      obj.frustumCulled = true;
    });
  }, [scene, quality]);
  return <group position={fit.position} scale={fit.scale}><primitive object={scene} /></group>;
}

function CameraRig({ mode, reset }: { mode: GenesisCamera; reset: number }) {
  const { camera } = useThree();
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const keys = useRef(new Set<string>());
  const elapsed = useRef(0);
  useEffect(() => {
    camera.position.set(mode === 'walk' ? 0 : 135, mode === 'walk' ? 9 : 105, mode === 'walk' ? 50 : 140);
    camera.lookAt(0, mode === 'walk' ? 9 : 15, 0);
    ref.current?.target.set(0, mode === 'walk' ? 9 : 15, 0);
    ref.current?.update();
    elapsed.current = 0;
  }, [mode, reset, camera]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, button, [contenteditable="true"]')) return;
      keys.current.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  useFrame((state, delta) => {
    if (mode === 'cinema') {
      elapsed.current += Math.min(delta, .08) * .14;
      const a = elapsed.current;
      camera.position.set(132 * Math.sin(a) + 25, 59 + 13 * Math.sin(a * .48), 132 * Math.cos(a));
      camera.lookAt(0, 17, 0);
      return;
    }
    if (mode !== 'walk') return;
    const movement = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    if (keys.current.has('w') || keys.current.has('arrowup')) movement.add(forward);
    if (keys.current.has('s') || keys.current.has('arrowdown')) movement.sub(forward);
    if (keys.current.has('d')) movement.add(right);
    if (keys.current.has('a')) movement.sub(right);
    if (movement.lengthSq() > 0) {
      const speed = keys.current.has('shift') ? 28 : 12;
      const move = movement.normalize().multiplyScalar(Math.min(delta,.07) * speed);
      camera.position.add(move);
      ref.current?.target.add(move);
      // Keep the visitor in the authored area; this is an exploration camera, not physics navigation.
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -89, 89);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -89, 89);
      ref.current?.update();
    }
  });
  return <OrbitControls ref={ref} enabled={mode !== 'cinema'} enableDamping dampingFactor={.075}
    enablePan={mode === 'orbit'} minDistance={mode === 'walk' ? 1.5 : 12} maxDistance={350}
    minPolarAngle={.06} maxPolarAngle={mode === 'walk' ? Math.PI*.72 : Math.PI*.48} />;
}

export function BiomeLoadProgress() {
  const { progress, active, loaded, total } = useProgress();
  if (!active && total > 0) return null;
  return <div className="gb-loading-progress" role="status" aria-live="polite">
    <span className="gb-loader-ring"/><strong>PREPARING WORLD</strong>
    <span>{active ? `${Math.round(progress)}% · ${loaded}/${total} resources` : 'Inicializando geometría y texturas…'}</span>
    <div className="gb-progress-track"><div style={{ width: `${Math.min(progress, 100)}%` }}/></div>
  </div>;
}

export default function GenesisBiomeScene({ biome, quality, cameraMode, reset, time, onFps }: {
  biome: GenesisBiome;
  quality: GenesisQuality;
  cameraMode: GenesisCamera;
  reset: number;
  time: number;
  onFps: (value: number) => void;
}) {
  const dpr: [number,number] = quality === 'eco' ? [1,1] : quality === 'high' ? [1,1.5] : [1,2];
  const night = time < 6 || time > 20;
  const intensity = night ? .38 : time > 17 ? 1.45 : 2.2;
  return <Canvas className="gb-canvas" camera={{ position: [135, 105, 140], fov: 48, near: .1, far: 1500 }}
    dpr={dpr} shadows={quality === 'ultra'} gl={{ antialias: quality !== 'eco', powerPreference: 'high-performance', alpha: false }}>
    <color attach="background" args={[biome.sky]} />
    <fog attach="fog" args={[biome.fog, biome.fogDistance*.6, biome.fogDistance*1.8]} />
    <ambientLight intensity={night ? .7 : 1.15} color={biome.id === 'ember-wastes' ? '#ffddce' : '#e5f3ff'} />
    <hemisphereLight args={['#e3f2ff', '#46544f', night ? .65 : 1.8]} />
    <directionalLight castShadow={quality === 'ultra'} intensity={intensity} color={biome.id === 'ember-wastes' ? '#ffbf93' : '#ffe6c6'}
      position={[95, 160, 65]} shadow-mapSize={[1024,1024]} shadow-camera-left={-110} shadow-camera-right={110}
      shadow-camera-top={110} shadow-camera-bottom={-110} shadow-bias={-.0004} />
    {quality !== 'eco' && <Sky distance={450000} sunPosition={night ? [0,-1,0] : [100, 30 + Math.sin((time-6)*Math.PI/12)*60, 90]}
      turbidity={biome.id === 'sunfall-dunes' ? 8 : 3.8} rayleigh={biome.id === 'frostbound-peaks' ? 2.5 : 1.2} />}
    <Suspense fallback={null}><WorldModel biome={biome} quality={quality} /></Suspense>
    <CameraRig mode={cameraMode} reset={reset} />
    <WorldPerformance onSample={onFps} />
  </Canvas>;
}
