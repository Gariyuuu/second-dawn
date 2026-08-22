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

/**
 * How badly each trade needs new entrants. A shortfall counts heavily, but even
 * a fully staffed trade needs replacements as its practitioners age out — so
 * this never returns empty while anyone is practising anything. A colony that
 * stopped training the moment it was adequately staffed would lose every trade
 * to old age within a generation.
 */
export function tradeNeeds(ctx: KnowledgeContext): [Skill, number][] {
  const out: [Skill, number][] = [];
  for (const s of ALL_SKILLS) {
    const target = Math.max(1, Math.round(ctx.pop * NEED_PER_CAPITA[s]));
    const have = ctx.practitioners[s] ?? 0;
    const shortfall = target - have;
    if (shortfall > 0) {
      out.push([s, shortfall + 1]);
    } else if (have > 0) {
      // replacement demand: thinner trades still attract proportionally more
      out.push([s, Math.max(0.15, target / (have + 1))]);
    }
  }
  return out.sort((a, b) => b[1] - a[1]);
}

// ---------- archives ----------

export const ARCHIVE_TOPIC_FOR: Partial<Record<Skill, Archive["topics"][number]>> = {
  medicine: "medical",
  engineering: "technical",
  fabrication: "technical",
  construction: "technical",
  geology: "technical",
  agriculture: "technical",
  ecology: "technical",
  piloting: "technical",
  education: "colony_history",
  leadership: "colony_history",
  cooking: "colony_history",
  combat: "colony_history",
};

export function archiveIntegrity(s: SimState, topic: Archive["topics"][number]): number {
  let best = 0;
  for (const a of s.archives) {
    if (a.topics.includes(topic)) best = Math.max(best, a.integrity);
  }
  return best;
}

/** The deepest level of a trade that surviving records actually capture. */
export function recordedDepth(s: SimState, skill: Skill): number {
  let best = 0;
  for (const a of s.archives) best = Math.max(best, a.recordedDepth[skill] ?? 0);
  return best;
}

/**
 * Practitioners write down what they know — but only while they are alive to do
 * it, and only well when there are literate institutions to write into. Records
 * therefore lag living practice and can never lead it, which is why a field that
 * nobody ever mastered is a field no archive can teach.
 */
export function documentKnowledge(s: SimState, ctx: KnowledgeContext, rand: Rand) {
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  if (!schools) return;
  const literacy = Math.min(1, (ctx.pools.education ?? 0) / 400);
  if (literacy < 0.05) return;
  const archive = s.archives.find((a) => a.topics.includes("technical"));
  if (!archive) return;

  for (const sk of ALL_SKILLS) {
    // the best living practice is what stands to be written down
    let bestLevel = 0;
    for (const t of ctx.teachers[sk] ?? []) bestLevel = Math.max(bestLevel, t.skills[sk] ?? 0);
    if (bestLevel <= 0) continue;
    const target = bestLevel * (0.6 + 0.35 * literacy);
    const cur = archive.recordedDepth[sk] ?? 0;
    if (cur < target) {
      archive.recordedDepth[sk] = Math.min(target, cur + rand.float(0.01, 0.05));
    }
  }
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

  // A school makes transmission faithful and well organised; it cannot pass on
  // more than its teachers actually know.
  const learnFrom = (teacher: Colonist, fidelity: number, ceilingShare: number, via: ApprenticeResult["via"]) => {
    const teacherLevel = teacher.skills[chosen!] ?? 0;
    const lvl = Math.round(teacherLevel * fidelity) + eduBonus;
    youth.skills[chosen!] = Math.min(92, Math.max(youth.skills[chosen!] ?? 0, lvl));
    // you can approach, and just occasionally better, the practice you were shown
    youth.skillCeiling[chosen!] = Math.max(
      youth.skillCeiling[chosen!] ?? 0,
      Math.min(94, Math.round(teacherLevel * ceilingShare) + eduBonus)
    );
    return { skill: chosen!, level: youth.skills[chosen!]!, via, teacherName: teacher.name };
  };

  if (schools > 0 && best) return learnFrom(best, rand.float(0.62, 0.8), rand.float(0.95, 1.03), "school");
  if (parentTeacher) return learnFrom(parentTeacher, rand.float(0.5, 0.72), rand.float(0.86, 0.96), "parent");
  if (best) return learnFrom(best, rand.float(0.45, 0.68), rand.float(0.82, 0.93), "practitioner");

  // Nobody alive practises it. Records carry the theory of a trade forward, but
  // only as deeply as someone once troubled to write it down and only as clearly
  // as the copies survived. What comes back is book-learning: practical
  // competence has to be rebuilt by doing, across generations.
  const topic = ARCHIVE_TOPIC_FOR[chosen] ?? "technical";
  const integrity = archiveIntegrity(s, topic);
  const documented = recordedDepth(s, chosen);
  const canRead = schools > 0 ? (ctx.pools.education ?? 0) > 30 : (ctx.pools.education ?? 0) > 90;
  const chance = schools > 0 ? 0.4 : 0.12;
  if (integrity > 25 && documented > 15 && canRead && rand.bool(chance)) {
    const theory = documented * (integrity / 100);
    const lvl = Math.round(theory * rand.float(0.28, 0.45));
    if (lvl > 4) {
      youth.skills[chosen] = Math.max(youth.skills[chosen] ?? 0, lvl);
      // theory without a master sits well short of practical mastery
      youth.skillCeiling[chosen] = Math.max(
        youth.skillCeiling[chosen] ?? 0,
        Math.round(theory * rand.float(0.5, 0.68))
      );
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

  // Practice carries a person toward the level of practice they were shown, and
  // no further. Getting past that means rediscovering it — which only the best
  // practitioner alive can attempt, only with the tools to try it on, and only
  // slowly enough that it takes generations rather than years.
  for (const c of living) {
    if (c.occupation === "child" || c.ageYears > 68) continue;
    let bestSkill: Skill | null = null;
    let bestVal = 0;
    for (const key in c.skills) {
      const v = c.skills[key as Skill] ?? 0;
      if (v > bestVal) { bestVal = v; bestSkill = key as Skill; }
    }
    if (!bestSkill) continue;
    const ceiling = c.skillCeiling[bestSkill] ?? Math.max(bestVal, 55);
    if (bestVal < ceiling && rand.bool(0.35)) {
      c.skills[bestSkill] = Math.min(92, Math.min(ceiling, bestVal + 1));
    } else if (bestVal >= ceiling && ceiling < 92) {
      const frontier = ctx.teachers[bestSkill] ?? [];
      const isForemost = frontier.every((t) => (t.skills[bestSkill!] ?? 0) <= bestVal + 1);
      const hasWorkshop = s.buildings.some((b) => b.type === "workshop" && b.condition > 25);
      if (isForemost && hasWorkshop && rand.bool(0.06)) {
        c.skillCeiling[bestSkill] = Math.min(92, ceiling + 1); // incremental rediscovery
      }
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
    // Being taught raises what this student can reach, but only toward what the
    // teacher themselves can do.
    const teacherLevel = teacher.skills[skill] ?? 0;
    const raised = Math.min(94, Math.round(teacherLevel * (schools > 0 ? 0.95 : 0.86)));
    student.skillCeiling[skill] = Math.max(student.skillCeiling[skill] ?? 0, raised);
    const ceiling = student.skillCeiling[skill] ?? raised;
    student.skills[skill] = Math.min(88, Math.min(ceiling, (student.skills[skill] ?? 0) + gain));
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
  // The mission shipped with reference material covering the trades it selected
  // for — thorough on engineering and medicine, thinner on everything else.
  const recordedDepth: Partial<Record<Skill, number>> = {
    engineering: 72, medicine: 70, agriculture: 62, construction: 60,
    fabrication: 58, geology: 50, ecology: 45, piloting: 48,
    education: 40, cooking: 35, leadership: 30, combat: 30,
  };
  return [
    {
      id: "arc-ship-library",
      name: "Ship's Library",
      kind: "ship_library",
      createdDay: 0,
      integrity: 100,
      topics: ["earth_history", "technical", "medical", "colony_history"],
      maintainedBy: "none",
      recordedDepth,
    },
  ];
}
