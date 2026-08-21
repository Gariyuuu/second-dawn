"use client";
import { create } from "zustand";
import { Rand } from "@/lib/sim/rng";
import { createInitialState, tick, simulateDays } from "@/lib/sim/engine";
import type { ColonyPolicy, SimState } from "@/lib/sim/types";

export type TimeSpeed = 0 | 1 | 10 | 100;
export type PlayerMode = "observer" | "director" | "colonist" | "god";

interface SimStore {
  sim: SimState;
  rand: Rand;
  speed: TimeSpeed;
  mode: PlayerMode;
  selectedColonistId: string | null;
  selectedBuildingId: string | null;
  followColonistId: string | null; // for individual-colonist mode
  version: number; // bumped each tick so React re-renders without deep-cloning sim
  setSpeed: (s: TimeSpeed) => void;
  setMode: (m: PlayerMode) => void;
  selectColonist: (id: string | null) => void;
  selectBuilding: (id: string | null) => void;
  setPolicy: <K extends keyof ColonyPolicy>(key: K, value: ColonyPolicy[K]) => void;
  stepDays: (days: number) => void;
  skipYears: (years: number) => void;
  reset: (seed?: number) => void;
  // god mode
  killColonist: (id: string) => void;
  grantResources: () => void;
}

const INITIAL_SEED = 20260821;

export const useSimStore = create<SimStore>((set, get) => ({
  sim: createInitialState(INITIAL_SEED),
  rand: new Rand(INITIAL_SEED ^ 0x9e3779b9),
  speed: 0,
  mode: "observer",
  selectedColonistId: null,
  selectedBuildingId: null,
  followColonistId: null,
  version: 0,

  setSpeed: (speed) => set({ speed }),
  setMode: (mode) => set({ mode }),
  selectColonist: (id) => set({ selectedColonistId: id, selectedBuildingId: null }),
  selectBuilding: (id) => set({ selectedBuildingId: id, selectedColonistId: null }),

  setPolicy: (key, value) => {
    const { sim } = get();
    sim.policy = { ...sim.policy, [key]: value };
    set((st) => ({ version: st.version + 1 }));
  },

  stepDays: (days) => {
    const { sim, rand } = get();
    simulateDays(sim, days, rand);
    set((st) => ({ version: st.version + 1 }));
  },

  skipYears: (years) => {
    const { sim, rand } = get();
    const days = Math.round(years * sim.planet.yearLengthDays);
    simulateDays(sim, days, rand);
    set((st) => ({ version: st.version + 1, speed: 0 }));
  },

  reset: (seed = Date.now() % 100000000) => {
    set({
      sim: createInitialState(seed),
      rand: new Rand(seed ^ 0x9e3779b9),
      speed: 0,
      version: 0,
      selectedColonistId: null,
      selectedBuildingId: null,
      followColonistId: null,
    });
  },

  killColonist: (id) => {
    const { sim } = get();
    const c = sim.colonists.find((x) => x.id === id);
    if (c?.alive) {
      c.alive = false;
      c.deathDay = sim.day;
      c.deathCause = "intervention (god mode)";
      sim.history.push({
        id: `evt-god-${sim.day}-${id}`,
        day: sim.day,
        title: `Death of ${c.name}`,
        description: `${c.name} died suddenly. (Experimenter intervention.)`,
        category: "death",
        colonistIds: [id],
      });
      set((st) => ({ version: st.version + 1 }));
    }
  },

  grantResources: () => {
    const { sim } = get();
    sim.resources.food += 5000;
    sim.resources.materials += 500;
    sim.resources.components += 300;
    sim.resources.medicine += 200;
    set((st) => ({ version: st.version + 1 }));
  },
}));

// The real-time loop: at speed 1 → 1 day/sec, 10 → 10 days/sec, 100 → 100 days/sec (batched).
let loopStarted = false;
export function startSimLoop() {
  if (loopStarted || typeof window === "undefined") return;
  loopStarted = true;
  let acc = 0;
  let last = performance.now();
  function frame(now: number) {
    const { speed, sim, rand } = useSimStore.getState();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (speed > 0 && sim.colonists.some((c) => c.alive)) {
      acc += dt * speed;
      const days = Math.floor(acc);
      if (days > 0) {
        acc -= days;
        simulateDays(sim, Math.min(days, 120), rand);
        useSimStore.setState((st) => ({ version: st.version + 1 }));
      }
    } else {
      acc = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
