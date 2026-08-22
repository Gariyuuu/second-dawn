/**
 * Multi-century validation sweep. Runs many seeds and policy configurations to
 * fixed horizons and emits one machine-readable record per run.
 *
 *   npx tsx scripts/sweep.ts --seeds 100 --years 200 --out reports/y200.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import { buildKnowledgeContext, ALL_SKILLS } from "../src/lib/sim/knowledge";
import type { ColonyPolicy, SimState } from "../src/lib/sim/types";

const POLICIES: { name: string; policy: Partial<ColonyPolicy> }[] = [
  { name: "balanced", policy: {} },
  { name: "strict-rations", policy: { rationing: "strict" } },
  { name: "generous-rations", policy: { rationing: "generous" } },
  { name: "restricted-births", policy: { birthPolicy: "restricted" } },
  { name: "encouraged-families", policy: { birthPolicy: "encouraged" } },
  { name: "aggressive-survey", policy: { expeditions: "aggressive" } },
  { name: "cautious-survey", policy: { expeditions: "cautious" } },
  { name: "labor-food", policy: { laborPriority: "food" } },
  { name: "labor-industry", policy: { laborPriority: "industry" } },
  { name: "labor-construction", policy: { laborPriority: "construction" } },
  { name: "labor-learning", policy: { laborPriority: "learning" } },
];

export interface RunRecord {
  seed: number;
  policy: string;
  years: number;
  extinct: boolean;
  extinctYear: number | null;
  finalPopulation: number;
  peakPopulation: number;
  births: number;
  deaths: number;
  settlementStage: string;
  buildings: number;
  oldestBuildingYear: number | null;
  survivingFoundingStructures: number;
  totalRenovations: number;
  tech: Record<string, number>;
  techRegressed: boolean;
  skillPools: Record<string, number>;
  tradesWithNoPractitioner: string[];
  traditionsActive: number;
  traditionsFaded: number;
  traditionNames: string[];
  museumTotal: number;
  museumOnDisplay: number;
  archiveIntegrity: number;
  earthBornAlive: number;
  maxGeneration: number;
  distinctSurnames: number;
  largestSurnameShare: number;
  ageDistribution: Record<string, number>;
  foodCrisisDays: number;
  powerCrisisDays: number;
  waterCrisisDays: number;
  housingShortfallDays: number;
  expeditionsLaunched: number;
  expeditionsLost: number;
  oreRemaining: number;
  arableSites: number;
  arableUsed: number;
  historyEvents: number;
  definingEvents: number;
  runtimeMs: number;
  heapMB: number;
}

export function runOne(seed: number, policyName: string, policy: Partial<ColonyPolicy>, years: number): RunRecord {
  const t0 = Date.now();
  const s = createInitialState(seed);
  s.policy = { ...s.policy, ...policy };
  const rand = new Rand(seed ^ 0x9e3779b9);
  simulateDays(s, Math.round(s.planet.yearLengthDays * years), rand);
  return summarize(s, seed, policyName, years, Date.now() - t0);
}

export function summarize(s: SimState, seed: number, policyName: string, years: number, runtimeMs: number): RunRecord {
  const yl = s.planet.yearLengthDays;
  const living = s.colonists;
  const ctx = buildKnowledgeContext(living);

  const buckets = { "0-14": 0, "15-29": 0, "30-49": 0, "50-64": 0, "65+": 0 };
  const surnames = new Map<string, number>();
  let maxGen = 0;
  for (const c of living) {
    if (c.ageYears < 15) buckets["0-14"]++;
    else if (c.ageYears < 30) buckets["15-29"]++;
    else if (c.ageYears < 50) buckets["30-49"]++;
    else if (c.ageYears < 65) buckets["50-64"]++;
    else buckets["65+"]++;
    const sn = c.name.split(" ").slice(-1)[0];
    surnames.set(sn, (surnames.get(sn) ?? 0) + 1);
    maxGen = Math.max(maxGen, c.generation);
  }
  const topSurname = [...surnames.values()].sort((a, b) => b - a)[0] ?? 0;

  const skillPools: Record<string, number> = {};
  const missing: string[] = [];
  for (const sk of ALL_SKILLS) {
    skillPools[sk] = Math.round(ctx.pools[sk] ?? 0);
    if ((ctx.practitioners[sk] ?? 0) === 0) missing.push(sk);
  }

  const founding = s.buildings.filter((b) => b.builtDay <= yl * 5);
  const oldest = s.buildings.length ? Math.min(...s.buildings.map((b) => b.builtDay)) : null;
  const initialTech = { manufacturing: 70, medicine: 75, agriculture: 60, energy: 72, construction: 68 };
  const techRegressed = (Object.keys(initialTech) as (keyof typeof initialTech)[]).some(
    (k) => s.tech[k] < initialTech[k] - 10
  );

  return {
    seed,
    policy: policyName,
    years,
    extinct: living.length === 0,
    extinctYear: s.extinctDay !== undefined ? Math.round(s.extinctDay / yl) : null,
    finalPopulation: living.length,
    peakPopulation: s.stats.peakPopulation,
    births: s.stats.births,
    deaths: s.stats.deaths,
    settlementStage: s.settlementStage,
    buildings: s.buildings.length,
    oldestBuildingYear: oldest !== null ? Math.round(oldest / yl) : null,
    survivingFoundingStructures: founding.length,
    totalRenovations: s.buildings.reduce((a, b) => a + b.renovations, 0),
    tech: Object.fromEntries(Object.entries(s.tech).map(([k, v]) => [k, Math.round(v)])),
    techRegressed,
    skillPools,
    tradesWithNoPractitioner: missing,
    traditionsActive: s.traditions.filter((t) => t.status === "active").length,
    traditionsFaded: s.traditions.filter((t) => t.status === "faded").length,
    traditionNames: s.traditions.map((t) => t.name),
    museumTotal: s.museum.length,
    museumOnDisplay: s.museum.filter((m) => !m.archived).length,
    archiveIntegrity: Math.round(Math.max(0, ...s.archives.map((a) => a.integrity))),
    earthBornAlive: living.filter((c) => c.bornOnEarth).length,
    maxGeneration: maxGen,
    distinctSurnames: surnames.size,
    largestSurnameShare: living.length ? Number((topSurname / living.length).toFixed(3)) : 0,
    ageDistribution: buckets,
    foodCrisisDays: s.stats.foodCrisisDays,
    powerCrisisDays: s.stats.powerCrisisDays,
    waterCrisisDays: s.stats.waterCrisisDays,
    housingShortfallDays: s.stats.housingShortfallDays,
    expeditionsLaunched: s.stats.expeditionsLaunched,
    expeditionsLost: s.stats.expeditionsLost,
    oreRemaining: Math.round(s.resourceBase.oreRemaining),
    arableSites: s.resourceBase.arableSites,
    arableUsed: s.resourceBase.arableUsed,
    historyEvents: s.history.length,
    definingEvents: s.history.filter((h) => h.significance === 3).length,
    runtimeMs,
    heapMB: Math.round(process.memoryUsage().heapUsed / 1048576),
  };
}

function arg(name: string, dflt: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

if (process.argv[1]?.includes("sweep")) {
  const seedCount = Number(arg("seeds", "100"));
  const years = Number(arg("years", "200"));
  const out = arg("out", `reports/sweep-y${years}.json`);
  const shard = Number(arg("shard", "0"));
  const shards = Number(arg("shards", "1"));

  const records: RunRecord[] = [];
  let n = 0;
  for (let i = 0; i < seedCount; i++) {
    const seed = 1000 + i * 7919;
    const policy = POLICIES[i % POLICIES.length];
    if (n++ % shards !== shard) continue;
    records.push(runOne(seed, policy.name, policy.policy, years));
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(records, null, 1));
  console.log(`wrote ${records.length} records to ${out}`);
}
