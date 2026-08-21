"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "@/lib/sim/rng";

// Simple value-noise heightfield so the terrain is deterministic per planet seed.
function noise2D(seed: number) {
  const rng = mulberry32(seed);
  const grid: number[] = [];
  const SIZE = 64;
  for (let i = 0; i < SIZE * SIZE; i++) grid.push(rng());
  return (x: number, y: number) => {
    const gx = ((x % SIZE) + SIZE) % SIZE;
    const gy = ((y % SIZE) + SIZE) % SIZE;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = (x0 + 1) % SIZE, y1 = (y0 + 1) % SIZE;
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const v00 = grid[y0 * SIZE + x0], v10 = grid[y0 * SIZE + x1];
    const v01 = grid[y1 * SIZE + x0], v11 = grid[y1 * SIZE + x1];
    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
  };
}

export function terrainHeight(x: number, z: number, seed: number): number {
  const n1 = noiseCache(seed);
  const flatten = Math.max(0, 1 - Math.hypot(x, z) / 55); // settlement plateau stays buildable
  const h =
    n1(x * 0.02 + 10, z * 0.02 + 10) * 22 +
    n1(x * 0.06 + 40, z * 0.06 + 40) * 6 +
    n1(x * 0.18 + 80, z * 0.18 + 80) * 1.5;
  return (h - 12) * (1 - flatten * 0.92);
}

const cache = new Map<number, (x: number, y: number) => number>();
function noiseCache(seed: number) {
  if (!cache.has(seed)) cache.set(seed, noise2D(seed));
  return cache.get(seed)!;
}

export default function Terrain({ seed }: { seed: number }) {
  const geometry = useMemo(() => {
    const size = 600;
    const segments = 196;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color("#5a4a3c");
    const mid = new THREE.Color("#7a6a52");
    const high = new THREE.Color("#9a8c74");
    const veg = new THREE.Color("#4a5d45");
    const rng = mulberry32(seed + 7);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z, seed);
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 12) / 24, 0, 1);
      const c = new THREE.Color();
      if (t < 0.45) c.lerpColors(low, mid, t / 0.45);
      else c.lerpColors(mid, high, (t - 0.45) / 0.55);
      // patches of alien vegetation on mid-slopes
      if (t > 0.3 && t < 0.7 && rng() < 0.25) c.lerp(veg, 0.55);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [seed]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
    </mesh>
  );
}
