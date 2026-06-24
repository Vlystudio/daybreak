"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useAnimations, Center, Bounds } from "@react-three/drei";
import type { Group } from "three";

/**
 * Loads a bird GLB and renders it as a freely-rotatable 3D model with its rig
 * animation playing. <Center> + <Bounds> auto-frame the model whatever its size
 * (tiny hummingbird vs tall heron), so it's never cropped or zoomed wrong.
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
      camera={{ position: [0.6, 0.4, 4], fov: 32 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%", touchAction: "none", cursor: "grab" }}
    >
      <hemisphereLight args={["#fff6e0", "#56624f", 1.15]} />
      <directionalLight position={[5, 9, 6]} intensity={1.35} />
      <directionalLight position={[-5, 2, -4]} intensity={0.4} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.35}>
          <Center>
            <Model url={url} clip={clip} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enablePan={false} autoRotate autoRotateSpeed={1.1} minPolarAngle={0.6} maxPolarAngle={1.95} />
    </Canvas>
  );
}
