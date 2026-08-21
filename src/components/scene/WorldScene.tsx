"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky, Stars } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { useSimStore } from "@/store/simStore";
import Terrain from "./Terrain";
import Buildings from "./Buildings";
import Colonists from "./Colonists";
import Vegetation from "./Vegetation";

function SceneContents() {
  const version = useSimStore((s) => s.version);
  const sim = useSimStore((s) => s.sim);
  void version; // subscribing to version forces re-render on every tick batch

  // vegetation thins as the settlement footprint grows
  const density = useMemo(() => {
    const producers = sim.ecology.filter((e) => e.role === "producer");
    if (!producers.length) return 0.35;
    const avg = producers.reduce((a, b) => a + b.populationIndex, 0) / producers.length;
    return Math.max(0.15, avg / 80);
  }, [sim.ecology, sim.buildings.length]);

  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[80, 32, -60]}
        turbidity={7}
        rayleigh={2.8}
        mieCoefficient={0.02}
        mieDirectionalG={0.85}
      />
      <Stars radius={300} depth={60} count={1200} factor={3} saturation={0.4} fade />
      <ambientLight intensity={0.35} color="#cfd8e8" />
      <directionalLight
        position={[80, 60, -40]}
        intensity={1.6}
        color="#ffe8cc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />
      <hemisphereLight args={["#b8c8e0", "#5a4a3c", 0.4]} />
      <fog attach="fog" args={["#b9a98f", 120, 460]} />
      <Terrain seed={sim.seed} />
      <Vegetation seed={sim.seed} densityScale={density} />
      <Buildings buildings={sim.buildings} seed={sim.seed} />
      <Colonists colonists={sim.colonists} buildings={sim.buildings} seed={sim.seed} />
      <OrbitControls
        maxPolarAngle={Math.PI / 2.15}
        minDistance={8}
        maxDistance={260}
        target={[0, 2, 0]}
        enableDamping
      />
    </>
  );
}

export default function WorldScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [42, 28, 42], fov: 50 }}
      dpr={[1, 1.75]}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
    </Canvas>
  );
}
