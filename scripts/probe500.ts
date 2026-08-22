// Long-horizon diagnostic probe: run one deterministic world to Year 500 and
// dump the structural health of every subsystem at each acceptance horizon.
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import type { SimState } from "../src/lib/sim/types";

const SEED = Number(process.argv[2] ?? 42424242);
const HORIZONS = [25, 50, 100, 200, 300, 500];

function ageHistogram(s: SimState) {
  const living = s.colonists.filter((c) => c.alive);
  const buckets = { "0-14": 0, "15-29": 0, "30-49": 0, "50-64": 0, "65+": 0 };
  for (const c of living) {
    if (c.ageYears < 15) buckets["0-14"]++;
    else if (c.ageYears < 30) buckets["15-29"]++;
    else if (c.ageYears < 50) buckets["30-49"]++;
    else if (c.ageYears < 65) buckets["50-64"]++;
    else buckets["65+"]++;
  }
  return buckets;
}

function surnames(s: SimState) {
  const m = new Map<string, number>();
  for (const c of s.colonists.filter((x) => x.alive)) {
    const sn = c.name.split(" ").slice(-1)[0];
    m.set(sn, (m.get(sn) ?? 0) + 1);
  }
  return m;
}

const s = createInitialState(SEED);
const rand = new Rand(SEED ^ 0x9e3779b9);
const yearLen = s.planet.yearLengthDays;
let prevYear = 0;

console.log(`seed ${SEED} · yearLen ${yearLen} · soil ${s.planet.soilFertility}\n`);
console.log(
  "Yr   pop  peak  dead  bld stage                  tech(m/me/a/e/c)      trad mus expd hist  ages(0-14/15-29/30-49/50-64/65+)  surn  top-surname  mem(MB)  s"
);

let peak = 0;
for (const year of HORIZONS) {
  const t0 = Date.now();
  simulateDays(s, Math.round((year - prevYear) * yearLen), rand);
  prevYear = year;
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const living = s.colonists.filter((c) => c.alive);
  peak = Math.max(peak, living.length);
  const dead = s.dead.length;
  const ah = ageHistogram(s);
  const sn = surnames(s);
  const topSn = [...sn.entries()].sort((a, b) => b[1] - a[1])[0];
  const mem = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
  const t = s.tech;
  console.log(
    `${String(year).padEnd(4)} ${String(living.length).padStart(4)} ${String(peak).padStart(5)} ${String(dead).padStart(5)} ` +
      `${String(s.buildings.length).padStart(4)} ${s.settlementStage.padEnd(22)} ` +
      `${t.manufacturing.toFixed(0).padStart(3)}/${t.medicine.toFixed(0).padStart(3)}/${t.agriculture.toFixed(0).padStart(3)}/${t.energy.toFixed(0).padStart(3)}/${t.construction.toFixed(0).padStart(3)} ` +
      `${String(s.traditions.length).padStart(4)} ${String(s.museum.length).padStart(4)} ${String(s.expeditions.length).padStart(4)} ${String(s.history.length).padStart(5)} ` +
      ` ${String(ah["0-14"]).padStart(4)}/${String(ah["15-29"]).padStart(4)}/${String(ah["30-49"]).padStart(4)}/${String(ah["50-64"]).padStart(4)}/${String(ah["65+"]).padStart(4)} ` +
      ` ${String(sn.size).padStart(4)}  ${topSn ? `${topSn[0]}×${topSn[1]}`.padEnd(14) : "—".padEnd(14)} ${mem.padStart(6)} ${dt.padStart(5)}`
  );
  if (living.length === 0) {
    console.log(`\nEXTINCT before year ${year}`);
    break;
  }
}

console.log(`\nResources at end:`);
for (const [k, v] of Object.entries(s.resources)) console.log(`  ${k.padEnd(14)} ${Math.floor(v).toLocaleString()}`);

console.log(`\nTraditions (${s.traditions.length}):`);
for (const t of s.traditions) console.log(`  day ${String(t.foundedDay).padStart(6)} ${t.kind.padEnd(8)} ${t.name}`);

console.log(`\nBuilding condition spread:`);
const conds = s.buildings.map((b) => b.condition).sort((a, b) => a - b);
console.log(`  min ${conds[0]?.toFixed(0)} med ${conds[Math.floor(conds.length / 2)]?.toFixed(0)} max ${conds[conds.length - 1]?.toFixed(0)} · below-20: ${conds.filter((c) => c < 20).length}/${conds.length}`);

console.log(`\nSample living names:`);
const sample = s.colonists.filter((c) => c.alive).slice(0, 8).map((c) => `${c.name} (${Math.floor(c.ageYears)}y)`);
console.log("  " + sample.join(", "));

console.log(`\nEvent categories:`);
const cats = new Map<string, number>();
for (const h of s.history) cats.set(h.category, (cats.get(h.category) ?? 0) + 1);
console.log("  " + [...cats.entries()].map(([k, v]) => `${k}=${v}`).join(" "));
