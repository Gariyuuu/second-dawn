import { Rand } from "./rng";
import { generatePopulation, generateColonist } from "./colonistGen";
import { generatePlanet, generateEcology } from "./planetGen";
import { generateOffworldName } from "./names";
import {
  apprentice,
  buildKnowledgeContext,
  createFoundingArchives,
  decayArchives,
  practiceAndTeach,
  documentKnowledge,
  updateTech,
  type KnowledgeContext,
} from "./knowledge";
import { formTraditions, transmitTraditions } from "./culture";
import type {
  ArchivedColonist,
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
  colonistIds?: string[],
  significance: 1 | 2 | 3 = 2
): HistoryEvent {
  return { id: `evt-${day}-${eventCounter++}`, day, significance, title, description, category, colonistIds };
}

export function createInitialState(seed: number): SimState {
  const rand = new Rand(seed);
  const planet = generatePlanet(rand, seed);
  const ecology = generateEcology(rand, planet);
  const colonists = generatePopulation(rand, 120, 0);

  const resources: Resources = {
    food: 14000,
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
    {
      id: "b-lander",
      type: "habitat_module",
      label: "Descent Lander",
      builtDay: 0,
      x: 0,
      z: 0,
      condition: 100,
      staffedBy: [],
      builtByName: "Built on Earth; flown down on Landing Day",
      renovations: 0,
      // it carried the landing party down and shelters them, crampedly, until
      // proper habitats go up
      housing: 120,
      fabricReplaced: 0,
    },
  ];

  const commander =
    colonists.find((c) => c.occupation === "commander") ??
    colonists.reduce((best, c) => ((c.skills.leadership ?? 0) > (best.skills.leadership ?? 0) ? c : best));

  return {
    seed,
    day: 0,
    colonists,
    dead: [],
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
        "landing",
        [commander.id],
        3
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
        significanceReason: "Worn by the mission commander during the landing itself",
        significance: 100,
        archived: false,
      },
    ],
    tech: { manufacturing: 70, medicine: 75, agriculture: 60, energy: 72, construction: 68 },
    landed: true,
    traditions: [],
    archives: createFoundingArchives(),
    policy: {
      rationing: "standard",
      birthPolicy: "neutral",
      laborPriority: "balanced",
      expeditions: "normal",
    },
    knowledgeCtxPool: {},
    resourceBase: {
      // what the landing survey could see from the descent path
      oreKnown: 180000,
      oreRemaining: 180000,
      arableSites: 9,
      arableUsed: 0,
      depositsFound: 0,
      valleysFound: 0,
    },
    stats: {
      births: 0,
      deaths: 0,
      peakPopulation: 120,
      foodCrisisDays: 0,
      powerCrisisDays: 0,
      waterCrisisDays: 0,
      housingShortfallDays: 0,
      techRegressions: 0,
      expeditionsLaunched: 0,
      expeditionsLost: 0,
      buildingsReplaced: 0,
    },
    yearMortality: { yearStartDay: 0, deaths: 0, startPop: 120 },
    births: 0,
    generationsBornOffworld: 0,
    maxAncestryDepth: 0,
  };
}

// ---------- helpers ----------

let ctx: KnowledgeContext = { pools: {}, practitioners: {}, teachers: {}, pop: 0 };

function skillTotal(skill: Skill): number {
  return ctx.pools[skill] ?? 0;
}

function bestAt(living: Colonist[], skill: Skill): Colonist | undefined {
  let best: Colonist | undefined;
  for (const c of living) {
    const v = c.skills[skill] ?? 0;
    if (v > 0 && (!best || v > (best.skills[skill] ?? 0))) best = c;
  }
  return best;
}

function activeCount(s: SimState, type: Building["type"]) {
  let n = 0;
  for (const b of s.buildings) if (b.type === type && b.condition > 25) n++;
  return n;
}

// Storage capacity is physical: depots hold things, and a colony without them
// cannot stockpile indefinitely. This is what stops linear accumulation.
function storageCaps(s: SimState) {
  const depots = activeCount(s, "storage_depot");
  const base = 1 + depots;
  return {
    food: 8000 + depots * 14000,
    water: 6000 + depots * 9000,
    energy: 400 + activeCount(s, "power_station") * 900,
    medicine: 400 * base,
    rawMaterials: 1200 * base,
    materials: 1500 * base,
    components: 900 * base,
    tools: 500 * base,
    spareParts: 900 * base,
    fuel: 1500 * base,
    seeds: 900 * base,
  };
}

// ---------- construction: demand-driven, not a fixed script ----------

interface BuildSpec {
  type: Building["type"];
  label: string;
  materials: number;
  components: number;
}

const SPECS: Record<string, BuildSpec> = {
  power_station: { type: "power_station", label: "Power Station", materials: 60, components: 40 },
  water_reclaimer: { type: "water_reclaimer", label: "Water Reclaimer", materials: 50, components: 30 },
  farm_dome: { type: "farm_dome", label: "Farm Dome", materials: 90, components: 35 },
  habitat_module: { type: "habitat_module", label: "Habitat Module", materials: 80, components: 20 },
  house: { type: "house", label: "Residential Block", materials: 70, components: 15 },
  medbay: { type: "medbay", label: "Medical Bay", materials: 70, components: 45 },
  workshop: { type: "workshop", label: "Workshop", materials: 80, components: 50 },
  storage_depot: { type: "storage_depot", label: "Storage Depot", materials: 60, components: 10 },
  mine: { type: "mine", label: "Mine", materials: 100, components: 40 },
  refinery: { type: "refinery", label: "Refinery", materials: 120, components: 60 },
  school: { type: "school", label: "School", materials: 90, components: 25 },
  hall_of_governance: { type: "hall_of_governance", label: "Hall of Governance", materials: 130, components: 40 },
  market: { type: "market", label: "Market", materials: 100, components: 30 },
  museum: { type: "museum", label: "Museum", materials: 110, components: 35 },
};

const HOUSING_PER_HAB = 14;
const HOUSING_PER_HOUSE = 26;
/** Person-days of food one dome can produce per day at full efficiency. */
const FARM_YIELD = 95;
/**
 * Materials held back from discretionary uses so upkeep and repair always come
 * before stockpiling. Without this, a colony will happily fill its medicine
 * shelves while its roofs fall in.
 */
const MATERIALS_RESERVE = 140;

function housingCapacity(s: SimState) {
  let cap = 0;
  for (const b of s.buildings) {
    if (b.condition <= 25) continue;
    if (b.housing !== undefined) cap += b.housing;
    else if (b.type === "habitat_module") cap += HOUSING_PER_HAB;
    else if (b.type === "house") cap += HOUSING_PER_HOUSE;
  }
  return cap;
}

/** What the colony most lacks right now, as a ranked list of deficits. */
function constructionNeeds(s: SimState, pop: number, energyDeficit: number, waterDeficit: number, foodDeficit: number): [string, number][] {
  const needs: [string, number][] = [];
  const push = (k: string, v: number) => { if (v > 0) needs.push([k, v]); };

  // Capacity is planned with headroom rather than built only once people are
  // already short — a colony that waits for the deficit never catches up.
  push("house", (pop * 1.12 - housingCapacity(s)) / 10);
  push("power_station", energyDeficit / 120);
  push("water_reclaimer", waterDeficit / 90);
  const farmCapacity = activeCount(s, "farm_dome") * FARM_YIELD * 0.8;
  // a dome needs ground that will grow anything; unsurveyed land is not farmland
  if (s.resourceBase.arableUsed < s.resourceBase.arableSites) {
    push("farm_dome", Math.max(foodDeficit / 90, (pop * 1.15 - farmCapacity) / 60));
  }
  push("medbay", pop / 160 - activeCount(s, "medbay"));
  push("school", pop / 190 - activeCount(s, "school"));
  push("workshop", pop / 170 - activeCount(s, "workshop"));
  push("storage_depot", pop / 150 - activeCount(s, "storage_depot"));
  push("mine", pop / 200 - activeCount(s, "mine"));
  push("refinery", pop / 230 - activeCount(s, "refinery"));
  if (pop >= 150) push("hall_of_governance", 1 - activeCount(s, "hall_of_governance"));
  if (pop >= 200) push("market", pop / 300 - activeCount(s, "market"));
  if (pop >= 240) push("museum", 1 - activeCount(s, "museum"));

  return needs.sort((a, b) => b[1] - a[1]);
}

function placeBuilding(s: SimState, spec: BuildSpec, day: number, crew: Colonist[], rand: Rand) {
  const angle = rand.float(0, Math.PI * 2);
  const dist = 6 + Math.sqrt(s.buildings.length) * 6 + rand.float(0, 5);
  s.buildings.push({
    id: `b-${day}-${s.buildings.length}`,
    type: spec.type,
    label: spec.label,
    builtDay: day,
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    condition: 100,
    staffedBy: [],
    builtByName: crew[0]?.name,
    builtByIds: crew.map((c) => c.id),
    renovations: 0,
    fabricReplaced: 0,
  });
}

function settlementStageFor(s: SimState, pop: number): SettlementStage {
  const permanent = s.buildings.filter(
    (b) => ["house", "hall_of_governance", "market", "museum", "school"].includes(b.type) && b.condition > 25
  ).length;
  const working = s.buildings.filter((b) => b.condition > 25).length;
  if (pop >= 600 && permanent >= 6) return "regional_civilization";
  if (pop >= 400 && permanent >= 5) return "city";
  if (pop >= 220 && permanent >= 3) return "town";
  if (pop >= 60 && permanent >= 1) return "permanent_buildings";
  if (working >= 5) return "modular_settlement";
  return "landing_camp";
}

// ---------- crisis aggregation ----------

/**
 * A famine that lasts eighty days is one event with a duration, not eighty
 * identical log lines. Aggregating as it happens keeps the canonical record
 * complete without drowning five centuries of history in repetition.
 */
function recordCrisis(s: SimState, day: number, title: string, description: string) {
  const open = s.history[s.history.length - 1];
  if (open && open.title === title && open.category === "crisis" && (open.endDay ?? open.day) >= day - 2) {
    open.endDay = day;
    open.durationDays = (open.endDay - open.day) + 1;
    if (open.durationDays > 60) open.significance = 3;
    else if (open.durationDays > 14) open.significance = 2;
    return;
  }
  // look a little further back so alternating crises still merge correctly
  for (let i = s.history.length - 1; i >= Math.max(0, s.history.length - 6); i--) {
    const h = s.history[i];
    if (h.title === title && h.category === "crisis" && (h.endDay ?? h.day) >= day - 2) {
      h.endDay = day;
      h.durationDays = (h.endDay - h.day) + 1;
      if (h.durationDays > 60) h.significance = 3;
      else if (h.durationDays > 14) h.significance = 2;
      return;
    }
  }
  const e = makeEvent(day, title, description, "crisis", undefined, 1);
  e.durationDays = 1;
  e.endDay = day;
  s.history.push(e);
}

// ---------- the daily tick ----------

export function tick(state: SimState, rand: Rand): SimState {
  const s = state;
  s.day += 1;
  const day = s.day;
  const living = s.colonists; // colonists array holds only the living
  const pop = living.length;
  if (pop === 0) return s;

  // Simulation level of detail. Per-person systems are the dominant cost, so at
  // large populations each colonist is visited on a rotating schedule with the
  // effect scaled up to match. Aggregate behaviour is preserved and the result
  // stays fully deterministic; only the interleaving changes.
  const stride = pop > 2200 ? 6 : pop > 1100 ? 4 : pop > 450 ? 2 : 1;
  const phase = day % stride;

  if (day % stride === 0 || ctx.pop === 0) {
    ctx = buildKnowledgeContext(living);
    s.knowledgeCtxPool = ctx.pools;
  }
  s.stats.peakPopulation = Math.max(s.stats.peakPopulation, pop);
  const caps = storageCaps(s);

  const pol = s.policy;
  const rationMult = pol.rationing === "strict" ? 0.78 : pol.rationing === "generous" ? 1.2 : 1;
  const rationMorale = pol.rationing === "strict" ? -0.14 : pol.rationing === "generous" ? 0.12 : 0;
  const farmFocus = pol.laborPriority === "food" ? 1.3 : pol.laborPriority === "balanced" ? 1 : 0.85;
  const industryFocus = pol.laborPriority === "industry" ? 1.35 : pol.laborPriority === "balanced" ? 1 : 0.85;
  const buildFocus = pol.laborPriority === "construction" ? 1.6 : pol.laborPriority === "balanced" ? 1 : 0.8;
  const learnFocus = pol.laborPriority === "learning" ? 2.0 : pol.laborPriority === "balanced" ? 1 : 0.75;

  // --- energy ---
  const powerStations = activeCount(s, "power_station");
  const energyProduced = 130 + powerStations * 280 * (0.35 + s.tech.energy / 154);
  const energyNeeded = pop * 0.9 + s.buildings.length * 4;
  s.resources.energy = Math.min(caps.energy, s.resources.energy + energyProduced - energyNeeded);
  const powerCrisis = s.resources.energy < 0;
  if (powerCrisis) { s.resources.energy = 0; s.stats.powerCrisisDays++; }

  // --- water --- (a dry world genuinely yields less per reclaimer)
  const reclaimers = activeCount(s, "water_reclaimer");
  const hydroMult = s.planet.hydrosphere === "abundant" ? 1.25 : s.planet.hydrosphere === "moderate" ? 1 : 0.6;
  const waterProduced = (powerCrisis ? 10 : 30) + reclaimers * 200 * hydroMult;
  const waterNeeded = pop * 1.1;
  s.resources.water = Math.min(caps.water, s.resources.water + waterProduced - waterNeeded);
  const waterCrisis = s.resources.water < 0;
  if (waterCrisis) { s.resources.water = 0; s.stats.waterCrisisDays++; }

  // --- food ---
  const farms = activeCount(s, "farm_dome");
  const agSkill = skillTotal("agriculture");
  const soilMult = s.planet.soilFertility === "rich" ? 1.3 : s.planet.soilFertility === "moderate" ? 1.0 : 0.7;
  let foodProduced = 0;
  if (farms > 0 && s.resources.seeds > 0) {
    // A farm dome has a physical ceiling. Skill and technology decide how close
    // to it the colony gets — they cannot make five domes feed a city.
    const skillPerFarm = agSkill / farms;
    const efficiency = Math.min(1.15, 0.3 + Math.min(0.6, skillPerFarm / 240) + s.tech.agriculture / 320);
    foodProduced = farms * FARM_YIELD * efficiency * soilMult * farmFocus;
    if (powerCrisis) foodProduced *= 0.4;
    s.resources.seeds = Math.min(caps.seeds, Math.max(0, s.resources.seeds + farms * 0.03));
  }
  const foodNeeded = pop * 1.0 * rationMult;
  s.resources.food = Math.min(caps.food, s.resources.food + foodProduced - foodNeeded);
  const famine = s.resources.food < 0;
  if (famine) { s.resources.food = 0; s.stats.foodCrisisDays++; }

  // --- housing pressure ---
  const housing = housingCapacity(s);
  const overcrowded = pop > housing;
  if (overcrowded) s.stats.housingShortfallDays++;
  const crowding = housing > 0 ? Math.max(0, pop / housing - 1) : 2;

  // --- industry: mine → refine → fabricate, throttled by storage and demand ---
  const mines = activeCount(s, "mine");
  const refineries = activeCount(s, "refinery");
  const workshops = activeCount(s, "workshop");
  if (mines > 0 && !powerCrisis && s.resources.rawMaterials < caps.rawMaterials && s.resourceBase.oreRemaining > 0) {
    // ore comes out of a finite deposit; when the seams the colony knows about
    // are worked out, mining stops until someone finds more
    // worked-out seams yield less for the same effort, so depletion is felt
    // gradually rather than as a cliff
    const richness = Math.pow(Math.max(0, s.resourceBase.oreRemaining / Math.max(1, s.resourceBase.oreKnown)), 0.4);
    const wanted = mines * 18 * (skillTotal("geology") / 500 + 0.5) * industryFocus * Math.max(0.12, richness);
    const mined = Math.min(wanted, s.resourceBase.oreRemaining, caps.rawMaterials - s.resources.rawMaterials);
    s.resourceBase.oreRemaining -= mined;
    s.resources.rawMaterials += mined;
    if (s.resourceBase.oreRemaining <= 0 && !s.history.some((h) => h.title === "The Seams Run Out")) {
      s.history.push(
        makeEvent(day, "The Seams Run Out", `Every ore deposit the colony has surveyed is worked out. Without new discoveries there is nothing left to refine, and everything built from here must be salvaged or found.`, "crisis", undefined, 3)
      );
    }
  }
  if (refineries > 0 && s.resources.rawMaterials > 5 && !powerCrisis && s.resources.materials < caps.materials) {
    const processed = Math.min(s.resources.rawMaterials, refineries * 16 * industryFocus);
    s.resources.rawMaterials -= processed;
    s.resources.materials = Math.min(caps.materials, s.resources.materials + processed * 0.7);
  }
  // Fabrication runs whenever any of its outputs is short, and keeps priority
  // over discretionary material use because spare parts are what hold the
  // settlement together.
  // Workshops make what the settlement is short of and then stop. Running them
  // flat out would consume every scrap of material and leave nothing to build
  // with, which is a good way to keep a colony permanently at its founding size.
  if (workshops > 0 && !powerCrisis) {
    const fabSkill = skillTotal("fabrication");
    const partsTarget = Math.min(caps.spareParts, 60 + s.buildings.length * 9);
    const compTarget = Math.min(caps.components, 150 + s.buildings.length * 5);
    const toolTarget = Math.min(caps.tools, 80 + pop * 0.35);
    const short =
      Math.max(0, partsTarget - s.resources.spareParts) +
      Math.max(0, compTarget - s.resources.components) +
      Math.max(0, toolTarget - s.resources.tools);
    if (short > 1 && s.resources.materials > MATERIALS_RESERVE) {
      const capacity = workshops * (5 + fabSkill / 220) * (0.3 + s.tech.manufacturing / 140) * industryFocus;
      const crafted = Math.max(0, Math.min(capacity, short, s.resources.materials - MATERIALS_RESERVE));
      s.resources.materials -= crafted;
      s.resources.components = Math.min(caps.components, s.resources.components + crafted * 0.6);
      s.resources.spareParts = Math.min(caps.spareParts, s.resources.spareParts + crafted * 0.25);
      s.resources.tools = Math.min(caps.tools, s.resources.tools + crafted * 0.1);
    }
  }

  // --- medicine is manufactured, not conjured: medbay + doctors + materials ---
  // Production chases the stock a population of this size actually needs, so it
  // stops consuming materials once the dispensary is supplied.
  const medbays = activeCount(s, "medbay");
  const medSkill = skillTotal("medicine");
  const medicineTarget = Math.min(caps.medicine, pop * 2.5 + 100);
  if (medbays > 0 && medSkill > 40 && !powerCrisis && s.resources.medicine < medicineTarget) {
    const capacity = medbays * (0.6 + Math.min(3, medSkill / 400)) * (0.3 + s.tech.medicine / 140);
    const wanted = Math.min(capacity, medicineTarget - s.resources.medicine);
    const affordable = Math.max(0, Math.min(wanted, (s.resources.materials - MATERIALS_RESERVE) / 0.5));
    if (affordable > 0) {
      s.resources.materials -= affordable * 0.5;
      s.resources.medicine = Math.min(caps.medicine, s.resources.medicine + affordable);
    }
  }
  // ongoing clinical use scales with how many people there are to treat
  s.resources.medicine = Math.max(0, s.resources.medicine - pop * 0.004);

  // --- maintenance: finite labour spread across everything that needs it ---
  // Wear rate varies by what a structure is and how heavily it is worked, so a
  // settlement's infrastructure ages unevenly instead of failing all at once.
  for (const b of s.buildings) {
    const heavy = b.type === "refinery" || b.type === "mine" || b.type === "workshop" || b.type === "power_station";
    const base = heavy ? 0.075 : b.type === "house" || b.type === "habitat_module" ? 0.035 : 0.05;
    b.condition = Math.max(0, b.condition - base * rand.float(0.5, 1.6));
  }

  // Upkeep is a budget of condition-points the colony can restore today, set by
  // how much skilled labour it has and how many parts it can spare. It is sized
  // to offset ordinary wear, not to hold every structure at showroom condition,
  // which is what keeps the material economy in balance over centuries.
  const engPool = skillTotal("engineering") + skillTotal("construction") * 0.5;
  const PARTS_PER_POINT = 0.04;
  let repairBudget = Math.min(s.buildings.length * 0.16, engPool / 300);
  const needy = s.buildings.filter((b) => b.condition < 90).sort((a, b) => a.condition - b.condition);
  for (const b of needy) {
    if (repairBudget <= 0.01) break;
    const want = Math.min(90 - b.condition, 0.35, repairBudget);
    const cost = want * PARTS_PER_POINT;
    if (s.resources.spareParts < cost) break;
    s.resources.spareParts -= cost;
    b.condition = Math.min(100, b.condition + want);
    b.fabricReplaced += want;
    repairBudget -= want;
  }

  // --- renovation and replacement: fabric gets rebuilt, or the building is lost ---
  const conSkill = skillTotal("construction");
  const derelict = s.buildings.filter((b) => b.condition < 12);
  if (derelict.length && s.resources.materials > 60 && conSkill > 60 && rand.bool(0.05 * buildFocus)) {
    const target = derelict[0];
    const spec = SPECS[target.type];
    if (spec && s.resources.materials >= spec.materials * 0.6) {
      s.resources.materials -= spec.materials * 0.6;
      s.resources.components = Math.max(0, s.resources.components - spec.components * 0.4);
      const crew = bestAt(living, "construction");
      target.condition = 94;
      target.renovations += 1;
      target.lastRenovatedDay = day;
      target.renovatedByName = crew?.name;
      s.stats.buildingsReplaced++;
      if (target.renovations === 1 || target.renovations % 4 === 0) {
        s.history.push(
          makeEvent(
            day,
            `${target.label} Rebuilt`,
            `The ${target.label.toLowerCase()}, first raised on day ${target.builtDay}, had decayed past use and was rebuilt${crew ? ` under ${crew.name}` : ""}. Little of the original fabric remains.`,
            "construction",
            undefined,
            2
          )
        );
      }
    }
  }
  // structures nobody can maintain eventually collapse and stop counting
  for (let i = s.buildings.length - 1; i >= 0; i--) {
    const b = s.buildings[i];
    if (b.condition <= 0 && b.id !== "b-lander" && rand.bool(0.004)) {
      s.buildings.splice(i, 1);
      s.history.push(
        makeEvent(day, `${b.label} Collapses`, `The ${b.label.toLowerCase()}, standing since day ${b.builtDay}, has fallen in. Nobody remaining had the skill or parts to hold it up.`, "construction", undefined, 2)
      );
    }
  }

  // --- new construction, driven by what is actually short ---
  const needs = constructionNeeds(
    s,
    pop,
    Math.max(0, energyNeeded - energyProduced),
    Math.max(0, waterNeeded - waterProduced),
    Math.max(0, foodNeeded - foodProduced)
  );
  // A settlement that cannot keep its existing fabric standing does not start
  // new work. This is what stops build-out running ahead of upkeep capacity.
  const avgCondition = s.buildings.length
    ? s.buildings.reduce((a, b) => a + b.condition, 0) / s.buildings.length
    : 100;
  const canAffordUpkeep = avgCondition > 45 || s.buildings.length < 8;
  // Work down the priority list to the most pressing thing the colony can
  // actually pay for. Fixating on an unaffordable first choice would stall
  // development permanently.
  const affordable = needs.find(([k]) => {
    const sp = SPECS[k];
    return sp && s.resources.materials >= sp.materials && s.resources.components >= sp.components;
  });
  if (affordable && canAffordUpkeep) {
    const spec = SPECS[affordable[0]];
    if (spec) {
      const buildP = Math.min(0.4, (conSkill / 9000 + 0.015) * buildFocus) * (powerCrisis ? 0.5 : 1);
      if (rand.bool(buildP)) {
        s.resources.materials -= spec.materials;
        s.resources.components -= spec.components;
        const crew = living
          .filter((c) => (c.skills.construction ?? 0) > 20)
          .sort((a, b) => (b.skills.construction ?? 0) - (a.skills.construction ?? 0))
          .slice(0, 4);
        if (spec.type === "farm_dome") s.resourceBase.arableUsed += 1;
        placeBuilding(s, spec, day, crew, rand);
        const firstOfKind = s.buildings.filter((b) => b.type === spec.type).length === 1;
        s.history.push(
          makeEvent(
            day,
            `${spec.label} completed`,
            `Construction crews finished the ${spec.label.toLowerCase()} on day ${day}.`,
            "construction",
            undefined,
            firstOfKind ? 2 : 1
          )
        );
      }
    }
  }

  // --- first local harvest ---
  if (foodProduced > 0 && !s.history.some((h) => h.title === "First Local Harvest")) {
    s.history.push(
      makeEvent(day, "First Local Harvest", `The farm dome yielded its first crop grown in ${s.planet.name}'s soil. The colony is no longer living purely on shipped rations.`, "culture", undefined, 3)
    );
  }

  // --- crises ---
  if (powerCrisis) recordCrisis(s, day, "Power Crisis", "Energy reserves hit zero. Non-essential systems dark; farm output and water reclamation suffered.");
  if (famine) recordCrisis(s, day, "Food Shortage", "Food stores ran out. Rationing cut to emergency minimum.");
  if (waterCrisis) recordCrisis(s, day, "Water Shortage", "Water reclamation could not keep pace with demand.");
  if (overcrowded && crowding > 0.25) recordCrisis(s, day, "Housing Shortage", "There are more people than the settlement has shelter for. Households are doubling up.");

  // --- knowledge systems ---
  updateTech(s, ctx);
  decayArchives(s, rand);
  if (day % 30 === 0) practiceAndTeach(living, ctx, s, rand);
  if (day % 60 === 0) documentKnowledge(s, ctx, rand);

  // --- morale and ageing (rotating cohort) ---
  for (let i = phase; i < living.length; i += stride) {
    const c = living[i];
    let delta = rationMorale;
    if (famine) delta -= 1.5;
    if (powerCrisis) delta -= 0.8;
    if (waterCrisis) delta -= 1.2;
    // overcrowding wears people down, but it is a hardship they live with rather
    // than something that empties a person out in a fortnight
    if (crowding > 0.25) delta -= Math.min(1.2, crowding * 0.8);
    if (!famine && !powerCrisis) delta += 0.15;
    if (c.personality.includes("resilient")) delta += 0.1;
    if (c.personality.includes("anxious")) delta -= 0.15;
    const friendCount = c.relationships.filter((r) => r.kind === "friend" || r.kind === "spouse").length;
    delta += Math.min(0.2, friendCount * 0.04);
    if (c.personality.includes("reclusive")) delta += 0.05;
    delta += (55 - c.morale) * 0.004;
    c.morale = Math.max(0, Math.min(100, c.morale + delta * stride));
    c.health.mental = Math.max(0, Math.min(100, c.health.mental + delta * 0.4 * stride));
    c.ageYears += stride / 365.25;
  }

  // --- romance ---
  if (day % 30 === 0) formPartnerships(s, living, rand);

  // --- pregnancy and birth ---
  handleBirths(s, living, rand, day, pol, famine, crowding, stride, phase);

  // --- coming of age: apprenticeship into an actual trade ---
  for (const c of living) {
    if (c.occupation === "child" && c.ageYears >= 16) {
      c.occupation = "unskilled";
      const res = apprentice(c, living, ctx, s, rand);
      c.trainedVia = res.via;
      c.trainedBy = res.teacherName;
      if (res.skill) {
        c.occupation = occupationForSkill(res.skill);
        if (res.via === "archive") {
          s.history.push(
            makeEvent(day, `${c.name} Relearns ${res.skill} From Records`, `With no living practitioner left to teach it, ${c.name} reconstructed ${res.skill} from the colony's surviving written records — imperfectly, at level ${res.level}.`, "technology", [c.id], 3)
          );
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
  if (learnFocus > 1 && day % 30 === 0) practiceAndTeach(living, ctx, s, rand);

  // --- deaths ---
  handleDeaths(s, living, rand, day, famine, waterCrisis, medbays, crowding, stride, phase);

  // --- yearly mortality bookkeeping (feeds tradition significance) ---
  const yearLen = s.planet.yearLengthDays;
  if (day - s.yearMortality.yearStartDay >= yearLen) {
    const share = s.yearMortality.startPop > 0 ? s.yearMortality.deaths / s.yearMortality.startPop : 0;
    if (!s.worstMortalityYear || share > s.worstMortalityYear.share) {
      s.worstMortalityYear = { endDay: day, share, deaths: s.yearMortality.deaths };
    }
    s.yearMortality = { yearStartDay: day, deaths: 0, startPop: s.colonists.length };
  }

  // --- last Earth memory ---
  if (s.lastEarthMemoryHolderDeathDay === undefined && s.generationsBornOffworld > 0) {
    if (!s.colonists.some((c) => c.bornOnEarth)) {
      s.lastEarthMemoryHolderDeathDay = day;
      s.history.push(
        makeEvent(day, "The Last Earth Memory", `The last colonist who remembered Earth has died. From this day forward, Earth exists only in records, stories, and artifacts. ${s.planet.name} is the only home anyone alive has ever known.`, "culture", undefined, 3)
      );
    }
  }

  // --- governance ---
  if (!s.government.established && s.settlementStage !== "landing_camp" && day > 300 && rand.bool(0.004)) {
    establishGovernment(s, rand, day);
  }
  if (s.factions.length === 0 && day > 200 && pop > 80 && rand.bool(0.002)) {
    emergeFactions(s, rand, day);
  }

  // --- culture ---
  if (day % 120 === 0) formTraditions(s, rand, day, (d, t, desc, cat) => makeEvent(d, t, desc, cat, undefined, 3));
  if (day % 60 === 0) transmitTraditions(s, rand, day, (d, t, desc, cat) => makeEvent(d, t, desc, cat, undefined, 2));

  // --- expeditions ---
  const expP = pol.expeditions === "aggressive" ? 0.8 : pol.expeditions === "cautious" ? 0.15 : 0.4;
  if (day % 60 === 0 && rand.bool(expP) && pop > 40) launchExpedition(s, living, rand, day);
  for (const exp of s.expeditions) {
    if (exp.status === "underway" && day >= exp.returnDay) resolveExpedition(s, rand, exp, day);
  }
  // completed expeditions are history, not live state
  if (s.expeditions.length > 40) {
    s.expeditions = s.expeditions.filter((e) => e.status === "underway").concat(s.expeditions.slice(-20));
  }

  // --- the planet's own hazards ---
  if (day % 30 === 0) strikeHazards(s, rand, day, pop);

  // --- ecology ---
  if (s.ecology.length && day % 90 === 0) updateEcology(s, rand, day, pop);

  // --- settlement stage ---
  const newStage = settlementStageFor(s, pop);
  if (newStage !== s.settlementStage) {
    const order: SettlementStage[] = ["landing_camp", "modular_settlement", "permanent_buildings", "town", "city", "regional_civilization"];
    const declining = order.indexOf(newStage) < order.indexOf(s.settlementStage);
    const stageNames: Record<SettlementStage, string> = {
      landing_camp: "Landing Camp",
      modular_settlement: "Modular Settlement",
      permanent_buildings: "Permanent Settlement",
      town: "Town",
      city: "City",
      regional_civilization: "Regional Civilization",
    };
    s.history.push(
      declining
        ? makeEvent(day, `Decline to ${stageNames[newStage]}`, `Too few people and too little working infrastructure remain to sustain a ${stageNames[s.settlementStage].toLowerCase()}. What is left is a ${stageNames[newStage].toLowerCase()} — population ${pop}.`, "crisis", undefined, 3)
        : makeEvent(day, `A ${stageNames[newStage]} Rises`, `The colony has grown into a ${stageNames[newStage].toLowerCase()} — population ${pop}, ${s.buildings.length} structures.`, "construction", undefined, 3)
    );
    s.settlementStage = newStage;
  }

  s.productionRates = {
    food: Math.round((foodProduced - foodNeeded) * 10) / 10,
    water: Math.round((waterProduced - waterNeeded) * 10) / 10,
    energy: Math.round((energyProduced - energyNeeded) * 10) / 10,
  };

  // --- history archival: never delete canon, but stop the hot path growing ---
  if (s.history.length > 1400) {
    const keep: HistoryEvent[] = [];
    const recentCutoff = day - yearLen * 25;
    for (const h of s.history) {
      if (h.significance >= 2 || h.day >= recentCutoff) keep.push(h);
    }
    s.history = keep;
  }

  return s;
}

function occupationForSkill(skill: Skill): Colonist["occupation"] {
  switch (skill) {
    case "medicine": return "physician";
    case "engineering": return "engineer";
    case "agriculture": return "botanist";
    case "construction": return "laborer";
    case "geology": return "geologist";
    case "ecology": return "ecologist";
    case "leadership": return "commander";
    case "combat": return "security";
    case "cooking": return "cook";
    case "education": return "educator";
    case "fabrication": return "fabricator";
    case "piloting": return "pilot";
    default: return "unskilled";
  }
}

// ---------- lineage-aware partnering ----------

/** Parents, siblings, half-siblings, grandparents and first cousins are excluded. */
function tooCloselyRelated(a: Colonist, b: Colonist, byId: Map<string, Colonist>, s: SimState): boolean {
  const direct = a.relationships.find((r) => r.colonistId === b.id);
  if (direct && (direct.kind === "parent" || direct.kind === "child" || direct.kind === "sibling")) return true;

  const parentsOf = (c: Colonist) => c.relationships.filter((r) => r.kind === "parent").map((r) => r.colonistId);
  const aP = parentsOf(a);
  const bP = parentsOf(b);
  if (aP.some((p) => bP.includes(p))) return true; // shares a parent
  if (aP.includes(b.id) || bP.includes(a.id)) return true;

  // grandparents: resolve through living or archived records
  const grandOf = (ids: string[]) => {
    const out: string[] = [];
    for (const id of ids) {
      const liveP = byId.get(id);
      if (liveP) out.push(...parentsOf(liveP));
      else {
        const dead = s.dead.find((d) => d.id === id);
        if (dead) out.push(...dead.parentIds);
      }
    }
    return out;
  };
  const aG = grandOf(aP);
  const bG = grandOf(bP);
  if (aG.includes(b.id) || bG.includes(a.id)) return true;
  if (aG.some((g) => bG.includes(g))) return true; // first cousins
  return false;
}

function formPartnerships(s: SimState, living: Colonist[], rand: Rand) {
  const byId = new Map(living.map((c) => [c.id, c]));
  const eligible = (c: Colonist) => {
    if (c.occupation === "child" || c.ageYears < 18 || c.ageYears > 50 || c.morale < 30) return false;
    const sp = c.relationships.find((r) => r.kind === "spouse");
    if (!sp) return true;
    return !byId.has(sp.colonistId); // widowed
  };
  // Sorting each sex by age lets partners be matched by walking the two lists,
  // so this stays linear as the population grows into the thousands.
  const men = living.filter((c) => c.sex === "male" && eligible(c)).sort((a, b) => a.ageYears - b.ageYears);
  const women = living.filter((c) => c.sex === "female" && eligible(c)).sort((a, b) => a.ageYears - b.ageYears);
  if (!men.length || !women.length) return;

  const takenMen = new Set<string>();
  let lo = 0;
  for (const w of women) {
    if (!rand.bool(0.06)) continue;
    while (lo < men.length && men[lo].ageYears < w.ageYears - 14) lo++;
    let chosen: Colonist | undefined;
    for (let i = lo; i < men.length && men[i].ageYears <= w.ageYears + 14; i++) {
      const m = men[i];
      if (takenMen.has(m.id)) continue;
      if (m.ideology !== w.ideology && !rand.bool(0.4)) continue;
      if (tooCloselyRelated(w, m, byId, s)) continue;
      chosen = m;
      break;
    }
    if (!chosen) continue;
    takenMen.add(chosen.id);
    w.relationships = w.relationships.filter((r) => r.kind !== "spouse");
    chosen.relationships = chosen.relationships.filter((r) => r.kind !== "spouse");
    w.relationships.push({ colonistId: chosen.id, kind: "spouse" });
    chosen.relationships.push({ colonistId: w.id, kind: "spouse" });
  }
}

function handleBirths(
  s: SimState,
  living: Colonist[],
  rand: Rand,
  day: number,
  pol: SimState["policy"],
  famine: boolean,
  crowding: number,
  stride: number,
  phase: number
) {
  const byId = new Map(living.map((c) => [c.id, c]));
  for (let i = phase; i < living.length; i += stride) {
    const c = living[i];
    if (c.sex !== "female" || c.health.pregnant || c.ageYears < 18 || c.ageYears > 44) continue;
    const spouseRel = c.relationships.find((r) => r.kind === "spouse");
    if (!spouseRel) continue;
    if (!byId.has(spouseRel.colonistId)) continue;
    const settled = s.settlementStage !== "landing_camp";
    let baseP = settled ? 0.0011 : 0.0004;
    baseP *= pol.birthPolicy === "encouraged" ? 1.7 : pol.birthPolicy === "restricted" ? 0.35 : 1;
    // families respond to conditions, not just policy
    baseP *= Math.max(0.15, 1 - crowding * 0.7);
    if (s.resources.medicine <= 0) baseP *= 0.75;
    baseP *= demographicTransition(s) * stride; // cohort visited every `stride` days
    if (c.morale > 40 && !famine && rand.bool(baseP)) {
      c.health.pregnant = true;
      c.health.pregnancyDueDay = day + 266;
    }
  }

  for (const c of living) {
    if (!c.health.pregnant || c.health.pregnancyDueDay === undefined || day < c.health.pregnancyDueDay) continue;
    c.health.pregnant = false;
    c.health.pregnancyDueDay = undefined;

    const baby = generateColonist(rand, s.colonists.length + s.dead.length, day);
    baby.ageYears = 0;
    baby.birthDay = day;
    baby.bornOnEarth = false;
    baby.occupation = "child";
    baby.skills = {};
    baby.skillCeiling = {};
    baby.possessions = [];
    baby.goals = [];
    baby.fears = [];
    baby.health = { physical: rand.int(80, 100), mental: 80, chronicConditions: [], injured: false };
    baby.morale = 70;
    baby.generation = c.generation + 1;
    s.maxAncestryDepth = Math.max(s.maxAncestryDepth, baby.generation);

    const motherSurname = c.name.split(" ").slice(-1)[0];
    const earthBornShare = living.filter((x) => x.bornOnEarth).length / Math.max(1, living.length);
    const driftChance = 1 - earthBornShare;
    baby.name = rand.bool(driftChance * 0.85)
      ? generateOffworldName(baby.sex, (arr) => rand.pick(arr), motherSurname)
      : `${baby.name.split(" ")[0]} ${motherSurname}`;
    baby.ideology = rand.bool(0.6) ? c.ideology : baby.ideology;

    baby.relationships = [{ colonistId: c.id, kind: "parent" }];
    c.relationships.push({ colonistId: baby.id, kind: "child" });
    const spouseRel = c.relationships.find((r) => r.kind === "spouse");
    const dad = spouseRel ? byId.get(spouseRel.colonistId) : undefined;
    if (dad) {
      baby.relationships.push({ colonistId: dad.id, kind: "parent" });
      dad.relationships.push({ colonistId: baby.id, kind: "child" });
    }
    // link siblings explicitly so families are real and partnering can exclude them
    const siblingIds = new Set<string>();
    for (const parent of [c, dad]) {
      if (!parent) continue;
      for (const r of parent.relationships) {
        if (r.kind === "child" && r.colonistId !== baby.id) siblingIds.add(r.colonistId);
      }
    }
    for (const sid of siblingIds) {
      const sib = byId.get(sid);
      if (!sib) continue;
      baby.relationships.push({ colonistId: sib.id, kind: "sibling" });
      sib.relationships.push({ colonistId: baby.id, kind: "sibling" });
    }

    s.colonists.push(baby);
    byId.set(baby.id, baby);
    s.generationsBornOffworld += 1;
    s.births += 1;
    s.stats.births += 1;

    if (s.generationsBornOffworld === 1) {
      s.history.push(
        makeEvent(day, "First Birth", `${baby.name} became the first human born on ${s.planet.name} — the first of a generation that will never know Earth.`, "birth", [baby.id, c.id], 3)
      );
    } else if (rand.bool(0.04)) {
      s.history.push(makeEvent(day, `Birth: ${baby.name}`, `${c.name} gave birth to ${baby.name}.`, "birth", [baby.id, c.id], 1));
    }
  }
}

/**
 * Families in a settled, schooled colony where children reliably survive have
 * fewer of them. This is the ordinary demographic transition, and it is what
 * turns early exponential growth into a levelling-off — not a population cap.
 */
function demographicTransition(s: SimState): number {
  const pop = s.colonists.length;
  // Families read the food situation long before it becomes a famine. A colony
  // living close to the edge of what its farmland yields has fewer children.
  const farmCapacity = s.buildings.filter((b) => b.type === "farm_dome" && b.condition > 25).length * FARM_YIELD * 0.8;
  const margin = farmCapacity / Math.max(1, pop);
  const security = margin >= 1.25 ? 1 : Math.max(0.08, (margin - 0.9) / 0.35);
  if (pop < 150) return Math.max(0.25, security);
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const schooling = Math.min(1, schools / Math.max(1, pop / 190));
  const medicated = s.resources.medicine > pop * 1.2 ? 1 : s.resources.medicine / Math.max(1, pop * 1.2);
  const urban = Math.min(1, (pop - 150) / 900);
  // security and education together depress fertility; scarcity pushes it back up
  const factor = 1 - 0.62 * urban * (0.45 + 0.35 * schooling + 0.2 * medicated);
  return Math.max(0.05, factor * security);
}

function archiveColonist(c: Colonist, day: number): ArchivedColonist {
  let topSkill: { skill: Skill; level: number } | undefined;
  for (const key in c.skills) {
    const v = c.skills[key as Skill] ?? 0;
    if (!topSkill || v > topSkill.level) topSkill = { skill: key as Skill, level: v };
  }
  return {
    id: c.id,
    name: c.name,
    sex: c.sex,
    birthDay: c.birthDay,
    deathDay: day,
    deathCause: c.deathCause ?? "unknown",
    occupation: c.occupation,
    bornOnEarth: c.bornOnEarth,
    ageAtDeath: c.ageYears,
    parentIds: c.relationships.filter((r) => r.kind === "parent").map((r) => r.colonistId),
    childIds: c.relationships.filter((r) => r.kind === "child").map((r) => r.colonistId),
    topSkill,
  };
}

function handleDeaths(
  s: SimState,
  living: Colonist[],
  rand: Rand,
  day: number,
  famine: boolean,
  waterCrisis: boolean,
  medbays: number,
  crowding: number,
  stride: number,
  phase: number
) {
  const medSkill = skillTotal("medicine");
  const removed: Colonist[] = [];

  for (let i = phase; i < living.length; i += stride) {
    const c = living[i];
    let mortality = 0.0000008 * Math.pow(1.09, c.ageYears) * stride;
    if (famine) mortality *= 6;
    if (waterCrisis) mortality *= 8;
    if (crowding > 0.4) mortality *= 1 + crowding; // crowding spreads illness
    if (c.health.chronicConditions.length && s.resources.medicine < 10) mortality *= 4;
    if (c.health.physical < 30) mortality *= 3;
    if (medbays > 0 && medSkill > 100 && s.resources.medicine > 5) mortality *= 0.55;
    if (!rand.bool(mortality)) continue;

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
    s.stats.deaths += 1;
    s.yearMortality.deaths += 1;
    removed.push(c);

    // was this the last person who could do something?
    let lastOfTrade: Skill | undefined;
    for (const key in c.skills) {
      const sk = key as Skill;
      if ((c.skills[sk] ?? 0) < 45) continue;
      const others = (ctx.practitioners[sk] ?? 0) - 1;
      if (others <= 0) lastOfTrade = sk;
    }
    const notable =
      lastOfTrade !== undefined ||
      s.government.leaderIds.includes(c.id) ||
      Object.values(c.skills).some((v) => (v ?? 0) > 80);

    if (notable) {
      const loss = lastOfTrade
        ? ` They were the colony's last practitioner of ${lastOfTrade}; unless it can be relearned from records, that knowledge is gone.`
        : "";
      s.history.push(
        makeEvent(day, `Death of ${c.name}`, `${c.name} (${c.occupation}, age ${Math.floor(c.ageYears)}) died of ${c.deathCause}.${loss}`, "death", [c.id], lastOfTrade ? 3 : 2)
      );
    }

    if (s.government.leaderIds.includes(c.id)) {
      s.government.leaderIds = s.government.leaderIds.filter((id) => id !== c.id);
      const successor = bestAt(living.filter((x) => x.alive && x.id !== c.id), "leadership");
      if (successor) {
        s.government.leaderIds.push(successor.id);
        s.history.push(
          makeEvent(day, "Leadership Succession", `${successor.name} assumed leadership after the death of ${c.name}.`, "governance", [successor.id], 2)
        );
      }
    }

    maybePreserveArtifact(s, c, rand, day, lastOfTrade, notable);
  }

  if (removed.length) {
    const ids = new Set(removed.map((r) => r.id));
    s.colonists = s.colonists.filter((c) => !ids.has(c.id));
    for (const r of removed) s.dead.push(archiveColonist(r, day));
  }
}

/**
 * Most possessions are simply lost. An object enters the museum because it has a
 * reason to be kept — it belonged to someone the colony remembers, it is the
 * last of its kind, or it connects to an event that mattered.
 */
function maybePreserveArtifact(
  s: SimState,
  c: Colonist,
  rand: Rand,
  day: number,
  lastOfTrade: Skill | undefined,
  notable: boolean
) {
  if (!c.possessions.length) return;
  let significance = 0;
  const reasons: string[] = [];
  if (c.bornOnEarth) { significance += 40; reasons.push("carried from Earth"); }
  if (lastOfTrade) { significance += 35; reasons.push(`belonged to the last ${lastOfTrade} practitioner`); }
  if (s.government.leaderIds.includes(c.id)) { significance += 30; reasons.push("belonged to a colony leader"); }
  if (notable) significance += 15;
  if (c.generation === 0) significance += 10;
  const museums = activeCount(s, "museum");
  if (museums > 0) significance += 10;
  if (significance < 30) return;
  if (!rand.bool(Math.min(0.6, significance / 140))) return;

  const obj = rand.pick(c.possessions);
  s.museum.push({
    id: `mus-${day}-${s.museum.length}`,
    name: `${obj} (${c.name})`,
    originDay: c.birthDay,
    provenance: [
      `Belonged to ${c.name}, ${c.bornOnEarth ? "Earth-born colonist" : `born on ${s.planet.name} in generation ${c.generation}`}`,
      `Kept after their death on day ${day} (${c.deathCause})`,
      ...(lastOfTrade ? [`They were the last person in the colony who practised ${lastOfTrade}`] : []),
    ],
    significanceReason: reasons.join("; ") || "connected to a remembered life",
    significance,
    archived: false,
  });

  // keep the display legible: lesser objects move to storage rather than being destroyed
  const shown = s.museum.filter((m) => !m.archived);
  if (shown.length > 40) {
    shown
      .sort((a, b) => a.significance - b.significance)
      .slice(0, shown.length - 40)
      .forEach((m) => (m.archived = true));
  }
}

/**
 * The hazards the planet was generated with actually happen. Each one is checked
 * monthly, damages the things it plausibly would, and is written into history.
 * This is what makes an unlucky world genuinely dangerous, gives survivors a
 * past worth marking, and keeps failure possible without being scripted.
 */
function strikeHazards(s: SimState, rand: Rand, day: number, pop: number) {
  const shelterQuality = s.buildings.length
    ? s.buildings.reduce((a, b) => a + b.condition, 0) / s.buildings.length / 100
    : 0.2;
  // better-kept infrastructure and more medics blunt the damage
  const preparedness = Math.min(0.85, shelterQuality * 0.7 + Math.min(0.3, activeCount(s, "medbay") / Math.max(1, pop / 160)) * 0.3);

  for (const hazard of s.planet.hazards) {
    // roughly once every 8-25 local years per hazard, checked monthly
    if (!rand.bool(0.0075)) continue;
    // most events are survivable; a minority are the ones people still talk
    // about generations later
    const severity = rand.bool(0.2) ? rand.float(1.4, 2.6) : rand.float(0.25, 1);
    let killed = 0;
    let note = "";

    if (hazard.includes("storm") || hazard.includes("wind")) {
      const dmg = 45 * severity;
      for (const b of s.buildings) if (rand.bool(0.6)) b.condition = Math.max(0, b.condition - dmg * rand.float(0.4, 1.2));
      killed = Math.round(pop * 0.02 * severity * (1 - preparedness));
      note = `Winds tore across the settlement for days, stripping panels and collapsing weaker structures.`;
    } else if (hazard.includes("flood")) {
      const lost = Math.min(s.resources.food, s.resources.food * 0.6 * severity);
      s.resources.food -= lost;
      s.resources.seeds = Math.max(0, s.resources.seeds - s.resources.seeds * 0.4 * severity);
      for (const b of s.buildings) if (b.type === "farm_dome" && rand.bool(0.75)) b.condition = Math.max(0, b.condition - 55 * severity);
      killed = Math.round(pop * 0.015 * severity * (1 - preparedness));
      note = `Meltwater came down the lowlands and took ${Math.round(lost)} units of stored food with it.`;
    } else if (hazard.includes("seismic")) {
      for (const b of s.buildings) if (rand.bool(0.45)) b.condition = Math.max(0, b.condition - 60 * severity * rand.float(0.5, 1.4));
      killed = Math.round(pop * 0.03 * severity * (1 - preparedness));
      note = `The ground moved along the eastern ridge; masonry and pressure seals failed across the settlement.`;
    } else if (hazard.includes("UV")) {
      for (const b of s.buildings) if (b.type === "farm_dome") b.condition = Math.max(0, b.condition - 30 * severity);
      s.resources.food = Math.max(0, s.resources.food - s.resources.food * 0.45 * severity);
      killed = Math.round(pop * 0.008 * severity * (1 - preparedness));
      note = `A hard summer of ultraviolet burned back the crop under the domes.`;
    } else if (hazard.includes("algal") || hazard.includes("toxic")) {
      s.resources.water = Math.max(0, s.resources.water - s.resources.water * 0.75 * severity);
      s.resources.medicine = Math.max(0, s.resources.medicine - s.resources.medicine * 0.5);
      killed = Math.round(pop * 0.025 * severity * (1 - preparedness));
      note = `A bloom fouled the standing water; the sick filled the medical bay faster than it could treat them.`;
    } else {
      continue;
    }

    // deaths are drawn from actual people, so families and skills really lose them
    const victims: Colonist[] = [];
    for (let k = 0; k < killed && s.colonists.length > 1; k++) {
      const idx = rand.int(0, s.colonists.length - 1);
      const c = s.colonists[idx];
      if (!c || victims.includes(c)) continue;
      victims.push(c);
    }
    for (const c of victims) {
      c.alive = false;
      c.deathDay = day;
      c.deathCause = hazard;
      s.stats.deaths += 1;
      s.yearMortality.deaths += 1;
      s.dead.push(archiveColonist(c, day));
    }
    if (victims.length) {
      const ids = new Set(victims.map((v) => v.id));
      s.colonists = s.colonists.filter((c) => !ids.has(c.id));
    }

    s.history.push(
      makeEvent(
        day,
        `${hazard.replace(/^./, (m) => m.toUpperCase())}`,
        `${note}${victims.length ? ` ${victims.length} colonist${victims.length === 1 ? "" : "s"} died.` : " Nobody was killed."}`,
        "crisis",
        victims.map((v) => v.id),
        victims.length > pop * 0.04 || severity > 0.8 ? 3 : 2
      )
    );
  }
}

function updateEcology(s: SimState, rand: Rand, day: number, pop: number) {
  const footprint = s.buildings.length + pop / 40;
  for (const sp of s.ecology) {
    if (sp.role === "producer") {
      if (footprint > 10) sp.populationIndex = Math.max(2, sp.populationIndex - rand.float(0, footprint / 22));
      else sp.populationIndex = Math.min(100, sp.populationIndex + rand.float(0, 0.4)); // recovers when pressure lifts
    }
  }
  for (const sp of s.ecology.filter((x) => x.role === "consumer")) {
    const base = s.ecology.filter((p) => sp.dependsOn.includes(p.id));
    const avg = base.length ? base.reduce((a, b) => a + b.populationIndex, 0) / base.length : 50;
    if (avg < 25) sp.populationIndex = Math.max(1, sp.populationIndex - rand.float(0.5, 2));
    else if (avg > 55) sp.populationIndex = Math.min(100, sp.populationIndex + rand.float(0, 0.6));
  }
  const collapsed = s.ecology.filter((x) => x.populationIndex < 10 && x.role === "producer");
  const lastNote = s.history.filter((h) => h.title === "Ecological Decline").pop();
  if (collapsed.length && (!lastNote || day - lastNote.day > s.planet.yearLengthDays * 8)) {
    s.history.push(
      makeEvent(day, "Ecological Decline", `Native ${collapsed[0].name} populations near the settlement have collapsed under human expansion. The ecologists' warnings grow sharper.`, "ecology", undefined, 2)
    );
  }
}

function establishGovernment(s: SimState, rand: Rand, day: number) {
  const living = s.colonists;
  const counts = new Map<string, number>();
  for (const c of living) counts.set(c.ideology, (counts.get(c.ideology) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const systems: Record<string, { name: string; laws: string[] }> = {
    collectivist: { name: "The Commons Assembly", laws: ["All land and machinery held in common", "Labor obligations rotate by lottery", "Rations allocated by need"] },
    individualist: { name: "The Charter Republic", laws: ["Personal property recognized", "Labor contracts freely negotiated", "Elected council of seven"] },
    technocratic: { name: "The Technical Directorate", laws: ["Voting weighted by certified expertise", "Resource allocation by systems model", "Mandatory apprenticeships"] },
    traditionalist: { name: "The Founders' Covenant", laws: ["Earth law adopted as precedent", "Family homesteads recognized", "Council of elders arbitrates disputes"] },
    pragmatist: { name: "The Provisional Council", laws: ["Leadership by annual open election", "Emergency powers sunset automatically", "All records public"] },
  };
  const sys = systems[dominant];
  const leaders = [...living]
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
    makeEvent(day, "Constitution Signed", `After long debate between ${[...counts.keys()].slice(0, 3).join(", ")} camps, the colony ratified its first constitution: "${sys.name}". ${leaders[0].name} was chosen to lead.`, "governance", leaders.map((l) => l.id), 3)
  );
}

function emergeFactions(s: SimState, rand: Rand, day: number) {
  const byIdeology = new Map<string, Colonist[]>();
  for (const c of s.colonists) {
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
      makeEvent(day, "Political Factions Form", `Two organized movements have crystallized: ${sorted.map(([i]) => factionNames[i]).join(" and ")}. Debates over land, labor, and law are no longer private matters.`, "governance", undefined, 3)
    );
  }
}

function launchExpedition(s: SimState, living: Colonist[], rand: Rand, day: number) {
  const busy = new Set(s.expeditions.filter((e) => e.status === "underway").flatMap((e) => e.memberIds));
  const candidates = living.filter((c) => c.occupation !== "child" && c.health.physical > 60 && !busy.has(c.id));
  if (candidates.length < 3 || s.resources.fuel < 20) return;
  const team = rand.shuffle(candidates).slice(0, rand.int(3, 5));
  const duration = rand.int(10, 40);
  s.resources.fuel -= 20;
  s.stats.expeditionsLaunched++;
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
  const lossChance = s.policy.expeditions === "aggressive" ? 0.14 : s.policy.expeditions === "cautious" ? 0.03 : 0.08;
  const roll = rand.next();
  if (roll < lossChance) {
    exp.status = "lost";
    s.stats.expeditionsLost++;
    const names: string[] = [];
    for (const id of exp.memberIds) {
      const c = s.colonists.find((x) => x.id === id);
      if (c) {
        c.alive = false;
        c.deathDay = day;
        c.deathCause = "lost on expedition";
        names.push(c.name);
        s.stats.deaths++;
        s.yearMortality.deaths++;
        s.dead.push(archiveColonist(c, day));
      }
    }
    s.colonists = s.colonists.filter((c) => c.alive);
    s.history.push(
      makeEvent(day, "Expedition Lost", `The survey team that departed on day ${exp.departedDay} never returned. ${names.length} colonists are presumed dead${names.length ? `: ${names.join(", ")}` : ""}.`, "exploration", exp.memberIds, 3)
    );
  } else if (roll < 0.2) {
    exp.returnDay = day + rand.int(5, 15);
    exp.status = "underway";
  } else {
    exp.status = "returned";
    const findings = rand.shuffle([
      `mapped a mineral-rich outcrop`,
      "charted a freshwater aquifer",
      "catalogued new native species",
      "found a sheltered valley suitable for future settlement",
      "surveyed a geothermal vent field",
      "recovered fuel-grade hydrocarbons from a tar seep",
    ]).slice(0, rand.int(1, 2));
    exp.findings = findings;
    const caps = storageCaps(s);
    // Survey is how the colony's known world grows. A discovered seam or valley
    // raises the ceiling on how large a civilization this planet can carry.
    let significance: 1 | 2 | 3 = 1;
    if (findings.some((f) => f.includes("mineral"))) {
      // prospecting effort follows need — nobody works up a seam the colony has
      // no use for, so reserves do not pile up without limit
      const glut = s.resourceBase.oreRemaining > 160000;
      // deeper and more distant seams give up less for the same effort
      const depletion = Math.max(0.25, 1 - s.resourceBase.depositsFound / 30);
      const found = glut ? rand.int(1000, 4000) : Math.round(rand.int(15000, 40000) * depletion);
      s.resourceBase.oreKnown += found;
      s.resourceBase.oreRemaining += found;
      if (!glut) {
        s.resourceBase.depositsFound += 1;
        significance = 2;
      }
    }
    if (findings.some((f) => f.includes("valley"))) {
      // The good ground close to the settlement is found first. Each further
      // valley is further out and harder to work, so farmland — and with it the
      // population this territory can feed — approaches a real ceiling.
      const reach = Math.max(0, 3 - Math.floor(s.resourceBase.valleysFound / 4));
      if (reach > 0) {
        s.resourceBase.arableSites += rand.int(1, reach);
        s.resourceBase.valleysFound += 1;
        significance = 2;
      }
    }
    if (findings.some((f) => f.includes("fuel"))) {
      s.resources.fuel = Math.min(caps.fuel, s.resources.fuel + rand.int(60, 160));
    }
    if (findings.some((f) => f.includes("aquifer"))) {
      s.resources.water = Math.min(caps.water, s.resources.water + rand.int(400, 1200));
    }
    if (findings.some((f) => f.includes("species"))) {
      for (const sp of s.ecology) sp.populationIndex = Math.min(100, sp.populationIndex + rand.float(0, 3));
      s.resources.seeds = Math.min(caps.seeds, s.resources.seeds + rand.int(20, 80));
    }
    if (significance > 1 || rand.bool(0.15)) {
      s.history.push(
        makeEvent(day, "Expedition Returns", `The survey team returned after ${day - exp.departedDay} days. They ${findings.join("; ")}.`, "exploration", exp.memberIds, significance)
      );
    }
  }
}

// ---------- driver ----------

export { makeEvent };

export function simulateDays(state: SimState, days: number, rand: Rand): SimState {
  let s = state;
  for (let i = 0; i < days; i++) {
    s = tick(s, rand);
    if (s.colonists.length === 0) {
      if (s.extinctDay === undefined) {
        s.extinctDay = s.day;
        s.history.push(makeEvent(s.day, "Colony Extinct", `The last colonist has died. ${s.planet.name} keeps only the ruins.`, "death", undefined, 3));
      }
      break;
    }
  }
  return s;
}
