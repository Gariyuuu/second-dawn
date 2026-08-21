// SUCCESS TEST: two identical colonies; in one the lead engineer dies in Year 2.
// Simulate 100 years each and compare outcomes.
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import type { SimState } from "../src/lib/sim/types";

const SEED = 42424242;
const YEARS = 100;

function summarize(label: string, s: SimState) {
  const living = s.colonists.filter((c) => c.alive);
  const engSkill = living.reduce((a, c) => a + (c.skills.engineering ?? 0), 0);
  console.log(`\n=== ${label} ===`);
  console.log(`Population: ${living.length} (born offworld total: ${s.generationsBornOffworld})`);
  console.log(`Settlement stage: ${s.settlementStage} | buildings: ${s.buildings.length}`);
  console.log(`Government: ${s.government.systemName} (established: ${s.government.established})`);
  console.log(`Tech: mfg ${s.tech.manufacturing.toFixed(1)} med ${s.tech.medicine.toFixed(1)} agr ${s.tech.agriculture.toFixed(1)} nrg ${s.tech.energy.toFixed(1)} con ${s.tech.construction.toFixed(1)}`);
  console.log(`Living engineering skill pool: ${engSkill}`);
  console.log(`Resources: food ${Math.floor(s.resources.food)} energy ${Math.floor(s.resources.energy)} materials ${Math.floor(s.resources.materials)} components ${Math.floor(s.resources.components)}`);
  console.log(`Museum artifacts: ${s.museum.length} | holidays: ${s.holidays.map((h) => h.name).join(", ") || "none"}`);
  console.log(`History events: ${s.history.length}; crises: ${s.history.filter((h) => h.category === "crisis").length}`);
  console.log(`Last 5 events:`);
  for (const h of s.history.slice(-5)) console.log(`  [d${h.day}] ${h.title}`);
}

function run(killEngineer: boolean): SimState {
  const s = createInitialState(SEED);
  const rand = new Rand(SEED ^ 0x9e3779b9);
  const yearLen = s.planet.yearLengthDays;

  // simulate year 1
  simulateDays(s, yearLen, rand);

  if (killEngineer) {
    const engineers = s.colonists
      .filter((c) => c.alive && (c.skills.engineering ?? 0) > 0)
      .sort((a, b) => (b.skills.engineering ?? 0) - (a.skills.engineering ?? 0));
    const lead = engineers[0];
    lead.alive = false;
    lead.deathDay = s.day;
    lead.deathCause = "decompression accident (experiment)";
    console.log(`\n[experiment] Killed lead engineer: ${lead.name}, engineering ${lead.skills.engineering}`);
    console.log(`[experiment] Remaining engineers with skill>40: ${engineers.slice(1).filter((e) => (e.skills.engineering ?? 0) > 40).length}`);
  }

  simulateDays(s, yearLen * (YEARS - 1), rand);
  return s;
}

console.log(`Seed ${SEED}, simulating ${YEARS} years per colony...`);
console.time("colony A (engineer lives)");
const a = run(false);
console.timeEnd("colony A (engineer lives)");
console.time("colony B (engineer dies year 2)");
const b = run(true);
console.timeEnd("colony B (engineer dies year 2)");

summarize("COLONY A — engineer survives", a);
summarize("COLONY B — engineer dies in Year 2", b);

const popA = a.colonists.filter((c) => c.alive).length;
const popB = b.colonists.filter((c) => c.alive).length;
console.log(`\n=== DIVERGENCE ===`);
console.log(`Population delta: ${popA - popB}`);
console.log(`Building delta: ${a.buildings.length - b.buildings.length}`);
console.log(`Energy-tech delta: ${(a.tech.energy - b.tech.energy).toFixed(2)}`);
console.log(`Crisis-event delta: ${a.history.filter((h) => h.category === "crisis").length - b.history.filter((h) => h.category === "crisis").length}`);
