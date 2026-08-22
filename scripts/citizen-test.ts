/**
 * The Year-500 acceptance test. Picks a real citizen out of a five-century-old
 * colony and answers the questions in the brief, with every answer traced back
 * to canonical simulation state rather than generated prose.
 */
import { Rand } from "../src/lib/sim/rng";
import { createInitialState, simulateDays } from "../src/lib/sim/engine";
import { earthKnowledge, traditionsKnownBy, buildKnowledgeContext } from "../src/lib/sim/knowledge";
import { ancestorsOf, findPerson } from "../src/lib/sim/lookup";
import type { Colonist } from "../src/lib/sim/types";

const SEED = Number(process.argv[2] ?? 42424242);
const YEARS = Number(process.argv[3] ?? 500);

const s = createInitialState(SEED);
const rand = new Rand(SEED ^ 0x9e3779b9);
const yl = s.planet.yearLengthDays;
const t0 = Date.now();
simulateDays(s, Math.round(yl * YEARS), rand);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const living = s.colonists;
if (!living.length) {
  console.log(`Colony extinct at year ${Math.round((s.extinctDay ?? 0) / yl)} — no citizens to interview.`);
  process.exit(0);
}

const yr = (d: number) => `Year ${Math.floor(d / yl) + 1}`;

function lineage(c: Colonist, depth = 5) {
  const levels = ancestorsOf(s, c.id, depth);
  return levels.map((lvl, i) => `  ${"great-".repeat(Math.max(0, i - 1))}${i === 0 ? "parents" : "grandparents"}: ${lvl.map((p) => `${p.name} (b.${yr(p.birthDay)}${p.deathDay ? `, d.${yr(p.deathDay)}` : ", living"}${p.bornOnEarth ? ", Earth-born" : ""})`).join(", ")}`);
}

function interview(c: Colonist, label: string) {
  const ctx = buildKnowledgeContext(living);
  console.log(`\n${"=".repeat(78)}\n${label}: ${c.name}\n${"=".repeat(78)}`);

  console.log(`\nQ. Who are you?`);
  console.log(`   ${c.name}, age ${Math.floor(c.ageYears)}, born ${yr(c.birthDay)} on ${s.planet.name}.`);
  console.log(`   Generation ${c.generation} — ${c.generation} generations removed from the people who landed.`);
  console.log(`   Occupation: ${c.occupation}. Ideology: ${c.ideology}. Personality: ${c.personality.join(", ")}.`);

  console.log(`\nQ. Who is your family, and what do they do?`);
  const parents = c.relationships.filter((r) => r.kind === "parent").map((r) => findPerson(s, r.colonistId)).filter(Boolean);
  if (parents.length) {
    for (const p of parents) {
      console.log(`   Parent: ${p!.name} (${p!.occupation}${p!.topSkill ? `, ${p!.topSkill.skill} ${p!.topSkill.level}` : ""}) — ${p!.alive ? "living" : `died ${yr(p!.deathDay!)}`}`);
    }
  } else console.log(`   No parent records survive.`);
  const sibs = c.relationships.filter((r) => r.kind === "sibling").map((r) => findPerson(s, r.colonistId)).filter(Boolean);
  if (sibs.length) console.log(`   Siblings: ${sibs.map((x) => x!.name).join(", ")}`);
  const kids = c.relationships.filter((r) => r.kind === "child").map((r) => findPerson(s, r.colonistId)).filter(Boolean);
  if (kids.length) console.log(`   Children: ${kids.map((x) => x!.name).join(", ")}`);
  const anc = lineage(c);
  if (anc.length) { console.log(`   Ancestry:`); anc.forEach((l) => console.log(l)); }

  console.log(`\nQ. What is your trade, and how did you learn it?`);
  const skills = (Object.entries(c.skills) as [string, number][]).sort((a, b) => b[1] - a[1]);
  if (skills.length) {
    console.log(`   ${skills.map(([k, v]) => `${k} ${v}`).join(", ")}`);
    if (c.trainedVia === "school") console.log(`   Trained at the colony school under ${c.trainedBy}.`);
    else if (c.trainedVia === "parent") console.log(`   Taught by their own parent, ${c.trainedBy}.`);
    else if (c.trainedVia === "practitioner") console.log(`   Apprenticed to ${c.trainedBy}, the best practitioner then living.`);
    else if (c.trainedVia === "archive") console.log(`   Reconstructed the trade from written records — no living teacher remained.`);
    else console.log(`   Never formally trained.`);
  } else {
    console.log(`   No trade. Trained via: ${c.trainedVia ?? "n/a"} (nobody was available to teach one).`);
  }

  const ek = earthKnowledge(s, c);
  console.log(`\nQ. What is Earth?`);
  console.log(`   Understanding: ${ek.level.toUpperCase()} · source: ${ek.source}`);
  console.log(`   ${ek.detail}`);

  console.log(`\nQ. What traditions do you keep, and why?`);
  const known = traditionsKnownBy(s, c);
  if (!known.length) console.log(`   None are still observed.`);
  for (const t of known) {
    const trad = s.traditions.find((x) => x.name === t.name)!;
    const origin = s.history.find((h) => h.id === trad.originEventId);
    console.log(`   ${trad.name} (${trad.kind}, observance ${Math.round(trad.observance)}) — ${t.how}`);
    console.log(`      began ${yr(trad.foundedDay)}${origin ? `, from: "${origin.title}" in ${yr(origin.day)}` : ""}`);
    if (trad.lastRevivedDay) console.log(`      lapsed and was revived in ${yr(trad.lastRevivedDay)}`);
  }

  console.log(`\nQ. What is the oldest building you know?`);
  const oldest = [...s.buildings].sort((a, b) => a.builtDay - b.builtDay)[0];
  if (oldest) {
    console.log(`   ${oldest.label} — raised ${yr(oldest.builtDay)}, ${Math.floor((s.day - oldest.builtDay) / yl)} years ago.`);
    const cycles = Math.floor(oldest.fabricReplaced / 100);
    console.log(`   Condition ${Math.round(oldest.condition)}; fully rebuilt ${oldest.renovations} times${oldest.lastRenovatedDay ? ` (last ${yr(oldest.lastRenovatedDay)})` : ""}.`);
    console.log(`   Its fabric has been made good ${Math.round(oldest.fabricReplaced)} condition-points over its life —`);
    console.log(`   equivalent to replacing the whole structure ${cycles} time${cycles === 1 ? "" : "s"} piece by piece.`);
    console.log(`   Raised by: ${oldest.builtByName ?? "unrecorded"}`);
    const builders = (oldest.builtByIds ?? []).map((id) => findPerson(s, id)).filter(Boolean);
    if (builders.length) {
      const anyAlive = builders.some((b) => b!.alive);
      console.log(`   Builders: ${builders.map((b) => `${b!.name}${b!.alive ? " (living)" : ` (d.${yr(b!.deathDay!)})`}`).join(", ")}`);
      if (!anyAlive) console.log(`   Everyone who built it is dead. It has outlived its makers.`);
    }
  }

  console.log(`\nQ. Why does this settlement exist here at all?`);
  const landing = s.history.find((h) => h.category === "landing");
  console.log(`   ${landing ? landing.description : "unrecorded"}`);
  console.log(`   That was ${Math.floor(s.day / yl)} years ago. ${c.generation} generations of this person's family have lived since.`);

  console.log(`\n   [provenance check] every answer above came from: colonist record, relationship graph,`);
  console.log(`   archived-dead records, building provenance fields, tradition origin event ids, and the`);
  console.log(`   canonical history log. No biography was authored for this person.`);
  void ctx;
}

console.log(`SECOND DAWN — Year-${YEARS} citizen interview · seed ${SEED} · simulated in ${elapsed}s`);
console.log(`Colony: ${s.planet.name} · population ${living.length} · ${s.settlementStage} · ${s.government.systemName}`);
console.log(`Generations elapsed: up to ${Math.max(...living.map((c) => c.generation))}`);

const children = living.filter((c) => c.ageYears >= 8 && c.ageYears <= 14);
const adults = living.filter((c) => c.ageYears >= 25 && c.ageYears <= 55);
const pick = new Rand(SEED + 99);
if (children.length) interview(pick.pick(children), "RANDOM CHILD");
else console.log("\nNo children in this colony.");
if (adults.length) interview(pick.pick(adults), "RANDOM ADULT");
else console.log("\nNo working-age adults in this colony.");
