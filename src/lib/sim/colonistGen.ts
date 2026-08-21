import { Rand } from "./rng";
import { generateFullName } from "./names";
import type {
  Appearance,
  Colonist,
  Ideology,
  Occupation,
  Sex,
  Skill,
  Trait,
} from "./types";

const OCCUPATION_POOL: { occupation: Occupation; weight: number; primarySkills: Skill[] }[] = [
  { occupation: "commander", weight: 2, primarySkills: ["leadership"] },
  { occupation: "physician", weight: 5, primarySkills: ["medicine"] },
  { occupation: "engineer", weight: 10, primarySkills: ["engineering", "construction"] },
  { occupation: "botanist", weight: 8, primarySkills: ["agriculture", "ecology"] },
  { occupation: "geologist", weight: 5, primarySkills: ["geology"] },
  { occupation: "ecologist", weight: 4, primarySkills: ["ecology"] },
  { occupation: "pilot", weight: 4, primarySkills: ["piloting"] },
  { occupation: "technician", weight: 12, primarySkills: ["engineering", "fabrication"] },
  { occupation: "security", weight: 8, primarySkills: ["combat"] },
  { occupation: "cook", weight: 5, primarySkills: ["cooking"] },
  { occupation: "educator", weight: 5, primarySkills: ["education"] },
  { occupation: "fabricator", weight: 8, primarySkills: ["fabrication", "construction"] },
  { occupation: "laborer", weight: 14, primarySkills: ["construction"] },
  { occupation: "unskilled", weight: 10, primarySkills: [] },
];

const TRAITS: Trait[] = [
  "resilient", "anxious", "charismatic", "stoic", "curious", "stubborn",
  "nurturing", "ambitious", "reclusive", "devout", "restless", "meticulous",
];

const IDEOLOGIES: Ideology[] = [
  "collectivist", "individualist", "technocratic", "traditionalist", "pragmatist",
];

const HAIR_COLORS = ["#1c1410", "#2b1c12", "#5c3a21", "#8a5a2b", "#c9a15a", "#3d3d3d", "#0e0e0e", "#a15a2b"];
const EYE_COLORS = ["#3b2a1a", "#1a2e3b", "#2f4a2f", "#5a4a3a", "#232323", "#4a3b2a"];
const SKIN_TONES = ["#f2d0b0", "#e0b088", "#c68863", "#a06840", "#8a5a3a", "#5c3a24", "#3c2415"];
const BUILDS: Appearance["build"][] = ["slight", "average", "athletic", "heavy"];

const GOAL_POOL = [
  "Build something that outlasts me",
  "Keep my family safe",
  "Find out if this world can truly sustain us",
  "Rise to lead the colony",
  "Master a trade worth teaching",
  "Start a family here",
  "Prove Earth's sacrifice wasn't wasted",
  "Never let another colonist die of something preventable",
  "Understand the native ecology before we destroy it",
  "Just survive the first year",
  "Leave a written record for those born here",
  "Build a home with my own hands",
];

const FEAR_POOL = [
  "Dying anonymously, forgotten",
  "The colony failing within a generation",
  "Losing my family",
  "Never seeing a sky that feels like home",
  "Becoming useless once my skill is obsolete",
  "That we brought something dangerous down with us",
  "Being blamed if something goes wrong",
  "The silence of a planet with no rescue",
  "Watching children grow up who never knew Earth",
  "Running out of medicine when it matters most",
];

const POSSESSION_POOL = [
  "a sealed photograph from Earth",
  "a wedding ring",
  "a hand-copied book of poetry",
  "a multitool passed down from a mentor",
  "a child's drawing",
  "a religious pendant",
  "a recorded voice message from a parent",
  "a pocket knife",
  "a musical instrument",
  "a journal, half-filled",
  "a seed packet, kept as a memento",
  "dog tags from a sibling in the mission corps",
];

function rollSkills(rand: Rand, primarySkills: Skill[]): Partial<Record<Skill, number>> {
  const skills: Partial<Record<Skill, number>> = {};
  for (const s of primarySkills) {
    skills[s] = rand.int(55, 95);
  }
  // small chance of a secondary competency
  const ALL_SKILLS: Skill[] = [
    "medicine", "engineering", "agriculture", "construction", "geology",
    "ecology", "leadership", "combat", "cooking", "education", "fabrication", "piloting",
  ];
  if (rand.bool(0.35)) {
    const secondary = rand.pick(ALL_SKILLS.filter((s) => !primarySkills.includes(s)));
    skills[secondary] = rand.int(20, 55);
  }
  return skills;
}

function generateAppearance(rand: Rand, sex: Sex): Appearance {
  return {
    heightCm: sex === "male" ? rand.int(163, 195) : rand.int(150, 182),
    build: rand.pick(BUILDS),
    skinTone: rand.pick(SKIN_TONES),
    hairColor: rand.pick(HAIR_COLORS),
    hairStyle: rand.pick(["short", "shaved", "long", "braided", "tied back", "curly crop"]),
    eyeColor: rand.pick(EYE_COLORS),
    complexion: rand.pick(["weathered", "smooth", "freckled", "scarred", "clear"]),
    distinguishingFeature: rand.bool(0.3)
      ? rand.pick([
          "a burn scar from a training accident",
          "a missing fingertip",
          "a tattoo of a family crest",
          "a limp from an old injury",
          "prosthetic left hand",
          "heterochromia",
        ])
      : undefined,
  };
}

export function generateColonist(rand: Rand, index: number, landingDay: number): Colonist {
  const sex: Sex = rand.bool(0.5) ? "male" : "female";
  const ageYears = rand.int(19, 58);
  const birthDay = landingDay - Math.round(ageYears * 365.25);
  const { occupation, primarySkills } = rand.weighted(
    OCCUPATION_POOL.map((o) => [o, o.weight] as [typeof o, number])
  );
  const personality = rand.shuffle(TRAITS).slice(0, rand.int(2, 4));
  const ideology = rand.pick(IDEOLOGIES);

  return {
    id: `col-${index}-${Math.floor(rand.next() * 1e9).toString(36)}`,
    name: generateFullName(sex, (arr) => rand.pick(arr)),
    sex,
    birthDay,
    bornOnEarth: true,
    ageYears,
    occupation,
    skills: rollSkills(rand, primarySkills),
    personality,
    ideology,
    appearance: generateAppearance(rand, sex),
    relationships: [],
    health: {
      physical: rand.int(70, 100),
      mental: rand.int(55, 95),
      chronicConditions: rand.bool(0.08) ? [rand.pick(["hypertension", "asthma", "chronic back pain", "insulin dependency"])] : [],
      injured: false,
    },
    possessions: rand.shuffle(POSSESSION_POOL).slice(0, rand.int(1, 3)),
    goals: rand.shuffle(GOAL_POOL).slice(0, rand.int(1, 2)),
    fears: rand.shuffle(FEAR_POOL).slice(0, rand.int(1, 2)),
    morale: rand.int(50, 85),
    alive: true,
  };
}

export function generatePopulation(rand: Rand, size: number, landingDay: number): Colonist[] {
  const colonists: Colonist[] = [];
  for (let i = 0; i < size; i++) {
    colonists.push(generateColonist(rand, i, landingDay));
  }
  linkFamiliesAndBonds(rand, colonists);
  return colonists;
}

function linkFamiliesAndBonds(rand: Rand, colonists: Colonist[]) {
  const pool = [...colonists];
  // Pair ~55% of adults into spouses
  const shuffled = rand.shuffle(pool);
  const married = new Set<string>();
  for (let i = 0; i < shuffled.length - 1; i++) {
    const a = shuffled[i];
    if (married.has(a.id) || !rand.bool(0.55)) continue;
    for (let j = i + 1; j < shuffled.length; j++) {
      const b = shuffled[j];
      if (married.has(b.id) || b.sex === a.sex) continue;
      if (Math.abs(a.ageYears - b.ageYears) > 12) continue;
      a.relationships.push({ colonistId: b.id, kind: "spouse" });
      b.relationships.push({ colonistId: a.id, kind: "spouse" });
      married.add(a.id);
      married.add(b.id);
      break;
    }
  }
  // Friendships: random social graph, ~3 friends per person among non-spouses
  for (const c of colonists) {
    const candidates = rand.shuffle(
      colonists.filter(
        (o) => o.id !== c.id && !c.relationships.some((r) => r.colonistId === o.id)
      )
    );
    const friendCount = rand.int(1, 4);
    for (let k = 0; k < friendCount && k < candidates.length; k++) {
      c.relationships.push({ colonistId: candidates[k].id, kind: "friend" });
    }
  }
  // A few rivalries
  for (const c of colonists) {
    if (rand.bool(0.08)) {
      const candidates = colonists.filter(
        (o) => o.id !== c.id && !c.relationships.some((r) => r.colonistId === o.id)
      );
      if (candidates.length) {
        const rival = rand.pick(candidates);
        c.relationships.push({ colonistId: rival.id, kind: "rival" });
        rival.relationships.push({ colonistId: c.id, kind: "rival" });
      }
    }
  }
}
