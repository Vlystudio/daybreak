"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations } from "@react-three/drei";
import type { Group } from "three";

/**
 * Loads a procedural bird GLB (from the Blender pipeline) and renders it as a
 * true, freely-rotatable 3D model with its rig animations playing. Drag to spin
 * any direction; gentle auto-rotate + soft lighting.
 */
function Model({ url, clip }: { url: string; clip: string }) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const a = actions[clip] ?? (names[0] ? actions[names[0]] : undefined);
    a?.reset().fadeIn(0.3).play();
    return () => {
      a?.fadeOut(0.3);
    };
  }, [actions, names, clip]);

  return <primitive ref={group} object={scene} />;
}

export function Bird3DViewer({ url, clip = "idle" }: { url: string; clip?: string }) {
  return (
    <Canvas
      camera={{ position: [0, 0.8, 8], fov: 30 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%", touchAction: "none", cursor: "grab" }}
    >
      <hemisphereLight args={["#fff6e0", "#56624f", 1.1]} />
      <directionalLight position={[5, 9, 6]} intensity={1.3} />
      <directionalLight position={[-5, 2, -4]} intensity={0.4} />
      <Suspense fallback={null}>
        <Model url={url} clip={clip} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.3}
        target={[0, 0.5, 0]}
        minPolarAngle={0.5}
        maxPolarAngle={2.1}
        minDistance={4}
        maxDistance={14}
      />
    </Canvas>
  );
}
