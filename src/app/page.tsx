"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import Hud from "@/components/ui/Hud";
import { BootScreen } from "@/components/ui/BootScreen";
import { startSimLoop } from "@/store/simStore";

// The chunk wait had no fallback at all: the page was a black rectangle until
// the scene arrived, with nothing to distinguish a slow load from a broken one.
const WorldScene = dynamic(() => import("@/components/scene/WorldScene"), {
  ssr: false,
  loading: () => <BootScreen stage="chunk" />,
});

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
