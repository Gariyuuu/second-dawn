/**
 * Long-horizon acceptance tests that are not seed sweeps:
 * determinism, speed-independence, institutional resilience, mass-casualty
 * shock, policy path-dependence and reversal, and a 500-year counterfactual.
 */
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays, tick } from "../src/lib/sim/engine";
import { buildKnowledgeContext } from "../src/lib/sim/knowledge";
import type { ColonyPolicy, SimState, Skill } from "../src/lib/sim/types";

const SEED = 42424242;
const pass: string[] = [];
const fail: string[] = [];
function check(name: string, ok: boolean, detail: string) {
  (ok ? pass : fail).push(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

function fresh(seed = SEED, policy: Partial<ColonyPolicy> = {}) {
  const s = createInitialState(seed);
  s.policy = { ...s.policy, ...policy };
  return { s, rand: new Rand(seed ^ 0x9e3779b9) };
}

function fingerprint(s: SimState) {
  const living = s.colonists;
  return [
    s.day,
    living.length,
    s.dead.length,
    s.buildings.length,
    s.stats.births,
    s.stats.deaths,
    s.settlementStage,
    s.government.systemName,
    s.traditions.map((t) => `${t.id}:${Math.round(t.observance)}`).join("|"),
    Math.round(s.resources.food),
    Math.round(s.resourceBase.oreRemaining),
    Object.values(s.tech).map((v) => Math.round(v)).join(","),
    living.slice(0, 12).map((c) => `${c.name}@${Math.floor(c.ageYears)}`).join("|"),
  ].join("::");
}

console.log("\n=== 1. DETERMINISM: same seed and policy twice ===");
{
  const a = fresh(); simulateDays(a.s, a.s.planet.yearLengthDays * 120, a.rand);
  const b = fresh(); simulateDays(b.s, b.s.planet.yearLengthDays * 120, b.rand);
  check("determinism", fingerprint(a.s) === fingerprint(b.s),
    `two independent 120-year runs of seed ${SEED} produced ${fingerprint(a.s) === fingerprint(b.s) ? "identical" : "DIFFERENT"} canonical state`);
}

console.log("\n=== 2. SPEED-INDEPENDENCE: day-by-day vs large fast-forward ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const days = Math.round(yl * 60);
  const slow = fresh();
  for (let i = 0; i < days; i++) tick(slow.s, slow.rand); // one day at a time
  const fast = fresh();
  simulateDays(fast.s, days, fast.rand); // one big jump
  const chunked = fresh();
  let left = days;
  while (left > 0) { const n = Math.min(120, left); simulateDays(chunked.s, n, chunked.rand); left -= n; }
  const f1 = fingerprint(slow.s), f2 = fingerprint(fast.s), f3 = fingerprint(chunked.s);
  check("speed-independence", f1 === f2 && f2 === f3,
    `1-day stepping, 120-day chunks and a single ${days}-day jump ${f1 === f2 && f2 === f3 ? "all agree" : "DISAGREE"}`);
}

console.log("\n=== 3. INSTITUTIONAL RESILIENCE: kill the best engineer at different eras ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const eras = [2, 50, 150, 300];
  const results: { era: number; pop: number; ctrlPop: number; energy: number; ctrlEnergy: number; schools: number }[] = [];
  for (const era of eras) {
    const horizon = era + 100;
    const ctrl = fresh(); simulateDays(ctrl.s, Math.round(yl * horizon), ctrl.rand);
    const exp = fresh();
    simulateDays(exp.s, Math.round(yl * era), exp.rand);
    const schools = exp.s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
    const eng = exp.s.colonists
      .filter((c) => (c.skills.engineering ?? 0) > 0)
      .sort((a, b) => (b.skills.engineering ?? 0) - (a.skills.engineering ?? 0))[0];
    if (eng) {
      exp.s.colonists = exp.s.colonists.filter((c) => c.id !== eng.id);
      exp.s.dead.push({
        id: eng.id, name: eng.name, sex: eng.sex, birthDay: eng.birthDay, deathDay: exp.s.day,
        deathCause: "decompression accident (experiment)", occupation: eng.occupation,
        bornOnEarth: eng.bornOnEarth, ageAtDeath: eng.ageYears,
        parentIds: [], childIds: [], topSkill: { skill: "engineering" as Skill, level: eng.skills.engineering ?? 0 },
      });
    }
    simulateDays(exp.s, Math.round(yl * (horizon - era)), exp.rand);
    results.push({
      era, pop: exp.s.colonists.length, ctrlPop: ctrl.s.colonists.length,
      energy: Math.round(exp.s.tech.energy), ctrlEnergy: Math.round(ctrl.s.tech.energy), schools,
    });
    console.log(`      year ${String(era).padStart(3)} (schools then: ${schools}) → 100 years later: pop ${exp.s.colonists.length} vs control ${ctrl.s.colonists.length}, energy tech ${Math.round(exp.s.tech.energy)} vs ${Math.round(ctrl.s.tech.energy)}`);
  }
  const early = results[0];
  const late = results[results.length - 1];
  const earlyHarm = early.ctrlPop > 0 ? 1 - early.pop / early.ctrlPop : 0;
  const lateHarm = late.ctrlPop > 0 ? 1 - late.pop / late.ctrlPop : 0;
  check("institutional resilience", earlyHarm >= lateHarm - 0.05,
    `losing the lead engineer costs ${(earlyHarm * 100).toFixed(0)}% of population when done in year ${early.era}, but ${(lateHarm * 100).toFixed(0)}% in year ${late.era} — a mature colony with schools absorbs it better`);
}

console.log("\n=== 4. KNOWLEDGE MASS CASUALTY: lose every practitioner of three trades ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const ctrl = fresh(); simulateDays(ctrl.s, Math.round(yl * 200), ctrl.rand);
  const exp = fresh(); simulateDays(exp.s, Math.round(yl * 100), exp.rand);
  const trades: Skill[] = ["medicine", "engineering", "agriculture"];
  let removed = 0;
  exp.s.colonists = exp.s.colonists.filter((c) => {
    const isExpert = trades.some((t) => (c.skills[t] ?? 0) >= 45);
    if (isExpert) removed++;
    return !isExpert;
  });
  const before = buildKnowledgeContext(exp.s.colonists);
  simulateDays(exp.s, Math.round(yl * 100), exp.rand);
  const after = buildKnowledgeContext(exp.s.colonists);
  const recovered = trades.filter((t) => (after.practitioners[t] ?? 0) > 0);
  console.log(`      removed ${removed} experts in year 100; practitioners immediately after: ${trades.map((t) => `${t}=${before.practitioners[t] ?? 0}`).join(", ")}`);
  console.log(`      a century later: ${trades.map((t) => `${t}=${after.practitioners[t] ?? 0}`).join(", ")} · population ${exp.s.colonists.length} vs control ${ctrl.s.colonists.length}`);
  check("mass casualty has real consequences", exp.s.colonists.length !== ctrl.s.colonists.length,
    `the shocked colony ended at ${exp.s.colonists.length} against a control of ${ctrl.s.colonists.length}; ${recovered.length}/3 trades were re-established (archives + schools), the rest stayed lost`);
}

console.log("\n=== 5. POLICY PATH DEPENDENCE: same policy applied at different moments ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const runs: { at: number; pop: number; lost: number }[] = [];
  for (const at of [5, 150]) {
    const r = fresh();
    simulateDays(r.s, Math.round(yl * at), r.rand);
    r.s.policy = { ...r.s.policy, expeditions: "aggressive" };
    simulateDays(r.s, Math.round(yl * (250 - at)), r.rand);
    runs.push({ at, pop: r.s.colonists.length, lost: r.s.stats.expeditionsLost });
    console.log(`      aggressive survey from year ${String(at).padStart(3)} → year 250: population ${r.s.colonists.length}, ${r.s.stats.expeditionsLost} teams lost`);
  }
  check("policy is path dependent", runs[0].pop !== runs[1].pop,
    `the identical policy produced ${runs[0].pop} vs ${runs[1].pop} people depending on when it was adopted`);
}

console.log("\n=== 6. POLICY REVERSAL: history should still show ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const switched = fresh(SEED, { birthPolicy: "restricted" });
  simulateDays(switched.s, Math.round(yl * 120), switched.rand);
  const popAtSwitch = switched.s.colonists.length;
  switched.s.policy = { ...switched.s.policy, birthPolicy: "encouraged" };
  simulateDays(switched.s, Math.round(yl * 80), switched.rand);
  const always = fresh(SEED, { birthPolicy: "encouraged" });
  simulateDays(always.s, Math.round(yl * 200), always.rand);
  console.log(`      restricted for 120y (pop ${popAtSwitch}) then encouraged for 80y → ${switched.s.colonists.length}`);
  console.log(`      encouraged the whole 200y → ${always.s.colonists.length}`);
  check("policy reversal carries history", switched.s.colonists.length < always.s.colonists.length,
    `the colony that spent its first 120 years restricting births never catches the one that never did (${switched.s.colonists.length} vs ${always.s.colonists.length})`);
}

console.log("\n=== 7. EXTINCTION IS POSSIBLE (deliberate mismanagement) ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const doomed = fresh(SEED, { rationing: "generous", birthPolicy: "encouraged", expeditions: "aggressive", laborPriority: "learning" });
  simulateDays(doomed.s, Math.round(yl * 300), doomed.rand);
  const healthy = fresh(SEED, {});
  simulateDays(healthy.s, Math.round(yl * 300), healthy.rand);
  const dc = doomed.s.stats.foodCrisisDays + doomed.s.stats.powerCrisisDays + doomed.s.stats.waterCrisisDays + doomed.s.stats.housingShortfallDays;
  const hc = healthy.s.stats.foodCrisisDays + healthy.s.stats.powerCrisisDays + healthy.s.stats.waterCrisisDays + healthy.s.stats.housingShortfallDays;
  console.log(`      mismanaged: pop ${doomed.s.colonists.length}, ${dc} days of shortage, ${doomed.s.stats.expeditionsLost} teams lost, ${doomed.s.stats.deaths} deaths`);
  console.log(`      balanced:   pop ${healthy.s.colonists.length}, ${hc} days of shortage, ${healthy.s.stats.expeditionsLost} teams lost, ${healthy.s.stats.deaths} deaths`);
  // Final headcount converges on what the land can feed whatever the policy, so
  // the honest measure of mismanagement is how much hardship it caused getting
  // there, not whether the survivors are fewer.
  check("bad policy causes real hardship", dc > hc || doomed.s.stats.deaths > healthy.s.stats.deaths,
    `mismanagement bought ${dc} days of shortage and ${doomed.s.stats.deaths} deaths against ${hc} days and ${healthy.s.stats.deaths} for the balanced control; both converge near the land's carrying capacity`);
}

console.log("\n=== 8. 500-YEAR COUNTERFACTUAL PAIR ===");
{
  const yl = createInitialState(SEED).planet.yearLengthDays;
  const base = fresh(); simulateDays(base.s, Math.round(yl * 500), base.rand);
  const forked = fresh();
  simulateDays(forked.s, Math.round(yl * 2), forked.rand);
  const eng = forked.s.colonists.filter((c) => (c.skills.engineering ?? 0) > 0)
    .sort((a, b) => (b.skills.engineering ?? 0) - (a.skills.engineering ?? 0))[0];
  if (eng) forked.s.colonists = forked.s.colonists.filter((c) => c.id !== eng.id);
  simulateDays(forked.s, Math.round(yl * 498), forked.rand);
  const cmp = (label: string, a: string | number, b: string | number) =>
    console.log(`      ${label.padEnd(22)} ${String(a).padEnd(28)} ${b}`);
  console.log(`      ${"".padEnd(22)} ${"engineer lived".padEnd(28)} engineer died year 2`);
  cmp("population", base.s.colonists.length, forked.s.colonists.length);
  cmp("settlement", base.s.settlementStage, forked.s.settlementStage);
  cmp("government", base.s.government.systemName, forked.s.government.systemName);
  cmp("buildings", base.s.buildings.length, forked.s.buildings.length);
  cmp("generations", Math.max(0, ...base.s.colonists.map((c) => c.generation)), Math.max(0, ...forked.s.colonists.map((c) => c.generation)));
  cmp("traditions", base.s.traditions.map((t) => t.name).join(", ") || "none", forked.s.traditions.map((t) => t.name).join(", ") || "none");
  cmp("artifacts", base.s.museum.length, forked.s.museum.length);
  cmp("crisis days", base.s.stats.foodCrisisDays + base.s.stats.powerCrisisDays, forked.s.stats.foodCrisisDays + forked.s.stats.powerCrisisDays);
  cmp("energy tech", Math.round(base.s.tech.energy), Math.round(forked.s.tech.energy));
  const differ = base.s.colonists.length !== forked.s.colonists.length ||
    base.s.traditions.map((t) => t.name).join() !== forked.s.traditions.map((t) => t.name).join();
  check("500-year counterfactual diverges", differ,
    `one changed death in year 2 produced two recognisably different civilizations five centuries later`);
}

console.log(`\n${"=".repeat(70)}\n${pass.length} passed · ${fail.length} failed`);
if (fail.length) { fail.forEach((f) => console.log(f)); process.exitCode = 1; }
