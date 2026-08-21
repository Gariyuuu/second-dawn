// Verifies Director-mode policies measurably change 60-year outcomes,
// and that cultural traditions emerge from lived history rather than a schedule.
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import type { ColonyPolicy, SimState } from "../src/lib/sim/types";

const SEED = 42424242;
const YEARS = 60;

function run(label: string, policy: Partial<ColonyPolicy>): SimState {
  const s = createInitialState(SEED);
  const rand = new Rand(SEED ^ 0x9e3779b9);
  s.policy = { ...s.policy, ...policy };
  const t0 = Date.now();
  simulateDays(s, s.planet.yearLengthDays * YEARS, rand);
  const pop = s.colonists.filter((c) => c.alive).length;
  const offworldNames = s.colonists.filter((c) => !c.bornOnEarth && c.alive).slice(-3).map((c) => c.name);
  console.log(
    `${label.padEnd(26)} pop=${String(pop).padStart(4)} bld=${String(s.buildings.length).padStart(3)} ` +
      `stage=${s.settlementStage.padEnd(22)} traditions=${s.traditions.length} crises=${s.history.filter((h) => h.category === "crisis").length} ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );
  if (offworldNames.length) console.log(`${" ".repeat(28)}recent births: ${offworldNames.join(", ")}`);
  return s;
}

console.log(`Seed ${SEED} · ${YEARS} years per run\n`);
const balanced = run("balanced (default)", {});
run("strict rations", { rationing: "strict" });
run("generous + encouraged", { rationing: "generous", birthPolicy: "encouraged" });
run("restricted births", { birthPolicy: "restricted" });
run("labor: construction", { laborPriority: "construction" });
run("labor: learning", { laborPriority: "learning" });
run("aggressive survey", { expeditions: "aggressive" });
run("cautious survey", { expeditions: "cautious" });

console.log(`\nTraditions that emerged in the balanced run:`);
for (const t of balanced.traditions) {
  console.log(`  [day ${t.foundedDay}] ${t.name} (${t.kind}) — ${t.description.slice(0, 90)}…`);
}

const oldest = [...balanced.buildings].sort((a, b) => a.builtDay - b.builtDay);
console.log(`\nOldest standing structures (provenance check):`);
for (const b of oldest.slice(0, 4)) {
  const crewAlive = (b.builtByIds ?? []).filter((id) => balanced.colonists.find((c) => c.id === id)?.alive).length;
  console.log(
    `  ${(b.label || b.type).padEnd(24)} raised day ${String(b.builtDay).padStart(5)} · condition ${Math.round(b.condition)} · builder ${b.builtByName ?? "—"} · builders still alive: ${crewAlive}`
  );
}
