import { Rand } from "./rng";
import type { Archive, Colonist, SimState, Skill, TechLevel } from "./types";

export const ALL_SKILLS: Skill[] = [
  "medicine", "engineering", "agriculture", "construction", "geology",
  "ecology", "leadership", "combat", "cooking", "education", "fabrication", "piloting",
];

// A trade counts as practised at this level; below it a person cannot teach it.
export const PRACTITIONER_THRESHOLD = 30;
export const TEACHER_THRESHOLD = 45;

// How many practitioners a colony of a given size needs in each trade. These set
// what apprenticeships get steered toward — scarcity in a needed trade is what
// makes a school direct a youth into it.
const NEED_PER_CAPITA: Record<Skill, number> = {
  agriculture: 1 / 30,
  construction: 1 / 35,
  engineering: 1 / 45,
  fabrication: 1 / 55,
  medicine: 1 / 70,
  cooking: 1 / 70,
  education: 1 / 80,
  geology: 1 / 110,
  ecology: 1 / 130,
  leadership: 1 / 110,
  combat: 1 / 110,
  piloting: 1 / 180,
};

export interface KnowledgeContext {
  pools: Partial<Record<Skill, number>>; // summed proficiency of the living
  practitioners: Partial<Record<Skill, number>>; // living people at/above threshold
  teachers: Partial<Record<Skill, Colonist[]>>; // living people who could teach
  pop: number;
}

export function buildKnowledgeContext(living: Colonist[]): KnowledgeContext {
  const pools: Partial<Record<Skill, number>> = {};
  const practitioners: Partial<Record<Skill, number>> = {};
  const teachers: Partial<Record<Skill, Colonist[]>> = {};
  for (const c of living) {
    for (const key in c.skills) {
      const s = key as Skill;
      const v = c.skills[s] ?? 0;
      pools[s] = (pools[s] ?? 0) + v;
      if (v >= PRACTITIONER_THRESHOLD) practitioners[s] = (practitioners[s] ?? 0) + 1;
      if (v >= TEACHER_THRESHOLD) (teachers[s] ??= []).push(c);
    }
  }
  return { pools, practitioners, teachers, pop: living.length };
}

/** Unmet demand for each trade, as a positive shortfall count. */
export function tradeNeeds(ctx: KnowledgeContext): [Skill, number][] {
  const out: [Skill, number][] = [];
  for (const s of ALL_SKILLS) {
    const target = Math.max(1, Math.round(ctx.pop * NEED_PER_CAPITA[s]));
    const have = ctx.practitioners[s] ?? 0;
    const shortfall = target - have;
    if (shortfall > 0) out.push([s, shortfall]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

// ---------- archives ----------

export function archiveIntegrity(s: SimState, topic: Archive["topics"][number]): number {
  let best = 0;
  for (const a of s.archives) {
    if (a.topics.includes(topic)) best = Math.max(best, a.integrity);
  }
  return best;
}

/**
 * Archives decay unless an institution keeps them. A school copies and teaches
 * from them; a museum preserves them. With neither, records rot and are
 * eventually unreadable — which is how knowledge becomes permanently lost.
 */
export function decayArchives(s: SimState, rand: Rand) {
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const museums = s.buildings.filter((b) => b.type === "museum" && b.condition > 25).length;
  const literate = (s.knowledgeCtxPool.education ?? 0) > 60;
  for (const a of s.archives) {
    if (schools > 0 && literate) {
      // recopied and taught from, but every copy loses something: an actively
      // maintained archive stays usable without ever being pristine again
      a.integrity = Math.min(92, a.integrity + 0.02);
      if (a.integrity >= 92) a.integrity -= 0.001;
      a.maintainedBy = "school";
    } else if (museums > 0) {
      a.integrity = Math.min(70, a.integrity + 0.002);
      a.maintainedBy = "museum";
    } else {
      a.integrity = Math.max(0, a.integrity - rand.float(0.004, 0.012));
      a.maintainedBy = "none";
    }
  }
}

// ---------- apprenticeship: how generation N+1 actually acquires a trade ----------

export interface ApprenticeResult {
  skill: Skill | null;
  level: number;
  via: "school" | "parent" | "practitioner" | "archive" | "none";
  teacherName?: string;
}

/**
 * A youth entering adulthood takes up a trade. They can only learn from a living
 * practitioner, from a parent, or — at a heavy penalty — from surviving written
 * records. If none of those exist, they learn nothing and the trade stays lost.
 */
export function apprentice(
  youth: Colonist,
  all: Colonist[],
  ctx: KnowledgeContext,
  s: SimState,
  rand: Rand
): ApprenticeResult {
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const needs = tradeNeeds(ctx);

  // A school directs youths into the trades the colony most lacks; without one,
  // people mostly follow their parents or whoever will take an apprentice.
  let chosen: Skill | null = null;
  const parents = youth.relationships
    .filter((r) => r.kind === "parent")
    .map((r) => all.find((x) => x.id === r.colonistId))
    .filter((c): c is Colonist => !!c);

  if (schools > 0 && needs.length > 0) {
    const top = needs.slice(0, 3);
    chosen = rand.weighted(top.map(([sk, n]) => [sk, n] as [Skill, number]));
  } else {
    const parentTrades = parents.flatMap((p) =>
      (Object.entries(p.skills) as [Skill, number][]).filter(([, v]) => v >= PRACTITIONER_THRESHOLD).map(([sk]) => sk)
    );
    if (parentTrades.length && rand.bool(0.6)) {
      chosen = rand.pick(parentTrades);
    } else if (needs.length > 0) {
      chosen = rand.weighted(needs.map(([sk, n]) => [sk, n] as [Skill, number]));
    }
  }
  if (!chosen) return { skill: null, level: 0, via: "none" };

  const pool = ctx.teachers[chosen] ?? [];
  // A parent who practises the trade teaches it more reliably than a stranger.
  const parentTeacher = parents.find((p) => (p.skills[chosen!] ?? 0) >= TEACHER_THRESHOLD);
  const best = pool.length
    ? pool.reduce((a, b) => ((b.skills[chosen!] ?? 0) > (a.skills[chosen!] ?? 0) ? b : a))
    : undefined;

  const eduBonus = schools > 0 ? rand.int(8, 16) : rand.int(0, 6);

  if (schools > 0 && best) {
    // institutional training: taught by the best available practitioner
    const lvl = Math.round((best.skills[chosen] ?? 0) * rand.float(0.62, 0.8)) + eduBonus;
    youth.skills[chosen] = Math.min(92, Math.max(youth.skills[chosen] ?? 0, lvl));
    return { skill: chosen, level: youth.skills[chosen]!, via: "school", teacherName: best.name };
  }
  if (parentTeacher) {
    const lvl = Math.round((parentTeacher.skills[chosen] ?? 0) * rand.float(0.5, 0.72)) + eduBonus;
    youth.skills[chosen] = Math.min(92, Math.max(youth.skills[chosen] ?? 0, lvl));
    return { skill: chosen, level: youth.skills[chosen]!, via: "parent", teacherName: parentTeacher.name };
  }
  if (best) {
    const lvl = Math.round((best.skills[chosen] ?? 0) * rand.float(0.45, 0.68)) + eduBonus;
    youth.skills[chosen] = Math.min(92, Math.max(youth.skills[chosen] ?? 0, lvl));
    return { skill: chosen, level: youth.skills[chosen]!, via: "practitioner", teacherName: best.name };
  }

  // Nobody alive practises it. Written records give a slow, partial recovery —
  // and only if the records are still readable and someone can read them.
  // Reading a trade out of a book without anyone to show you is slow, uncertain,
  // and only ever gets you part of the way. Most attempts come to nothing, which
  // is why a trade with no living practitioner can stay lost for generations.
  const integrity = archiveIntegrity(s, "technical");
  const canRead = schools > 0 && (ctx.pools.education ?? 0) > 60;
  if (integrity > 45 && canRead && rand.bool(0.10)) {
    const lvl = Math.round(integrity * rand.float(0.10, 0.22));
    if (lvl > 5) {
      youth.skills[chosen] = Math.min(38, Math.max(youth.skills[chosen] ?? 0, lvl));
      return { skill: chosen, level: youth.skills[chosen]!, via: "archive" };
    }
  }
  return { skill: null, level: 0, via: "none" };
}

/**
 * Working adults slowly improve at what they actually do, and experts pass on
 * skill to whoever is short of it. This is the ongoing half of transmission.
 */
export function practiceAndTeach(living: Colonist[], ctx: KnowledgeContext, s: SimState, rand: Rand) {
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const needs = tradeNeeds(ctx);
  const needSet = new Set(needs.slice(0, 4).map(([sk]) => sk));

  // practice: everyone gets slowly better at their strongest trade while working
  for (const c of living) {
    if (c.occupation === "child" || c.ageYears > 68) continue;
    let bestSkill: Skill | null = null;
    let bestVal = 0;
    for (const key in c.skills) {
      const v = c.skills[key as Skill] ?? 0;
      if (v > bestVal) { bestVal = v; bestSkill = key as Skill; }
    }
    if (bestSkill && bestVal < 88 && rand.bool(0.35)) {
      c.skills[bestSkill] = Math.min(92, bestVal + 1);
    }
  }

  // deliberate teaching into shortfall trades
  const sessions = Math.min(14, Math.ceil(living.length / 30));
  for (let i = 0; i < sessions; i++) {
    const skill = needs.length ? rand.weighted(needs.map(([sk, n]) => [sk, n] as [Skill, number])) : null;
    if (!skill) break;
    const pool = ctx.teachers[skill];
    if (!pool || !pool.length) continue;
    const teacher = rand.pick(pool);
    const students = living.filter(
      (c) => c.id !== teacher.id && c.occupation !== "child" && c.ageYears < 55 && (c.skills[skill] ?? 0) < (teacher.skills[skill] ?? 0) - 10
    );
    if (!students.length) continue;
    // an unskilled adult retrained into a needed trade is how a colony recovers
    const student = rand.pick(students);
    const gain = (schools > 0 ? rand.int(2, 5) : rand.int(1, 3)) * (needSet.has(skill) ? 2 : 1);
    student.skills[skill] = Math.min(88, (student.skills[skill] ?? 0) + gain);
  }
}

// ---------- technology as practical capability, not an unlocked flag ----------

const TECH_SKILL: Record<keyof TechLevel, Skill> = {
  manufacturing: "fabrication",
  medicine: "medicine",
  agriculture: "agriculture",
  energy: "engineering",
  construction: "construction",
};

const TECH_BUILDING: Record<keyof TechLevel, string[]> = {
  manufacturing: ["workshop", "refinery"],
  medicine: ["medbay"],
  agriculture: ["farm_dome"],
  energy: ["power_station"],
  construction: ["workshop"],
};

/**
 * A society can know something in principle and still lack the people, tools and
 * power to do it. Tech tracks what the colony can actually practise: it follows
 * living expertise and working infrastructure, falls faster than it recovers,
 * and archives only soften the fall rather than preventing it.
 */
export function updateTech(s: SimState, ctx: KnowledgeContext) {
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const technical = archiveIntegrity(s, "technical");
  for (const field of Object.keys(TECH_SKILL) as (keyof TechLevel)[]) {
    const skill = TECH_SKILL[field];
    const practitioners = ctx.practitioners[skill] ?? 0;
    const pool = ctx.pools[skill] ?? 0;
    const infra = s.buildings.filter(
      (b) => TECH_BUILDING[field].includes(b.type) && b.condition > 25
    ).length;

    // Capability is measured against the size of the society that has to be
    // supported. A thousand people need proportionally more engineers than a
    // hundred do, so a growing colony can lose ground without anyone dying, and
    // absolute head-counts never saturate the measure.
    const pop = Math.max(1, ctx.pop);
    const wantedPractitioners = Math.max(1, pop / 60);
    const density = Math.min(1, practitioners / wantedPractitioners);
    const avgSkill = practitioners > 0 ? pool / practitioners : 0;
    const mastery = Math.min(1, avgSkill / 80);
    const wantedInfra = Math.max(1, pop / 200);
    const infraAdequacy = Math.min(1, infra / wantedInfra);
    // written knowledge props up practice a little, but cannot replace practitioners
    const archiveTerm = technical > 40 && schools > 0 ? 0.06 : 0;

    const target = Math.max(
      0,
      Math.min(100, 100 * (0.5 * density + 0.28 * mastery + 0.16 * infraAdequacy + archiveTerm))
    );

    const cur = s.tech[field];
    // losing a capability is quick; rebuilding it takes a generation
    const rate = target < cur ? 0.010 : schools > 0 ? 0.0045 : 0.0022;
    s.tech[field] = Math.max(0, Math.min(100, cur + (target - cur) * rate));
  }
}

// ---------- Earth memory, derived from actual information distance ----------

export type EarthUnderstanding = "lived" | "secondhand" | "taught" | "cultural" | "mythic" | "none";

export interface EarthKnowledge {
  level: EarthUnderstanding;
  source: string;
  detail: string;
}

/**
 * What a given person can know about Earth, derived from who they could have
 * heard it from and which institutions survive — never from the fact that the
 * simulation happens to store Earth in memory.
 */
export function earthKnowledge(s: SimState, c: Colonist): EarthKnowledge {
  if (c.bornOnEarth) {
    return { level: "lived", source: "personal memory", detail: "Remembers Earth first-hand." };
  }

  const find = (id: string) => s.colonists.find((x) => x.id === id);
  // did they grow up around someone who was actually there?
  const parents = c.relationships.filter((r) => r.kind === "parent").map((r) => find(r.colonistId)).filter(Boolean) as Colonist[];
  const grandparents = parents.flatMap((p) =>
    p.relationships.filter((r) => r.kind === "parent").map((r) => find(r.colonistId)).filter(Boolean) as Colonist[]
  );
  const elders = [...parents, ...grandparents];
  const earthBornElder = elders.find((e) => e.bornOnEarth);
  if (earthBornElder) {
    // they only heard it firsthand if that elder was alive during their childhood
    const overlap = (earthBornElder.deathDay ?? s.day) - c.birthDay;
    if (overlap > 365 * 6) {
      return {
        level: "secondhand",
        source: `${earthBornElder.name}`,
        detail: `Heard Earth described directly by ${earthBornElder.name}, who was born there.`,
      };
    }
  }

  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const earthArchive = archiveIntegrity(s, "earth_history");
  if (schools > 0 && earthArchive > 45) {
    return {
      level: "taught",
      source: "school curriculum",
      detail: `Taught Earth history at school from records that are ${Math.round(earthArchive)}% intact.`,
    };
  }

  const blueWorld = s.traditions.find((t) => t.id === "t-blue-world" && t.observance > 15);
  if (blueWorld) {
    const mythic = earthArchive < 25;
    return {
      level: mythic ? "mythic" : "cultural",
      source: blueWorld.name,
      detail: mythic
        ? `Knows Earth only as ${blueWorld.name} — a story about origin and loss, no longer checked against records.`
        : `Knows Earth through ${blueWorld.name}, the colony's cultural memory of it.`,
    };
  }

  if (earthArchive > 20) {
    return {
      level: "taught",
      source: "surviving records",
      detail: `Could read about Earth in records that are ${Math.round(earthArchive)}% intact, if they sought them out.`,
    };
  }

  return { level: "none", source: "—", detail: "Has no available account of Earth at all." };
}

/** Which traditions this person could actually have learned, and how. */
export function traditionsKnownBy(s: SimState, c: Colonist): { name: string; how: string }[] {
  const out: { name: string; how: string }[] = [];
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  for (const t of s.traditions) {
    if (t.observance < 10) continue; // effectively no longer practised
    if (t.foundedDay > c.birthDay + 365 * 4) {
      out.push({ name: t.name, how: "began in their own lifetime" });
    } else if (t.observance > 55) {
      out.push({ name: t.name, how: "widely observed; grew up inside it" });
    } else if (schools > 0) {
      out.push({ name: t.name, how: "taught as colony history at school" });
    } else {
      out.push({ name: t.name, how: "kept by their family" });
    }
  }
  return out;
}

export function createFoundingArchives(): Archive[] {
  return [
    {
      id: "arc-ship-library",
      name: "Ship's Library",
      kind: "ship_library",
      createdDay: 0,
      integrity: 100,
      topics: ["earth_history", "technical", "medical"],
      maintainedBy: "none",
    },
  ];
}
