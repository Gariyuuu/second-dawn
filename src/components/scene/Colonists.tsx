"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Colonist, Building } from "@/lib/sim/types";
import { terrainHeight } from "./Terrain";
import { mulberry32 } from "@/lib/sim/rng";
import { useSimStore } from "@/store/simStore";

// Instanced low-poly figures wandering between buildings. Rendering all colonists
// individually with full character models is a later upgrade; this keeps 1000+ people cheap.
const MAX_RENDERED = 220;

const dummy = new THREE.Object3D();
const colorScratch = new THREE.Color();

export default function Colonists({
  colonists,
  buildings,
  seed,
}: {
  colonists: Colonist[];
  buildings: Building[];
  seed: number;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const selectColonist = useSimStore((s) => s.selectColonist);

  const living = useMemo(() => colonists.filter((c) => c.alive).slice(0, MAX_RENDERED), [colonists]);

  // per-colonist wander parameters, stable across frames
  const wander = useMemo(() => {
    return living.map((c, i) => {
      const rng = mulberry32(seed + i * 7919);
      const home = buildings.length ? buildings[i % buildings.length] : { x: 0, z: 0 };
      return {
        cx: home.x + (rng() - 0.5) * 10,
        cz: home.z + (rng() - 0.5) * 10,
        radius: 2 + rng() * 6,
        speed: 0.1 + rng() * 0.25,
        phase: rng() * Math.PI * 2,
        suit: rng() < 0.7,
      };
    });
  }, [living, buildings.length, seed]);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const head = headRef.current;
    if (!body || !head) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < living.length; i++) {
      const w = wander[i];
      const a = w.phase + t * w.speed;
      const x = w.cx + Math.cos(a) * w.radius;
      const z = w.cz + Math.sin(a * 0.7) * w.radius;
      const y = terrainHeight(x, z, seed);
      const bob = Math.abs(Math.sin(t * 4 + w.phase)) * 0.03;
      dummy.position.set(x, y + 0.55 + bob, z);
      dummy.rotation.set(0, -a + Math.PI / 2, 0);
      const child = living[i].ageYears < 14;
      const s = child ? 0.6 : 1;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      // suit color: EVA orange for suited, muted civilian tones otherwise
      colorScratch.set(w.suit ? "#c97b3f" : ["#6b7a8a", "#7a6b5a", "#5a6b5a", "#8a7a6b"][i % 4]);
      body.setColorAt(i, colorScratch);
      dummy.position.y = y + 1.18 * s + bob;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      head.setMatrixAt(i, dummy.matrix);
      colorScratch.set(living[i].appearance.skinTone);
      head.setColorAt(i, colorScratch);
    }
    body.count = living.length;
    head.count = living.length;
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    if (head.instanceColor) head.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, MAX_RENDERED]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && living[e.instanceId]) {
            selectColonist(living[e.instanceId].id);
          }
        }}
      >
        <capsuleGeometry args={[0.22, 0.7, 4, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, MAX_RENDERED]} castShadow>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
