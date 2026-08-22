import type { ArchivedColonist, Colonist, SimState, Skill } from "./types";

/**
 * A uniform view over someone who may be living or long dead. Dead colonists are
 * archived out of the simulation's hot path, but descendants and history still
 * need to be able to name them, so every lookup resolves against both.
 */
export interface PersonView {
  id: string;
  name: string;
  alive: boolean;
  bornOnEarth: boolean;
  birthDay: number;
  deathDay?: number;
  deathCause?: string;
  occupation: string;
  generation: number;
  parentIds: string[];
  childIds: string[];
  topSkill?: { skill: Skill; level: number };
}

export function viewOfLiving(c: Colonist): PersonView {
  let topSkill: { skill: Skill; level: number } | undefined;
  for (const key in c.skills) {
    const v = c.skills[key as Skill] ?? 0;
    if (!topSkill || v > topSkill.level) topSkill = { skill: key as Skill, level: v };
  }
  return {
    id: c.id,
    name: c.name,
    alive: true,
    bornOnEarth: c.bornOnEarth,
    birthDay: c.birthDay,
    occupation: c.occupation,
    generation: c.generation,
    parentIds: c.relationships.filter((r) => r.kind === "parent").map((r) => r.colonistId),
    childIds: c.relationships.filter((r) => r.kind === "child").map((r) => r.colonistId),
    topSkill,
  };
}

export function viewOfDead(a: ArchivedColonist): PersonView {
  return {
    id: a.id,
    name: a.name,
    alive: false,
    bornOnEarth: a.bornOnEarth,
    birthDay: a.birthDay,
    deathDay: a.deathDay,
    deathCause: a.deathCause,
    occupation: a.occupation,
    generation: 0,
    parentIds: a.parentIds,
    childIds: a.childIds,
    topSkill: a.topSkill,
  };
}

export function findPerson(s: SimState, id: string): PersonView | undefined {
  const live = s.colonists.find((c) => c.id === id);
  if (live) return viewOfLiving(live);
  const dead = s.dead.find((d) => d.id === id);
  return dead ? viewOfDead(dead) : undefined;
}

/** Walk up the ancestry chain, resolving through the archive as needed. */
export function ancestorsOf(s: SimState, id: string, maxDepth = 6): PersonView[][] {
  const levels: PersonView[][] = [];
  let frontier = [id];
  const seen = new Set<string>([id]);
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next: string[] = [];
    const people: PersonView[] = [];
    for (const pid of frontier) {
      const p = findPerson(s, pid);
      if (!p) continue;
      for (const parent of p.parentIds) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        const pv = findPerson(s, parent);
        if (pv) {
          people.push(pv);
          next.push(parent);
        }
      }
    }
    if (!people.length) break;
    levels.push(people);
    frontier = next;
  }
  return levels;
}
