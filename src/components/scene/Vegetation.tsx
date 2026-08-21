"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/sim/rng";
import { terrainHeight } from "./Terrain";

// Alien flora: instanced spiral ferns + glass-cap growths scattered by seed.
export default function Vegetation({ seed, densityScale = 1 }: { seed: number; densityScale?: number }) {
  const { fernMatrices, capMatrices } = useMemo(() => {
    const rng = mulberry32(seed + 31);
    const ferns: THREE.Matrix4[] = [];
    const caps: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const count = Math.floor(700 * densityScale);
    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * 520;
      const z = (rng() - 0.5) * 520;
      const dist = Math.hypot(x, z);
      if (dist < 45) continue; // cleared around settlement
      const y = terrainHeight(x, z, seed);
      if (y < -6 || y > 14) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      const s = 0.5 + rng() * 1.6;
      dummy.scale.set(s, s + rng() * 0.8, s);
      dummy.updateMatrix();
      if (rng() < 0.7) ferns.push(dummy.matrix.clone());
      else caps.push(dummy.matrix.clone());
    }
    return { fernMatrices: ferns, capMatrices: caps };
  }, [seed, densityScale]);

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, fernMatrices.length]}
        ref={(m) => {
          if (m) {
            fernMatrices.forEach((mat, i) => m.setMatrixAt(i, mat));
            m.instanceMatrix.needsUpdate = true;
          }
        }}
      >
        <coneGeometry args={[0.5, 2.4, 5]} />
        <meshStandardMaterial color="#4a6b52" roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, capMatrices.length]}
        ref={(m) => {
          if (m) {
            capMatrices.forEach((mat, i) => m.setMatrixAt(i, mat));
            m.instanceMatrix.needsUpdate = true;
          }
        }}
      >
        <sphereGeometry args={[0.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7fb8a8" roughness={0.3} transparent opacity={0.75} />
      </instancedMesh>
    </group>
  );
}
