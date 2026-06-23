"use client";

import { Component, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { BirdSpecies } from "@/lib/game/birds";

/**
 * Rotatable 3D companion for the Nest "hero" slot. The bird is a parametric
 * plush model built from the species' palette + art recipe (template drives the
 * proportions; a few marks — hood / cap / mask / crest / bill / belly — are
 * applied as coloured geometry). Drag to spin; it gently bobs and auto-rotates.
 * The detailed 2D field-mark art still powers thumbnails and the asset files.
 */

interface Preset {
  headR: number;
  headY: number;
  bodyR: number;
  bodyY: number;
  bodyWide: number;
  bodyTall: number;
  neck: number;
  eyeR: number;
  bigEyes: boolean;
  legs: number;
}

function presetFor(t?: string): Preset {
  switch (t) {
    case "owl":
      return { headR: 1.25, headY: 0.8, bodyR: 1.3, bodyY: -0.5, bodyWide: 1.02, bodyTall: 1, neck: 0, eyeR: 0.3, bigEyes: true, legs: 0.3 };
    case "float":
      return { headR: 0.8, headY: 0.95, bodyR: 1.15, bodyY: -0.25, bodyWide: 1.5, bodyTall: 0.78, neck: 0.25, eyeR: 0.11, bigEyes: false, legs: 0 };
    case "wader":
      return { headR: 0.62, headY: 2.05, bodyR: 0.95, bodyY: -0.3, bodyWide: 1, bodyTall: 0.95, neck: 1.45, eyeR: 0.09, bigEyes: false, legs: 1.5 };
    case "raptor":
      return { headR: 0.86, headY: 1.05, bodyR: 1.05, bodyY: -0.25, bodyWide: 0.95, bodyTall: 1.28, neck: 0, eyeR: 0.14, bigEyes: false, legs: 0.45 };
    case "seabird":
      return { headR: 0.86, headY: 1.15, bodyR: 1.05, bodyY: -0.32, bodyWide: 0.95, bodyTall: 1.3, neck: 0, eyeR: 0.12, bigEyes: false, legs: 0.5 };
    case "goose":
      return { headR: 0.62, headY: 2.0, bodyR: 1.15, bodyY: -0.3, bodyWide: 1.2, bodyTall: 0.9, neck: 1.55, eyeR: 0.09, bigEyes: false, legs: 0.2 };
    case "gamebird":
      return { headR: 0.6, headY: 1.45, bodyR: 1.25, bodyY: -0.3, bodyWide: 1.15, bodyTall: 1, neck: 0.8, eyeR: 0.08, bigEyes: false, legs: 0.6 };
    case "hover":
      return { headR: 0.72, headY: 0.78, bodyR: 0.82, bodyY: -0.08, bodyWide: 0.9, bodyTall: 1.12, neck: 0, eyeR: 0.11, bigEyes: false, legs: 0 };
    case "shorebird":
      return { headR: 0.78, headY: 1.12, bodyR: 1.0, bodyY: -0.12, bodyWide: 1.1, bodyTall: 0.9, neck: 0.2, eyeR: 0.11, bigEyes: false, legs: 1.1 };
    default: // perch / upright / cling / flit
      return { headR: 0.92, headY: 1.05, bodyR: 1.2, bodyY: -0.2, bodyWide: 1, bodyTall: 1.05, neck: 0, eyeR: 0.13, bigEyes: false, legs: 0.5 };
  }
}

const plush = (color: string, opts?: { rough?: number }) => (
  <meshStandardMaterial color={color} roughness={opts?.rough ?? 0.62} metalness={0} />
);

function markColor(species: BirdSpecies, kind: string): string | undefined {
  return species.art?.marks?.find((m) => m.m === kind)?.color;
}

function BirdModel({ species, sleeping, onPet }: { species: BirdSpecies; sleeping: boolean; onPet: () => void }) {
  const grp = useRef<THREE.Group>(null);
  const down = useRef({ x: 0, y: 0 });
  const p = species.palette;
  const art = species.art;
  const P = presetFor(art?.template);

  const hood = markColor(species, "hood");
  const headColor = hood ?? p.body;
  const cap = markColor(species, "cap");
  const mask = markColor(species, "mask");
  const throat = markColor(species, "throat") ?? markColor(species, "bib");
  const crest = art?.crest && art.crest !== "none" ? art.crest : null;
  const crestColor = crest === "horns" ? p.wing : p.cheek;

  // bill dimensions by kind
  const bill = art?.bill ?? "cone";
  const billDims: Record<string, [number, number]> = {
    cone: [0.17, 0.5], thin: [0.1, 0.6], stout: [0.2, 0.42], hook: [0.2, 0.46], chisel: [0.13, 0.62],
    dagger: [0.12, 0.95], decurved: [0.12, 0.62], long: [0.1, 1.15], huge: [0.46, 0.68], spatula: [0.42, 0.5],
  };
  const [billR, billH] = billDims[bill] ?? [0.17, 0.5];

  useFrame((state) => {
    if (grp.current) {
      const t = state.clock.elapsedTime;
      grp.current.position.y = sleeping ? -0.05 : Math.sin(t * 1.6) * 0.06;
    }
  });

  const eyeZ = P.headR * 0.82;
  const eyeX = P.headR * 0.42;
  const eyeY = P.headY + P.headR * 0.08;

  return (
    <group
      ref={grp}
      onPointerDown={(e) => (down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })}
      onClick={(e) => {
        const moved = Math.hypot(e.nativeEvent.clientX - down.current.x, e.nativeEvent.clientY - down.current.y);
        if (moved < 6) onPet();
      }}
    >
      {/* body */}
      <mesh position={[0, P.bodyY, 0]} scale={[P.bodyR * P.bodyWide, P.bodyR * P.bodyTall, P.bodyR]} castShadow>
        <sphereGeometry args={[1, 40, 32]} />
        {plush(p.body)}
      </mesh>
      {/* belly patch (front) */}
      <mesh position={[0, P.bodyY - P.bodyR * 0.1, P.bodyR * 0.52]} scale={[P.bodyR * 0.62, P.bodyR * 0.82, P.bodyR * 0.6]}>
        <sphereGeometry args={[1, 32, 24]} />
        {plush(p.belly)}
      </mesh>
      {/* wings */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * P.bodyR * P.bodyWide * 0.92, P.bodyY + 0.05, -0.05]} scale={[0.32, P.bodyR * 0.78, 0.55]} rotation={[0, 0, s * -0.15]}>
          <sphereGeometry args={[1, 24, 20]} />
          {plush(p.wing)}
        </mesh>
      ))}
      {/* neck */}
      {P.neck > 0 && (
        <mesh position={[0, P.bodyY + P.bodyR * P.bodyTall * 0.5 + P.neck * 0.4, 0.05]} scale={[0.34, P.neck, 0.34]}>
          <cylinderGeometry args={[1, 1.1, 1, 16]} />
          {plush(headColor)}
        </mesh>
      )}
      {/* head */}
      <mesh position={[0, P.headY, 0.06]} scale={P.headR}>
        <sphereGeometry args={[1, 40, 32]} />
        {plush(headColor)}
      </mesh>
      {/* cap */}
      {cap && (
        <mesh position={[0, P.headY + P.headR * 0.42, 0.02]} scale={[P.headR * 0.98, P.headR * 0.6, P.headR * 0.98]}>
          <sphereGeometry args={[1, 32, 24]} />
          {plush(cap)}
        </mesh>
      )}
      {/* mask band */}
      {mask && (
        <mesh position={[0, eyeY, P.headR * 0.6]} scale={[P.headR * 0.95, P.headR * 0.26, P.headR * 0.45]}>
          <sphereGeometry args={[1, 24, 16]} />
          {plush(mask)}
        </mesh>
      )}
      {/* throat / bib */}
      {throat && (
        <mesh position={[0, P.headY - P.headR * 0.7, P.headR * 0.7]} scale={[P.headR * 0.42, P.headR * 0.4, P.headR * 0.3]}>
          <sphereGeometry args={[1, 20, 16]} />
          {plush(throat)}
        </mesh>
      )}
      {/* eyes */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {sleeping ? (
            <mesh position={[s * eyeX, eyeY, eyeZ]} rotation={[0, 0, 0]} scale={[P.eyeR * 1.3, P.eyeR * 0.25, P.eyeR]}>
              <sphereGeometry args={[1, 12, 8]} />
              {plush("#241f1c", { rough: 0.8 })}
            </mesh>
          ) : (
            <>
              {P.bigEyes && (
                <mesh position={[s * eyeX, eyeY, eyeZ - 0.04]} scale={P.eyeR * 1.45}>
                  <sphereGeometry args={[1, 20, 16]} />
                  {plush("#fdf6e6", { rough: 0.5 })}
                </mesh>
              )}
              <mesh position={[s * eyeX, eyeY, eyeZ]} scale={P.eyeR}>
                <sphereGeometry args={[1, 20, 16]} />
                <meshStandardMaterial color="#241f1c" roughness={0.25} />
              </mesh>
              <mesh position={[s * eyeX - 0.04, eyeY + P.eyeR * 0.4, eyeZ + P.eyeR * 0.7]} scale={P.eyeR * 0.32}>
                <sphereGeometry args={[1, 10, 8]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            </>
          )}
        </group>
      ))}
      {/* bill */}
      <mesh position={[0, P.headY - P.headR * 0.12, P.headR * 0.86 + billH * 0.3]} rotation={[Math.PI / 2, 0, 0]} scale={bill === "spatula" ? [1, 1, 0.45] : [1, 1, 1]}>
        <coneGeometry args={[billR, billH, 18]} />
        {plush(p.beak, { rough: 0.45 })}
      </mesh>
      {/* crest */}
      {crest === "horns" ? (
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * P.headR * 0.5, P.headY + P.headR * 0.92, 0]} rotation={[0, 0, s * 0.3]} scale={[0.5, 0.9, 0.5]}>
            <coneGeometry args={[0.16, 0.5, 12]} />
            {plush(crestColor)}
          </mesh>
        ))
      ) : crest ? (
        <mesh position={[0, P.headY + P.headR * 0.95, -0.05]} rotation={[-0.35, 0, 0]} scale={[1, 1.2, 1]}>
          <coneGeometry args={[P.headR * 0.34, P.headR * 1.1, 14]} />
          {plush(crestColor)}
        </mesh>
      ) : null}
      {/* legs */}
      {P.legs > 0 &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.32, P.bodyY - P.bodyR * P.bodyTall * 0.7 - P.legs * 0.5, 0.1]} scale={[0.07, P.legs, 0.07]}>
            <cylinderGeometry args={[1, 1, 1, 8]} />
            {plush(p.beak)}
          </mesh>
        ))}
    </group>
  );
}

class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Bird3D({
  species,
  sleeping = false,
  night = false,
  onPet,
  fallback,
}: {
  species: BirdSpecies;
  sleeping?: boolean;
  night?: boolean;
  onPet: () => void;
  fallback: ReactNode;
}) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Canvas
        camera={{ position: [0, 0.4, 6.2], fov: 32 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%", touchAction: "none", cursor: "grab" }}
      >
        <hemisphereLight args={[night ? "#9fb0d8" : "#fff6e0", "#5a6b54", night ? 0.5 : 0.85]} />
        <directionalLight position={[4, 6, 5]} intensity={night ? 0.5 : 1.05} />
        <directionalLight position={[-4, 1, -3]} intensity={night ? 0.2 : 0.35} />
        <BirdModel species={species} sleeping={sleeping} onPet={onPet} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={!sleeping}
          autoRotateSpeed={1.1}
          target={[0, 0.35, 0]}
          minPolarAngle={Math.PI * 0.26}
          maxPolarAngle={Math.PI * 0.6}
        />
      </Canvas>
    </ErrorBoundary>
  );
}
