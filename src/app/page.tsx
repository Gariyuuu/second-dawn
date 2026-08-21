"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import Hud from "@/components/ui/Hud";
import { startSimLoop } from "@/store/simStore";

const WorldScene = dynamic(() => import("@/components/scene/WorldScene"), { ssr: false });

export default function Home() {
  useEffect(() => {
    startSimLoop();
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <WorldScene />
      <Hud />
    </main>
  );
}
