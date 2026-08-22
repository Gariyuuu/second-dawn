/** Statistical sanity report over a sweep, flagging suspicious convergence. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { RunRecord } from "./sweep";

const prefix = process.argv[2] ?? "y200";
const files = readdirSync("reports").filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
const runs: RunRecord[] = files.flatMap((f) => JSON.parse(readFileSync(`reports/${f}`, "utf8")));
runs.sort((a, b) => a.seed - b.seed);
writeFileSync(`reports/${prefix}-all.json`, JSON.stringify(runs, null, 1));

const n = runs.length;
const pct = (x: number) => `${((x / n) * 100).toFixed(0)}%`;
const num = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const med = (xs: number[]) => { const s = num(xs); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`\n${"=".repeat(78)}`);
console.log(`SWEEP: ${prefix}  ·  ${n} runs  ·  ${runs[0]?.years} simulated years each`);
console.log("=".repeat(78));

const extinct = runs.filter((r) => r.extinct);
const survived = runs.filter((r) => !r.extinct);
console.log(`\nOUTCOME`);
console.log(`  extinct           ${extinct.length}/${n} (${pct(extinct.length)})`);
console.log(`  survived          ${survived.length}/${n} (${pct(survived.length)})`);
if (extinct.length) {
  const yrs = num(extinct.map((r) => r.extinctYear ?? 0));
  console.log(`  extinction years  min ${yrs[0]} · median ${med(yrs)} · max ${yrs[yrs.length - 1]}`);
}

if (survived.length) {
  const pops = num(survived.map((r) => r.finalPopulation));
  const peaks = num(survived.map((r) => r.peakPopulation));
  console.log(`\nPOPULATION (survivors)`);
  console.log(`  final    min ${pops[0]} · p25 ${pops[Math.floor(pops.length * .25)]} · median ${med(pops)} · p75 ${pops[Math.floor(pops.length * .75)]} · max ${pops[pops.length - 1]}`);
  console.log(`  peak     min ${peaks[0]} · median ${med(peaks)} · max ${peaks[peaks.length - 1]}`);
  const declined = survived.filter((r) => r.finalPopulation < r.peakPopulation * 0.75).length;
  console.log(`  ${declined}/${survived.length} ended well below their own peak (a real decline happened)`);

  console.log(`\nSETTLEMENT TIER`);
  const stages = new Map<string, number>();
  for (const r of survived) stages.set(r.settlementStage, (stages.get(r.settlementStage) ?? 0) + 1);
  for (const [k, v] of [...stages.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(24)} ${v} (${((v / survived.length) * 100).toFixed(0)}%)`);
  }

  console.log(`\nDEMOGRAPHY (survivors, mean share)`);
  const keys = ["0-14", "15-29", "30-49", "50-64", "65+"];
  for (const k of keys) {
    const shares = survived.map((r) => {
      const tot = Object.values(r.ageDistribution).reduce((a, b) => a + b, 0);
      return tot ? (r.ageDistribution as Record<string, number>)[k] / tot : 0;
    });
    console.log(`  ${k.padEnd(8)} ${(mean(shares) * 100).toFixed(1)}%`);
  }
  const noKids = survived.filter((r) => r.ageDistribution["0-14"] === 0).length;
  const allOld = survived.filter((r) => {
    const tot = Object.values(r.ageDistribution).reduce((a, b) => a + b, 0);
    return tot > 0 && r.ageDistribution["65+"] / tot > 0.4;
  }).length;
  console.log(`  colonies with no children: ${noKids} · colonies >40% elderly: ${allOld}`);

  console.log(`\nGENERATIONS & LINEAGE`);
  console.log(`  max generation depth   median ${med(survived.map((r) => r.maxGeneration))} · max ${Math.max(...survived.map((r) => r.maxGeneration))}`);
  console.log(`  Earth-born still alive median ${med(survived.map((r) => r.earthBornAlive))}`);
  console.log(`  distinct surnames      median ${med(survived.map((r) => r.distinctSurnames))} · min ${Math.min(...survived.map((r) => r.distinctSurnames))}`);
  const shares = survived.map((r) => r.largestSurnameShare);
  console.log(`  largest surname share  median ${med(shares).toFixed(2)} · max ${Math.max(...shares).toFixed(2)}`);
  console.log(`  runs where one surname exceeds 50% of the colony: ${survived.filter((r) => r.largestSurnameShare > 0.5).length}`);

  console.log(`\nTECHNOLOGY`);
  const fields = ["manufacturing", "medicine", "agriculture", "energy", "construction"];
  for (const f of fields) {
    const vs = num(survived.map((r) => r.tech[f]));
    console.log(`  ${f.padEnd(14)} min ${vs[0]} · median ${med(vs)} · max ${vs[vs.length - 1]}`);
  }
  console.log(`  runs with a real regression (any field >10 below start): ${survived.filter((r) => r.techRegressed).length}/${survived.length}`);
  console.log(`  runs where every field maxed at 100: ${survived.filter((r) => fields.every((f) => r.tech[f] >= 100)).length}/${survived.length}`);

  console.log(`\nSKILL TRANSMISSION`);
  const lostTrades = survived.map((r) => r.tradesWithNoPractitioner.length);
  console.log(`  trades with zero practitioners  median ${med(lostTrades)} · max ${Math.max(...lostTrades)}`);
  const lostCount = new Map<string, number>();
  for (const r of survived) for (const t of r.tradesWithNoPractitioner) lostCount.set(t, (lostCount.get(t) ?? 0) + 1);
  const lostTop = [...lostCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (lostTop.length) console.log(`  most often lost: ${lostTop.map(([k, v]) => `${k} (${v})`).join(", ")}`);
  console.log(`  runs where every trade survives: ${survived.filter((r) => r.tradesWithNoPractitioner.length === 0).length}/${survived.length}`);

  console.log(`\nCULTURE`);
  const act = num(survived.map((r) => r.traditionsActive));
  console.log(`  ever created        median ${med(survived.map((r) => r.traditionsEverCreated))} · max ${Math.max(...survived.map((r) => r.traditionsEverCreated))}`);
  console.log(`  active              min ${act[0]} · median ${med(act)} · max ${act[act.length - 1]}`);
  console.log(`  declining           median ${med(survived.map((r) => r.traditionsDeclining))}`);
  console.log(`  rare                median ${med(survived.map((r) => r.traditionsRare))}`);
  console.log(`  dormant (forgotten) median ${med(survived.map((r) => r.traditionsFaded))} · max ${Math.max(...survived.map((r) => r.traditionsFaded))}`);
  const anyFade = survived.filter((r) => r.traditionsFaded + r.traditionsRare > 0).length;
  const anyRevive = survived.filter((r) => r.traditionsRevived > 0).length;
  const anyMutate = survived.filter((r) => r.traditionsMutated > 0).length;
  const allActive = survived.filter((r) => r.traditionsActive === r.traditionsEverCreated).length;
  console.log(`  colonies where something faded to rare or dormant: ${anyFade}/${survived.length} (${pct(anyFade)})`);
  console.log(`  colonies with a revival: ${anyRevive}/${survived.length} · with a mutated tradition: ${anyMutate}/${survived.length}`);
  console.log(`  colonies where every tradition survived unchanged and active: ${allActive}/${survived.length}`);
  const tradCount = new Map<string, number>();
  for (const r of survived) for (const t of r.traditionNames) tradCount.set(t, (tradCount.get(t) ?? 0) + 1);
  console.log(`  distinct tradition names across all runs: ${tradCount.size}`);
  console.log(`  most common: ${[...tradCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
  const identical = survived.filter((r) => r.traditionNames.length === survived[0].traditionNames.length &&
    r.traditionNames.every((t, i) => t === survived[0].traditionNames[i])).length;
  console.log(`  runs with an identical tradition list to run #1: ${identical}/${survived.length}`);

  console.log(`\nMUSEUM & ARCHIVE`);
  console.log(`  artifacts total   median ${med(survived.map((r) => r.museumTotal))} · max ${Math.max(...survived.map((r) => r.museumTotal))}`);
  console.log(`  on display        median ${med(survived.map((r) => r.museumOnDisplay))} · max ${Math.max(...survived.map((r) => r.museumOnDisplay))}`);
  console.log(`  archive integrity median ${med(survived.map((r) => r.archiveIntegrity))} · min ${Math.min(...survived.map((r) => r.archiveIntegrity))}`);
  const deathsVsArtifacts = survived.map((r) => r.museumTotal / Math.max(1, r.deaths));
  console.log(`  artifacts per death: mean ${mean(deathsVsArtifacts).toFixed(3)} (should be small — significance, not mortality)`);

  console.log(`\nBUILDINGS`);
  console.log(`  count            median ${med(survived.map((r) => r.buildings))} · max ${Math.max(...survived.map((r) => r.buildings))}`);
  console.log(`  founding-era structures still standing: median ${med(survived.map((r) => r.survivingFoundingStructures))}`);
  console.log(`  full rebuilds    median ${med(survived.map((r) => r.totalRenovations))} · max ${Math.max(...survived.map((r) => r.totalRenovations))}`);

  console.log(`\nRESOURCE EQUILIBRIUM`);
  console.log(`  ore remaining     median ${med(survived.map((r) => r.oreRemaining))}`);
  console.log(`  arable used/known median ${med(survived.map((r) => r.arableUsed))}/${med(survived.map((r) => r.arableSites))}`);
  console.log(`  food-crisis days  median ${med(survived.map((r) => r.foodCrisisDays))} · max ${Math.max(...survived.map((r) => r.foodCrisisDays))}`);
  console.log(`  power-crisis days median ${med(survived.map((r) => r.powerCrisisDays))}`);
  console.log(`  housing-short days median ${med(survived.map((r) => r.housingShortfallDays))}`);
  console.log(`  runs with zero crises of any kind: ${survived.filter((r) => r.foodCrisisDays + r.powerCrisisDays + r.waterCrisisDays === 0).length}/${survived.length}`);
}

console.log(`\nBY POLICY`);
const byPolicy = new Map<string, RunRecord[]>();
for (const r of runs) { if (!byPolicy.has(r.policy)) byPolicy.set(r.policy, []); byPolicy.get(r.policy)!.push(r); }
console.log(`  ${"policy".padEnd(22)} runs  extinct  medPop  medPeak  medTrad  medCrisisDays`);
for (const [p, rs] of [...byPolicy.entries()].sort()) {
  const surv = rs.filter((r) => !r.extinct);
  console.log(
    `  ${p.padEnd(22)} ${String(rs.length).padStart(4)}  ${String(rs.length - surv.length).padStart(7)}  ` +
    `${String(med(surv.map((r) => r.finalPopulation))).padStart(6)}  ${String(med(surv.map((r) => r.peakPopulation))).padStart(7)}  ` +
    `${String(med(surv.map((r) => r.traditionsActive))).padStart(7)}  ${String(med(surv.map((r) => r.foodCrisisDays + r.powerCrisisDays + r.waterCrisisDays))).padStart(13)}`
  );
}

console.log(`\nPERFORMANCE`);
const rt = num(runs.map((r) => r.runtimeMs));
console.log(`  runtime per run   median ${(med(rt) / 1000).toFixed(1)}s · max ${(rt[rt.length - 1] / 1000).toFixed(1)}s`);
console.log(`  history events    median ${med(runs.map((r) => r.historyEvents))} · max ${Math.max(...runs.map((r) => r.historyEvents))}`);
console.log(`  defining events   median ${med(runs.map((r) => r.definingEvents))}`);
console.log(`  heap at end       median ${med(runs.map((r) => r.heapMB))}MB · max ${Math.max(...runs.map((r) => r.heapMB))}MB`);

console.log(`\nSUSPICIOUS-CONVERGENCE CHECKS`);
const flags: string[] = [];
if (extinct.length / n > 0.85) flags.push(`extinction rate ${pct(extinct.length)} — almost everything dies`);
if (extinct.length === 0) flags.push(`no colony ever went extinct — failure may be impossible`);
if (survived.length && survived.every((r) => r.settlementStage === survived[0].settlementStage)) flags.push(`every survivor reached the same settlement tier`);
if (survived.length && survived.every((r) => r.traditionsActive === survived[0].traditionsActive)) flags.push(`every survivor has exactly ${survived[0].traditionsActive} traditions`);
if (survived.length && survived.every((r) => r.distinctSurnames <= 1)) flags.push(`surnames collapsed to one lineage everywhere`);
if (survived.length && survived.filter((r) => r.largestSurnameShare > 0.5).length / survived.length > 0.5) flags.push(`most colonies dominated by a single surname`);
if (survived.length && survived.every((r) => Object.values(r.tech).every((v) => v >= 100))) flags.push(`all technology maxed in every run`);
if (survived.length && survived.every((r) => Object.values(r.tech).every((v) => v <= 25))) flags.push(`all technology collapsed in every run`);
console.log(flags.length ? flags.map((f) => `  FLAG: ${f}`).join("\n") : "  none — no suspicious uniformity detected");
console.log();
