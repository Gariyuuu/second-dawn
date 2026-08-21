"use client";
import { useMemo } from "react";
import * as THREE from "three";
import type { Building } from "@/lib/sim/types";
import { terrainHeight } from "./Terrain";
import { useSimStore } from "@/store/simStore";

const PANEL = new THREE.Color("#b8bcc2");
const HULL = new THREE.Color("#8e939b");
const ACCENT = new THREE.Color("#c97b3f");
const GLASS = new THREE.Color("#7fa8b8");
const CONCRETE = new THREE.Color("#a49a8c");

function BuildingMesh({ b, seed }: { b: Building; seed: number }) {
  const y = terrainHeight(b.x, b.z, seed);
  const worn = b.condition < 40;
  const tint = worn ? 0.6 : 1;
  switch (b.type) {
    case "habitat_module":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <capsuleGeometry args={[1.6, 3.2, 8, 16]} />
            <meshStandardMaterial color={HULL.clone().multiplyScalar(tint)} roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[1.62, 3.1, 4, 16]} />
            <meshStandardMaterial color={PANEL.clone().multiplyScalar(tint)} roughness={0.6} metalness={0.4} transparent opacity={0.35} />
          </mesh>
        </group>
      );
    case "power_station":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[1.4, 1.8, 2, 12]} />
            <meshStandardMaterial color={HULL.clone().multiplyScalar(tint)} roughness={0.4} metalness={0.7} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 3, 0.1, Math.sin((i * Math.PI) / 2) * 3]} rotation={[-Math.PI / 2.6, (i * Math.PI) / 2, 0]} castShadow>
              <boxGeometry args={[2.4, 1.4, 0.06]} />
              <meshStandardMaterial color={"#26364a"} roughness={0.25} metalness={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "water_reclaimer":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 3, 14]} />
            <meshStandardMaterial color={GLASS.clone().multiplyScalar(tint)} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[1.4, 0.5, 0]} castShadow>
            <boxGeometry args={[1.2, 1, 1.2]} />
            <meshStandardMaterial color={HULL.clone().multiplyScalar(tint)} roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      );
    case "farm_dome":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={"#9fd8a8"} roughness={0.15} metalness={0.1} transparent opacity={0.45} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[3, 3, 0.3, 20]} />
            <meshStandardMaterial color={"#3d5238"} roughness={0.9} />
          </mesh>
        </group>
      );
    case "workshop":
    case "refinery":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[4.2, 2.8, 3]} />
            <meshStandardMaterial color={HULL.clone().multiplyScalar(tint)} roughness={0.55} metalness={0.55} />
          </mesh>
          <mesh position={[1.4, 3.4, 0.8]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 2, 8]} />
            <meshStandardMaterial color={ACCENT} roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      );
    case "medbay":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[3.4, 2.2, 2.8]} />
            <meshStandardMaterial color={"#d8dde2"} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.3, 1.41]}>
            <boxGeometry args={[0.8, 0.22, 0.03]} />
            <meshStandardMaterial color={"#c0392b"} />
          </mesh>
          <mesh position={[0, 2.3, 1.41]}>
            <boxGeometry args={[0.22, 0.8, 0.03]} />
            <meshStandardMaterial color={"#c0392b"} />
          </mesh>
        </group>
      );
    case "storage_depot":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[3.6, 2, 5]} />
            <meshStandardMaterial color={ACCENT.clone().multiplyScalar(tint)} roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      );
    case "mine":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.8, 0]} rotation={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.4, 3.6, 0.4]} />
            <meshStandardMaterial color={"#5c5148"} roughness={0.8} />
          </mesh>
          <mesh position={[0.9, 1.8, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[0.3, 3.2, 0.3]} />
            <meshStandardMaterial color={"#5c5148"} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <coneGeometry args={[2.2, 0.9, 10]} />
            <meshStandardMaterial color={"#4a4038"} roughness={1} />
          </mesh>
        </group>
      );
    case "school":
    case "hall_of_governance":
    case "market":
    case "museum":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[5, 3.2, 4]} />
            <meshStandardMaterial color={CONCRETE.clone().multiplyScalar(tint)} roughness={0.8} metalness={0.05} />
          </mesh>
          <mesh position={[0, 3.6, 0]} castShadow>
            <boxGeometry args={[5.6, 0.4, 4.6]} />
            <meshStandardMaterial color={"#6a6258"} roughness={0.8} />
          </mesh>
          {b.type === "hall_of_governance" && (
            <mesh position={[0, 4.6, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, 1.8, 6]} />
              <meshStandardMaterial color={"#888"} metalness={0.7} />
            </mesh>
          )}
        </group>
      );
    case "house":
      return (
        <group position={[b.x, y, b.z]}>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[2.8, 2, 2.8]} />
            <meshStandardMaterial color={CONCRETE.clone().multiplyScalar(tint)} roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <coneGeometry args={[2.3, 1, 4]} />
            <meshStandardMaterial color={"#7a5c44"} roughness={0.9} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export default function Buildings({ buildings, seed }: { buildings: Building[]; seed: number }) {
  const list = useMemo(() => buildings, [buildings.length, seed]); // re-render when count changes
  const selectBuilding = useSimStore((s) => s.selectBuilding);
  return (
    <group>
      {list.map((b) => (
        <group
          key={b.id}
          onClick={(e) => {
            e.stopPropagation();
            selectBuilding(b.id);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "auto")}
        >
          <BuildingMesh b={b} seed={seed} />
        </group>
      ))}
    </group>
  );
}
