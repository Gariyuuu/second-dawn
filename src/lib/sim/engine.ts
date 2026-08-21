import { Rand } from "./rng";
import { generatePopulation, generateColonist } from "./colonistGen";
import { generatePlanet, generateEcology } from "./planetGen";
import type {
  Building,
  Colonist,
  HistoryEvent,
  Resources,
  SettlementStage,
  SimState,
  Skill,
} from "./types";

let eventCounter = 0;
function makeEvent(
  day: number,
  title: string,
  description: string,
  category: HistoryEvent["category"],
  colonistIds?: string[]
): HistoryEvent {
  return { id: `evt-${day}-${eventCounter++}`, day, title, description, category, colonistIds };
}

export function createInitialState(seed: number): SimState {
  const rand = new Rand(seed);
  const planet = generatePlanet(rand, seed);
  const ecology = generateEcology(rand, planet);
  const colonists = generatePopulation(rand, 120, 0);

  const resources: Resources = {
    food: 14000, // person-days of rations (~117 days for 120 people)
    water: 6000,
    energy: 500,
    medicine: 900,
    rawMaterials: 200,
    materials: 1300,
    components: 400,
    tools: 300,
    spareParts: 350,
    fuel: 1200,
    seeds: 500,
  };

  const initialBuildings: Building[] = [
    { id: "b-lander", type: "habitat_module", builtDay: 0, x: 0, z: 0, condition: 100, staffedBy: [] },
  ];

  const commander =
    colonists.find((c) => c.occupation === "commander") ??
    colonists.reduce((best, c) => ((c.skills.leadership ?? 0) > (best.skills.leadership ?? 0) ? c : best));

  const state: SimState = {
    seed,
    day: 0,
    colonists,
    planet,
    ecology,
    resources,
    productionRates: {},
    buildings: initialBuildings,
    settlementStage: "landing_camp",
    history: [
      makeEvent(
        0,
        "Landing Day",
        `The colony ship's descent vehicle touched down on ${planet.name}. 120 colonists disembarked under the command of ${commander.name}. Earth is unreachable. There will be no rescue.`,
        "landing"
      ),
    ],
    factions: [],
    government: {
      systemName: "Mission Emergency Protocol",
      established: false,
      leaderIds: [commander.id],
      laws: ["Emergency rationing in effect", "Commander holds final authority until permanent settlement"],
    },
    expeditions: [],
    museum: [
      {
        id: "mus-helmet",
        name: `Landing helmet of ${commander.name}`,
        originDay: 0,
        provenance: [`Worn by ${commander.name} during the descent on Day 0`],
        ownerColonistId: commander.id,
      },
    ],
    tech: { manufacturing: 70, medicine: 75, agriculture: 60, energy: 72, construction: 68 },
    landed: true,
    holidays: [],
    generationsBornOffworld: 0,
  };
  return state;
}

// ---------- helpers ----------

function alive(state: SimState) {
  return state.colonists.filter((c) => c.alive);
}

function skillTotal(state: SimState, skill: Skill): number {
  return alive(state).reduce((s, c) => s + (c.skills[skill] ?? 0), 0);
}

function bestAt(state: SimState, skill: Skill): Colonist | undefined {
  return alive(state)
    .filter((c) => (c.skills[skill] ?? 0) > 0)
    .sort((a, b) => (b.skills[skill] ?? 0) - (a.skills[skill] ?? 0))[0];
}

const BUILD_ORDER: {
  type: Building["type"];
  materials: number;
  components: number;
  minPop: number;
  label: string;
}[] = [
  { type: "power_station", materials: 60, components: 40, minPop: 0, label: "Power Station" },
  { type: "water_reclaimer", materials: 50, components: 30, minPop: 0, label: "Water Reclaimer" },
  // the lander itself counts as the first habitat_module, so list two to get one built
  { type: "habitat_module", materials: 80, components: 20, minPop: 0, label: "Habitat Module" },
  { type: "habitat_module", materials: 80, components: 20, minPop: 0, label: "Habitat Module" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 0, label: "Farm Dome" },
  { type: "medbay", materials: 70, components: 45, minPop: 0, label: "Medical Bay" },
  { type: "workshop", materials: 80, components: 50, minPop: 0, label: "Workshop" },
  { type: "storage_depot", materials: 60, components: 10, minPop: 0, label: "Storage Depot" },
  { type: "mine", materials: 100, components: 40, minPop: 0, label: "Mine" },
  { type: "refinery", materials: 120, components: 60, minPop: 0, label: "Refinery" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 130, label: "Second Farm Dome" },
  { type: "school", materials: 90, components: 25, minPop: 130, label: "School" },
  { type: "house", materials: 70, components: 15, minPop: 140, label: "Residential Block" },
  { type: "house", materials: 70, components: 15, minPop: 160, label: "Residential Block" },
  { type: "hall_of_governance", materials: 130, components: 40, minPop: 150, label: "Hall of Governance" },
  { type: "market", materials: 100, components: 30, minPop: 180, label: "Market" },
  { type: "house", materials: 70, components: 15, minPop: 200, label: "Residential Block" },
  { type: "museum", materials: 110, components: 35, minPop: 220, label: "Museum" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 200, label: "Third Farm Dome" },
  { type: "power_station", materials: 60, components: 40, minPop: 180, label: "Second Power Station" },
  { type: "water_reclaimer", materials: 50, components: 30, minPop: 160, label: "Second Water Reclaimer" },
  { type: "medbay", materials: 70, components: 45, minPop: 250, label: "Second Medical Bay" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 300, label: "Fourth Farm Dome" },
  { type: "house", materials: 70, components: 15, minPop: 260, label: "Residential Block" },
  { type: "house", materials: 70, components: 15, minPop: 320, label: "Residential Block" },
  { type: "power_station", materials: 60, components: 40, minPop: 350, label: "Third Power Station" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 420, label: "Fifth Farm Dome" },
  { type: "water_reclaimer", materials: 50, components: 30, minPop: 420, label: "Third Water Reclaimer" },
  { type: "house", materials: 70, components: 15, minPop: 400, label: "Residential Block" },
  { type: "house", materials: 70, components: 15, minPop: 480, label: "Residential Block" },
  { type: "farm_dome", materials: 90, components: 35, minPop: 560, label: "Sixth Farm Dome" },
  { type: "power_station", materials: 60, components: 40, minPop: 560, label: "Fourth Power Station" },
];

function settlementStageFor(buildings: Building[], pop: number): SettlementStage {
  const permanent = buildings.filter((b) =>
    ["house", "hall_of_governance", "market", "museum", "school"].includes(b.type)
  ).length;
  if (pop >= 600 && permanent >= 6) return "regional_civilization";
  if (pop >= 400 && permanent >= 5) return "city";
  if (pop >= 220 && permanent >= 3) return "town";
  if (permanent >= 1) return "permanent_buildings";
  if (buildings.length >= 5) return "modular_settlement";
  return "landing_camp";
}

// ---------- the daily tick ----------

export function tick(state: SimState, rand: Rand): SimState {
  const s = state; // mutate in place; store clones at the boundary
  s.day += 1;
  const day = s.day;
  const living = alive(s);
  const pop = living.length;
  if (pop === 0) return s;

  // --- energy production/consumption ---
  const powerStations = s.buildings.filter((b) => b.type === "power_station" && b.condition > 20).length;
  // the lander's own reactor provides a 130/day baseline
  const energyProduced = 130 + powerStations * 280 * (s.tech.energy / 100);
  const energyNeeded = pop * 0.9 + s.buildings.length * 4;
  s.resources.energy = Math.min(2000, s.resources.energy + energyProduced - energyNeeded);
  const powerCrisis = s.resources.energy < 0;
  if (powerCrisis) s.resources.energy = 0;

  // --- water ---
  const reclaimers = s.buildings.filter((b) => b.type === "water_reclaimer" && b.condition > 20).length;
  const waterProduced = (powerCrisis ? 10 : 30) + reclaimers * 200;
  const waterNeeded = pop * 1.1;
  s.resources.water = Math.min(20000, s.resources.water + waterProduced - waterNeeded);
  const waterCrisis = s.resources.water < 0;
  if (waterCrisis) s.resources.water = 0;

  // --- food: farming chain (seeds + farm domes + agriculture skill → food) ---
  const farms = s.buildings.filter((b) => b.type === "farm_dome" && b.condition > 20).length;
  const agSkill = skillTotal(s, "agriculture");
  const soilMult = s.planet.soilFertility === "rich" ? 1.3 : s.planet.soilFertility === "moderate" ? 1.0 : 0.7;
  let foodProduced = 0;
  if (farms > 0 && s.resources.seeds > 0) {
    foodProduced = farms * (100 + agSkill / 8) * soilMult * (0.5 + s.tech.agriculture / 200);
    if (powerCrisis) foodProduced *= 0.4; // greenhouses still get sunlight, but pumps and heaters are down
    s.resources.seeds = Math.max(0, s.resources.seeds - farms * 0.05);
    // farms regenerate a little seed stock
    s.resources.seeds = Math.min(2000, s.resources.seeds + farms * 0.08);
  }
  const foodNeeded = pop * 1.0;
  s.resources.food = Math.min(60000, s.resources.food + foodProduced - foodNeeded);
  const famine = s.resources.food < 0;
  if (famine) s.resources.food = 0;

  // --- mining → processing → materials → components chain ---
  const mines = s.buildings.filter((b) => b.type === "mine" && b.condition > 20).length;
  const refineries = s.buildings.filter((b) => b.type === "refinery" && b.condition > 20).length;
  const workshops = s.buildings.filter((b) => b.type === "workshop" && b.condition > 20).length;
  if (mines > 0 && !powerCrisis) {
    s.resources.rawMaterials += mines * 25 * (skillTotal(s, "geology") / 400 + 0.5);
  }
  if (refineries > 0 && s.resources.rawMaterials > 5 && !powerCrisis) {
    const processed = Math.min(s.resources.rawMaterials, refineries * 20);
    s.resources.rawMaterials -= processed;
    s.resources.materials += processed * 0.7;
  }
  // workshops leave a construction reserve of materials untouched
  if (workshops > 0 && s.resources.materials > 130 && !powerCrisis) {
    const fabSkill = skillTotal(s, "fabrication");
    const crafted = Math.min((s.resources.materials - 130) * 0.3, workshops * (6 + fabSkill / 200) * (s.tech.manufacturing / 100));
    s.resources.materials -= crafted;
    s.resources.components += crafted * 0.6;
    s.resources.spareParts += crafted * 0.25;
    s.resources.tools += crafted * 0.1;
  }

  // --- building decay & maintenance (needs spare parts + engineering) ---
  const engSkill = skillTotal(s, "engineering");
  for (const b of s.buildings) {
    b.condition -= rand.float(0.02, 0.09);
    if (b.condition < 75 && s.resources.spareParts >= 1 && engSkill > 100) {
      s.resources.spareParts -= 0.6;
      b.condition = Math.min(100, b.condition + 1.5);
    }
    b.condition = Math.max(0, b.condition);
  }

  // --- tech drift: expertise below threshold → regression; workshops+school → recovery ---
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 20).length;
  const techPairs: [keyof SimState["tech"], Skill][] = [
    ["manufacturing", "fabrication"],
    ["medicine", "medicine"],
    ["agriculture", "agriculture"],
    ["energy", "engineering"],
    ["construction", "construction"],
  ];
  for (const [field, skill] of techPairs) {
    const expertise = skillTotal(s, skill);
    if (expertise < 150) {
      s.tech[field] = Math.max(20, s.tech[field] - 0.01);
    } else if (schools > 0 && expertise > 400) {
      s.tech[field] = Math.min(100, s.tech[field] + 0.005);
    }
  }

  // --- construction: dedicated daily build effort ---
  const nextBuild = BUILD_ORDER.filter(
    (bo) =>
      pop >= 0 &&
      s.buildings.filter((b) => b.type === bo.type).length <
        BUILD_ORDER.filter((x) => x.type === bo.type && x.minPop <= Math.max(pop, 120)).length
  ).find((bo) => bo.minPop <= Math.max(pop, 120));
  if (
    nextBuild &&
    s.resources.materials >= nextBuild.materials &&
    s.resources.components >= nextBuild.components
  ) {
    const conSkill = skillTotal(s, "construction");
    // construction takes time: probability per day scales with construction skill; power outages slow it
    const buildP = Math.min(0.25, conSkill / 8000 + 0.02) * (powerCrisis ? 0.5 : 1);
    if (rand.bool(buildP)) {
      s.resources.materials -= nextBuild.materials;
      s.resources.components -= nextBuild.components;
      const angle = rand.float(0, Math.PI * 2);
      const dist = 6 + s.buildings.length * 2.2 + rand.float(0, 4);
      s.buildings.push({
        id: `b-${day}-${s.buildings.length}`,
        type: nextBuild.type,
        builtDay: day,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        condition: 100,
        staffedBy: [],
      });
      s.history.push(
        makeEvent(day, `${nextBuild.label} completed`, `Construction crews finished the ${nextBuild.label.toLowerCase()} on day ${day}.`, "construction")
      );
    }
  }

  // --- first local harvest event ---
  if (foodProduced > 0 && !s.history.some((h) => h.title === "First Local Harvest")) {
    s.history.push(
      makeEvent(day, "First Local Harvest", `The farm dome yielded its first crop grown in ${s.planet.name}'s soil. The colony is no longer living purely on shipped rations.`, "culture")
    );
  }

  // --- crises get logged once per streak ---
  if (powerCrisis && !recentEvent(s, "Power Crisis", 30)) {
    s.history.push(makeEvent(day, "Power Crisis", "Energy reserves hit zero. Non-essential systems dark; farm output and water reclamation suffered.", "crisis"));
  }
  if (famine && !recentEvent(s, "Food Shortage", 30)) {
    s.history.push(makeEvent(day, "Food Shortage", "Food stores ran out. Rationing cut to emergency minimum.", "crisis"));
  }
  if (waterCrisis && !recentEvent(s, "Water Shortage", 30)) {
    s.history.push(makeEvent(day, "Water Shortage", "Water reclamation could not keep pace with demand.", "crisis"));
  }

  // --- morale & mental health ---
  for (const c of living) {
    let delta = 0;
    if (famine) delta -= 1.5;
    if (powerCrisis) delta -= 0.8;
    if (waterCrisis) delta -= 1.2;
    if (!famine && !powerCrisis) delta += 0.15;
    if (c.personality.includes("resilient")) delta += 0.1;
    if (c.personality.includes("anxious")) delta -= 0.15;
    const friendCount = c.relationships.filter((r) => r.kind === "friend" || r.kind === "spouse").length;
    delta += Math.min(0.2, friendCount * 0.04);
    if (c.personality.includes("reclusive")) delta += 0.05; // isolation bothers them less
    c.morale = Math.max(0, Math.min(100, c.morale + delta));
    c.health.mental = Math.max(0, Math.min(100, c.health.mental + delta * 0.4));
  }

  // --- aging (applied daily in fractional years) ---
  for (const c of living) {
    c.ageYears += 1 / 365.25;
  }

  // --- romance: singles pair up over time ---
  if (day % 30 === 0) {
    const singles = living.filter((c) => {
      if (c.occupation === "child" || c.ageYears < 18 || c.ageYears > 50 || c.morale < 30) return false;
      const spouseRel = c.relationships.find((r) => r.kind === "spouse");
      if (!spouseRel) return true;
      const sp = s.colonists.find((x) => x.id === spouseRel.colonistId);
      return !sp?.alive; // widowed
    });
    for (const a of singles) {
      if (!rand.bool(0.06)) continue;
      const match = singles.find(
        (b) =>
          b.id !== a.id &&
          b.sex !== a.sex &&
          Math.abs(b.ageYears - a.ageYears) < 14 &&
          !a.relationships.some((r) => r.colonistId === b.id && (r.kind === "sibling" || r.kind === "parent" || r.kind === "child")) &&
          (b.ideology === a.ideology || rand.bool(0.4))
      );
      if (match) {
        a.relationships = a.relationships.filter((r) => r.kind !== "spouse");
        match.relationships = match.relationships.filter((r) => r.kind !== "spouse");
        a.relationships.push({ colonistId: match.id, kind: "spouse" });
        match.relationships.push({ colonistId: a.id, kind: "spouse" });
        singles.splice(singles.indexOf(match), 1);
      }
    }
  }

  // --- pregnancy & births ---
  for (const c of living) {
    if (c.sex !== "female" || c.health.pregnant || c.ageYears < 18 || c.ageYears > 44) continue;
    const spouseRel = c.relationships.find((r) => r.kind === "spouse");
    if (!spouseRel) continue;
    const spouse = s.colonists.find((x) => x.id === spouseRel.colonistId);
    if (!spouse?.alive) continue;
    const settled = s.settlementStage !== "landing_camp";
    const baseP = settled ? 0.0011 : 0.0004; // births rare in the desperate first phase
    if (c.morale > 40 && !famine && rand.bool(baseP)) {
      c.health.pregnant = true;
      c.health.pregnancyDueDay = day + 266;
    }
  }
  for (const c of living) {
    if (c.health.pregnant && c.health.pregnancyDueDay !== undefined && day >= c.health.pregnancyDueDay) {
      c.health.pregnant = false;
      c.health.pregnancyDueDay = undefined;
      const babyRand = rand;
      const baby = generateColonist(babyRand, s.colonists.length, day);
      baby.ageYears = 0;
      baby.birthDay = day;
      baby.bornOnEarth = false;
      baby.occupation = "child";
      baby.skills = {};
      baby.possessions = [];
      baby.goals = [];
      baby.fears = [];
      baby.health = { physical: rand.int(80, 100), mental: 80, chronicConditions: [], injured: false };
      baby.morale = 70;
      // inherit surname + culture from parents
      const motherSurname = c.name.split(" ").slice(-1)[0];
      baby.name = `${baby.name.split(" ")[0]} ${motherSurname}`;
      baby.ideology = rand.bool(0.6) ? c.ideology : baby.ideology;
      baby.relationships = [{ colonistId: c.id, kind: "parent" }];
      c.relationships.push({ colonistId: baby.id, kind: "child" });
      const father = c.relationships.find((r) => r.kind === "spouse");
      if (father) {
        const dad = s.colonists.find((x) => x.id === father.colonistId);
        if (dad?.alive) {
          baby.relationships.push({ colonistId: dad.id, kind: "parent" });
          dad.relationships.push({ colonistId: baby.id, kind: "child" });
        }
      }
      s.colonists.push(baby);
      s.generationsBornOffworld += 1;
      if (s.generationsBornOffworld === 1) {
        s.history.push(
          makeEvent(day, "First Birth", `${baby.name} became the first human born on ${s.planet.name} — the first of a generation that will never know Earth.`, "birth", [baby.id, c.id])
        );
      } else if (rand.bool(0.12)) {
        s.history.push(makeEvent(day, `Birth: ${baby.name}`, `${c.name} gave birth to ${baby.name}.`, "birth", [baby.id, c.id]));
      }
    }
  }

  // --- children grow up ---
  for (const c of living) {
    if (c.occupation === "child" && c.ageYears >= 16) {
      c.occupation = "unskilled";
      // education: learn from the colony's best teachers & schools
      const eduBoost = schools > 0 ? 15 : 5;
      const mentor = rand.pick(living.filter((x) => x.occupation !== "child" && x.id !== c.id));
      if (mentor) {
        const mentorSkills = Object.entries(mentor.skills) as [Skill, number][];
        if (mentorSkills.length) {
          const [skill, level] = rand.pick(mentorSkills);
          c.skills[skill] = Math.min(90, Math.round(level * 0.5) + eduBoost + rand.int(0, 15));
        }
      }
      c.goals = [rand.pick([
        "Surpass my parents' generation",
        "See what lies beyond the mapped ridge",
        "Keep the machines of the founders running",
        "Build a family in the new city",
      ])];
    }
  }

  // --- teaching: experts passively train apprentices ---
  if (day % 30 === 0) {
    const teachers = living.filter((c) => Object.values(c.skills).some((v) => (v ?? 0) > 70));
    for (const t of teachers.slice(0, 10)) {
      const studentPool = living.filter((c) => c.id !== t.id && c.occupation !== "child");
      if (!studentPool.length) continue;
      const student = rand.pick(studentPool);
      const teachable = (Object.entries(t.skills) as [Skill, number][]).filter(([, v]) => v > 70);
      if (!teachable.length) continue;
      const [skill] = rand.pick(teachable);
      student.skills[skill] = Math.min(85, (student.skills[skill] ?? 0) + rand.int(1, 3));
    }
  }

  // --- deaths ---
  for (const c of living) {
    let mortality = 0.0000008 * Math.pow(1.09, c.ageYears); // Gompertz-ish baseline
    if (famine) mortality *= 6;
    if (waterCrisis) mortality *= 8;
    if (c.health.chronicConditions.length && s.resources.medicine < 10) mortality *= 4;
    if (c.health.physical < 30) mortality *= 3;
    const medbays = s.buildings.filter((b) => b.type === "medbay" && b.condition > 20).length;
    const medSkill = skillTotal(s, "medicine");
    if (medbays > 0 && medSkill > 100 && s.resources.medicine > 5) mortality *= 0.55;
    if (rand.bool(mortality)) {
      c.alive = false;
      c.deathDay = day;
      c.deathCause = famine
        ? "malnutrition"
        : waterCrisis
        ? "dehydration"
        : c.ageYears > 70
        ? "old age"
        : rand.pick(["illness", "accident during work detail", "sudden cardiac event", "infection"]);
      s.resources.medicine = Math.max(0, s.resources.medicine - 2);
      const wasKeyExpert = (Object.entries(c.skills) as [Skill, number][]).some(
        ([skill, v]) => v > 60 && bestAt(s, skill)?.id === undefined
      );
      const importance =
        c.occupation === "commander" ||
        s.government.leaderIds.includes(c.id) ||
        (Object.values(c.skills).some((v) => (v ?? 0) > 80));
      if (importance || wasKeyExpert || rand.bool(0.25)) {
        s.history.push(
          makeEvent(day, `Death of ${c.name}`, `${c.name} (${c.occupation}, age ${Math.floor(c.ageYears)}) died of ${c.deathCause}. ${describeSkillLoss(s, c)}`, "death", [c.id])
        );
      }
      // leadership succession
      if (s.government.leaderIds.includes(c.id)) {
        s.government.leaderIds = s.government.leaderIds.filter((id) => id !== c.id);
        const successor = bestAt(s, "leadership");
        if (successor) {
          s.government.leaderIds.push(successor.id);
          s.history.push(
            makeEvent(day, "Leadership Succession", `${successor.name} assumed leadership after the death of ${c.name}.`, "governance", [successor.id])
          );
        }
      }
      // possessions with provenance can survive their owners
      if (c.possessions.length && rand.bool(0.3)) {
        const obj = rand.pick(c.possessions);
        s.museum.push({
          id: `mus-${day}-${s.museum.length}`,
          name: `${obj} (${c.name})`,
          originDay: c.birthDay,
          provenance: [
            `Belonged to ${c.name}, ${c.bornOnEarth ? "Earth-born colonist" : "born on " + s.planet.name}`,
            `Preserved after their death on day ${day}`,
          ],
        });
      }
    }
  }

  // --- last Earth memory ---
  const earthBornAlive = alive(s).filter((c) => c.bornOnEarth);
  if (earthBornAlive.length === 0 && s.lastEarthMemoryHolderDeathDay === undefined && s.generationsBornOffworld > 0) {
    s.lastEarthMemoryHolderDeathDay = day;
    s.history.push(
      makeEvent(day, "The Last Earth Memory", `The last colonist who remembered Earth has died. From this day forward, Earth exists only in records, stories, and artifacts. ${s.planet.name} is the only home anyone alive has ever known.`, "culture")
    );
  }

  // --- governance evolution ---
  if (!s.government.established && s.settlementStage !== "landing_camp" && day > 300) {
    // ideological pressure builds; once population is stable, a founding debate occurs
    if (rand.bool(0.004)) {
      establishGovernment(s, rand, day);
    }
  }

  // --- factions emerge from ideology clusters ---
  if (s.factions.length === 0 && day > 200 && pop > 80 && rand.bool(0.002)) {
    emergeFactions(s, rand, day);
  }

  // --- holidays: anniversary of landing becomes a tradition only after the colony survives long enough ---
  const yearLen = s.planet.yearLengthDays;
  if (day % yearLen === 0 && day >= yearLen * 3 && !s.holidays.some((h) => h.name === "Landing Day")) {
    const landingEvt = s.history.find((h) => h.category === "landing");
    s.holidays.push({ name: "Landing Day", day: 0, recurring: true, originEventId: landingEvt?.id ?? "" });
    s.history.push(
      makeEvent(day, "Landing Day Becomes Tradition", `After ${Math.floor(day / yearLen)} local years of survival, the anniversary of the landing has become the colony's first true holiday — a day of remembrance and feasting.`, "culture")
    );
  }

  // --- expeditions ---
  if (day % 60 === 0 && rand.bool(0.4) && pop > 40) {
    launchExpedition(s, rand, day);
  }
  for (const exp of s.expeditions) {
    if (exp.status === "underway" && day >= exp.returnDay) {
      resolveExpedition(s, rand, exp, day);
    }
  }

  // --- ecology disturbance from human activity ---
  if (s.ecology.length && day % 90 === 0) {
    const footprint = s.buildings.length + pop / 40;
    for (const sp of s.ecology) {
      if (sp.role === "producer" && footprint > 10) {
        sp.populationIndex = Math.max(5, sp.populationIndex - rand.float(0, footprint / 20));
      }
    }
    // consumers starve if their producers decline
    for (const sp of s.ecology.filter((x) => x.role === "consumer")) {
      const foodBase = s.ecology.filter((p) => sp.dependsOn.includes(p.id));
      const avgFood = foodBase.length ? foodBase.reduce((a, b) => a + b.populationIndex, 0) / foodBase.length : 50;
      if (avgFood < 25) sp.populationIndex = Math.max(2, sp.populationIndex - rand.float(0.5, 2));
    }
    const collapsed = s.ecology.filter((x) => x.populationIndex < 10 && x.role === "producer");
    if (collapsed.length && !recentEvent(s, "Ecological Decline", 400)) {
      s.history.push(
        makeEvent(day, "Ecological Decline", `Native ${collapsed[0].name} populations near the settlement have collapsed under human expansion. The ecologists' warnings grow sharper.`, "ecology")
      );
    }
  }

  // --- settlement stage transitions ---
  const newStage = settlementStageFor(s.buildings, pop);
  if (newStage !== s.settlementStage) {
    s.settlementStage = newStage;
    const stageNames: Record<SettlementStage, string> = {
      landing_camp: "Landing Camp",
      modular_settlement: "Modular Settlement",
      permanent_buildings: "Permanent Settlement",
      town: "Town",
      city: "City",
      regional_civilization: "Regional Civilization",
    };
    s.history.push(
      makeEvent(day, `A ${stageNames[newStage]} Rises`, `The colony has grown into a ${stageNames[newStage].toLowerCase()} — population ${pop}, ${s.buildings.length} structures.`, "construction")
    );
  }

  // --- production rates for UI ---
  s.productionRates = {
    food: Math.round((foodProduced - foodNeeded) * 10) / 10,
    water: Math.round((waterProduced - waterNeeded) * 10) / 10,
    energy: Math.round((energyProduced - energyNeeded) * 10) / 10,
  };

  // cap history to avoid unbounded growth in long sims
  if (s.history.length > 600) {
    s.history = [
      ...s.history.filter((h) => ["landing", "governance", "culture"].includes(h.category)).slice(0, 100),
      ...s.history.slice(-450),
    ].filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i);
  }

  return s;
}

function recentEvent(s: SimState, title: string, withinDays: number): boolean {
  return s.history.some((h) => h.title === title && s.day - h.day < withinDays);
}

function describeSkillLoss(s: SimState, dead: Colonist): string {
  const critical = (Object.entries(dead.skills) as [Skill, number][]).filter(([, v]) => v > 60);
  if (!critical.length) return "";
  const [skill, level] = critical.sort((a, b) => b[1] - a[1])[0];
  const remaining = alive(s).filter((c) => (c.skills[skill] ?? 0) > 40).length;
  if (remaining === 0) {
    return `They were the colony's last practitioner of ${skill} (proficiency ${level}). That knowledge may now be lost.`;
  }
  if (remaining <= 2) {
    return `Only ${remaining} colonist${remaining === 1 ? "" : "s"} with real ${skill} expertise remain.`;
  }
  return "";
}

function establishGovernment(s: SimState, rand: Rand, day: number) {
  const living = alive(s);
  const counts = new Map<string, number>();
  for (const c of living) counts.set(c.ideology, (counts.get(c.ideology) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const systems: Record<string, { name: string; laws: string[] }> = {
    collectivist: {
      name: "The Commons Assembly",
      laws: ["All land and machinery held in common", "Labor obligations rotate by lottery", "Rations allocated by need"],
    },
    individualist: {
      name: "The Charter Republic",
      laws: ["Personal property recognized", "Labor contracts freely negotiated", "Elected council of seven"],
    },
    technocratic: {
      name: "The Technical Directorate",
      laws: ["Voting weighted by certified expertise", "Resource allocation by systems model", "Mandatory apprenticeships"],
    },
    traditionalist: {
      name: "The Founders' Covenant",
      laws: ["Earth law adopted as precedent", "Family homesteads recognized", "Council of elders arbitrates disputes"],
    },
    pragmatist: {
      name: "The Provisional Council",
      laws: ["Leadership by annual open election", "Emergency powers sunset automatically", "All records public"],
    },
  };
  const sys = systems[dominant];
  const leaders = living
    .sort((a, b) => (b.skills.leadership ?? 0) + b.morale / 10 - ((a.skills.leadership ?? 0) + a.morale / 10))
    .slice(0, 3);
  s.government = {
    systemName: sys.name,
    established: true,
    establishedDay: day,
    leaderIds: leaders.map((l) => l.id),
    laws: sys.laws,
  };
  s.history.push(
    makeEvent(day, "Constitution Signed", `After long debate between ${[...counts.keys()].slice(0, 3).join(", ")} camps, the colony ratified its first constitution: "${sys.name}". ${leaders[0].name} was chosen to lead.`, "governance", leaders.map((l) => l.id))
  );
}

function emergeFactions(s: SimState, rand: Rand, day: number) {
  const living = alive(s);
  const byIdeology = new Map<string, Colonist[]>();
  for (const c of living) {
    if (!byIdeology.has(c.ideology)) byIdeology.set(c.ideology, []);
    byIdeology.get(c.ideology)!.push(c);
  }
  const sorted = [...byIdeology.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  const factionNames: Record<string, string> = {
    collectivist: "The Common Ground",
    individualist: "The Freeholders",
    technocratic: "The Meridian Circle",
    traditionalist: "The Earthkeepers",
    pragmatist: "The Survivors' Bloc",
  };
  for (const [ideology, members] of sorted) {
    s.factions.push({
      id: `fac-${ideology}`,
      name: factionNames[ideology] ?? ideology,
      ideology: ideology as Colonist["ideology"],
      memberIds: members.map((m) => m.id),
      founded: day,
    });
  }
  if (sorted.length >= 2) {
    s.history.push(
      makeEvent(day, "Political Factions Form", `Two organized movements have crystallized: ${sorted.map(([i]) => factionNames[i]).join(" and ")}. Debates over land, labor, and law are no longer private matters.`, "governance")
    );
  }
}

function launchExpedition(s: SimState, rand: Rand, day: number) {
  const living = alive(s);
  const candidates = living.filter(
    (c) => c.occupation !== "child" && c.health.physical > 60 && !s.expeditions.some((e) => e.status === "underway" && e.memberIds.includes(c.id))
  );
  if (candidates.length < 3 || s.resources.fuel < 20) return;
  const team = rand.shuffle(candidates).slice(0, rand.int(3, 5));
  const duration = rand.int(10, 40);
  s.resources.fuel -= 20;
  s.expeditions.push({
    id: `exp-${day}`,
    memberIds: team.map((t) => t.id),
    departedDay: day,
    returnDay: day + duration,
    destination: { x: rand.float(-100, 100), z: rand.float(-100, 100) },
    status: "underway",
    findings: [],
  });
}

function resolveExpedition(s: SimState, rand: Rand, exp: SimState["expeditions"][number], day: number) {
  const roll = rand.next();
  if (roll < 0.08) {
    // lost
    exp.status = "lost";
    for (const id of exp.memberIds) {
      const c = s.colonists.find((x) => x.id === id);
      if (c?.alive) {
        c.alive = false;
        c.deathDay = day;
        c.deathCause = "lost on expedition";
      }
    }
    s.history.push(
      makeEvent(day, "Expedition Lost", `The survey team that departed on day ${exp.departedDay} never returned. ${exp.memberIds.length} colonists are presumed dead.`, "exploration", exp.memberIds)
    );
  } else if (roll < 0.2) {
    exp.returnDay = day + rand.int(5, 15);
    exp.status = "underway"; // delayed but still out there
  } else {
    exp.status = "returned";
    const findings = rand.shuffle([
      `mapped a mineral-rich outcrop (${rand.int(50, 200)} units of raw material recovered)`,
      "charted a freshwater aquifer",
      "catalogued three new native species",
      "found a sheltered valley suitable for future settlement",
      "surveyed a geothermal vent field",
      "recovered fuel-grade hydrocarbons from a tar seep",
    ]).slice(0, rand.int(1, 2));
    exp.findings = findings;
    if (findings[0].includes("mineral")) s.resources.rawMaterials += rand.int(50, 200);
    if (findings.some((f) => f.includes("fuel"))) s.resources.fuel += rand.int(30, 100);
    if (rand.bool(0.3)) {
      s.history.push(
        makeEvent(day, "Expedition Returns", `The survey team returned after ${day - exp.departedDay} days. They ${findings.join("; ")}.`, "exploration", exp.memberIds)
      );
    }
  }
}

// ---------- LOD fast-forward: run N days quickly ----------

export function simulateDays(state: SimState, days: number, rand: Rand): SimState {
  let s = state;
  for (let i = 0; i < days; i++) {
    s = tick(s, rand);
    const pop = s.colonists.filter((c) => c.alive).length;
    if (pop === 0) {
      if (!s.history.some((h) => h.title === "Colony Extinct")) {
        s.history.push(makeEvent(s.day, "Colony Extinct", `The last colonist has died. ${s.planet.name} keeps only the ruins.`, "death"));
      }
      break;
    }
  }
  return s;
}
