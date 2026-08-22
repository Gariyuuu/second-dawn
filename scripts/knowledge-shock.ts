/**
 * Knowledge-shock experiment. Removes every expert in three domains and measures
 * the consequences over a century, then repeats it against a colony with weak
 * institutions to show what schools and archives are actually worth.
 */
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import { buildKnowledgeContext, recordedDepth, archiveIntegrity } from "../src/lib/sim/knowledge";
import type { SimState, Skill } from "../src/lib/sim/types";

const SEED = Number(process.argv[2] ?? 42424242);
const SHOCK_AT = 120;
const TRADES: Skill[] = ["medicine", "engineering", "agriculture"];

function fresh(seed = SEED) {
  const s = createInitialState(seed);
  return { s, rand: new Rand(seed ^ 0x9e3779b9) };
}

function snapshot(s: SimState) {
  const ctx = buildKnowledgeContext(s.colonists);
  const best = (k: Skill) => Math.max(0, ...s.colonists.map((c) => c.skills[k] ?? 0));
  const cond = s.buildings.length ? s.buildings.reduce((a, b) => a + b.condition, 0) / s.buildings.length : 0;
  return {
    pop: s.colonists.length,
    prac: TRADES.map((t) => ctx.practitioners[t] ?? 0),
    best: TRADES.map((t) => Math.round(best(t))),
    tech: [s.tech.medicine, s.tech.energy, s.tech.agriculture].map(Math.round),
    cond: Math.round(cond),
    medicine: Math.round(s.resources.medicine),
    deaths: s.stats.deaths,
    buildings: s.buildings.length,
  };
}

function row(label: string, x: ReturnType<typeof snapshot>) {
  console.log(
    `  ${label.padEnd(16)} pop ${String(x.pop).padStart(5)} | practitioners ${x.prac.map((n) => String(n).padStart(3)).join("/")} | ` +
    `best skill ${x.best.map((n) => String(n).padStart(2)).join("/")} | tech(med/nrg/agr) ${x.tech.map((n) => String(n).padStart(3)).join("/")} | ` +
    `upkeep ${String(x.cond).padStart(3)} | meds ${String(x.medicine).padStart(5)}`
  );
}

function runShock(label: string, weaken: boolean) {
  console.log(`\n${"=".repeat(112)}\n${label}\n${"=".repeat(112)}`);
  const { s, rand } = fresh();
  const yl = s.planet.yearLengthDays;
  simulateDays(s, Math.round(yl * SHOCK_AT), rand);

  if (weaken) {
    // strip the institutions: no schools standing, records already badly degraded
    for (const b of s.buildings) if (b.type === "school" || b.type === "museum") b.condition = 5;
    for (const a of s.archives) a.integrity = 18;
  }
  console.log(`  institutions at shock: ${s.buildings.filter((b) => b.type === "school" && b.condition > 25).length} schools, archive integrity ${Math.round(archiveIntegrity(s, "technical"))}, recorded depth ${TRADES.map((t) => `${t.slice(0, 3)} ${Math.round(recordedDepth(s, t))}`).join(", ")}`);

  row("before", snapshot(s));
  let removed = 0;
  s.colonists = s.colonists.filter((c) => {
    const expert = TRADES.some((t) => (c.skills[t] ?? 0) >= 45);
    if (expert) removed++;
    return !expert;
  });
  console.log(`  removed ${removed} experts in year ${SHOCK_AT}`);
  row("immediately", snapshot(s));

  const marks = [5, 20, 50, 100];
  let at = 0;
  const results: Record<number, ReturnType<typeof snapshot>> = {};
  for (const m of marks) {
    simulateDays(s, Math.round(yl * (m - at)), rand);
    at = m;
    results[m] = snapshot(s);
    row(`+${m} years`, results[m]);
    if (!s.colonists.length) break;
  }
  return { state: s, results };
}

// control: the same colony, undisturbed
const ctrl = fresh();
const yl = ctrl.s.planet.yearLengthDays;
simulateDays(ctrl.s, Math.round(yl * (SHOCK_AT + 100)), ctrl.rand);
console.log(`CONTROL (no shock) at year ${SHOCK_AT + 100}:`);
row("control", snapshot(ctrl.s));

const strong = runShock(`STRONG INSTITUTIONS — schools and archives intact`, false);
const weak = runShock(`WEAK INSTITUTIONS — schools derelict, archives degraded to 18%`, true);

console.log(`\n${"=".repeat(112)}\nRECOVERY COMPARISON AT +100 YEARS\n${"=".repeat(112)}`);
const c = snapshot(ctrl.s);
const sr = strong.results[100];
const wr = weak.results[100];
if (sr && wr) {
  const pctOf = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "n/a");
  console.log(`  ${"".padEnd(22)} control      strong-inst   weak-inst`);
  for (let i = 0; i < TRADES.length; i++) {
    console.log(`  ${TRADES[i].padEnd(22)} ${String(c.prac[i]).padEnd(12)} ${`${sr.prac[i]} (${pctOf(sr.prac[i], c.prac[i])})`.padEnd(13)} ${wr.prac[i]} (${pctOf(wr.prac[i], c.prac[i])})`);
    console.log(`  ${`  best ${TRADES[i]}`.padEnd(22)} ${String(c.best[i]).padEnd(12)} ${`${sr.best[i]} (${pctOf(sr.best[i], c.best[i])})`.padEnd(13)} ${wr.best[i]} (${pctOf(wr.best[i], c.best[i])})`);
  }
  console.log(`  ${"population".padEnd(22)} ${String(c.pop).padEnd(12)} ${`${sr.pop} (${pctOf(sr.pop, c.pop)})`.padEnd(13)} ${wr.pop} (${pctOf(wr.pop, c.pop)})`);
  console.log(`  ${"upkeep condition".padEnd(22)} ${String(c.cond).padEnd(12)} ${String(sr.cond).padEnd(13)} ${wr.cond}`);
  console.log(`  ${"medicine stock".padEnd(22)} ${String(c.medicine).padEnd(12)} ${String(sr.medicine).padEnd(13)} ${wr.medicine}`);
}
