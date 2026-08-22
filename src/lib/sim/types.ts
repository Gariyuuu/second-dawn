export type Sex = "male" | "female";

export type Occupation =
  | "commander"
  | "physician"
  | "engineer"
  | "botanist"
  | "geologist"
  | "ecologist"
  | "pilot"
  | "technician"
  | "security"
  | "cook"
  | "educator"
  | "fabricator"
  | "laborer"
  | "child"
  | "unskilled";

export type Skill =
  | "medicine"
  | "engineering"
  | "agriculture"
  | "construction"
  | "geology"
  | "ecology"
  | "leadership"
  | "combat"
  | "cooking"
  | "education"
  | "fabrication"
  | "piloting";

export type Ideology =
  | "collectivist" // shared ownership, communal labor
  | "individualist" // personal property, meritocracy
  | "technocratic" // rule by expertise
  | "traditionalist" // preserve Earth customs
  | "pragmatist"; // whatever keeps people alive

export type Trait =
  | "resilient"
  | "anxious"
  | "charismatic"
  | "stoic"
  | "curious"
  | "stubborn"
  | "nurturing"
  | "ambitious"
  | "reclusive"
  | "devout"
  | "restless"
  | "meticulous";

export interface Appearance {
  heightCm: number;
  build: "slight" | "average" | "athletic" | "heavy";
  skinTone: string; // hex
  hairColor: string; // hex
  hairStyle: string;
  eyeColor: string;
  complexion: string;
  distinguishingFeature?: string;
}

export interface Relationship {
  colonistId: string;
  kind: "spouse" | "parent" | "child" | "sibling" | "friend" | "rival";
}

export interface HealthState {
  physical: number; // 0-100
  mental: number; // 0-100
  chronicConditions: string[];
  injured: boolean;
  pregnant?: boolean;
  pregnancyDueDay?: number;
}

export interface Colonist {
  id: string;
  name: string;
  sex: Sex;
  birthDay: number; // simulation day of birth (negative = born on Earth before landing)
  bornOnEarth: boolean;
  ageYears: number;
  occupation: Occupation;
  skills: Partial<Record<Skill, number>>; // 0-100 proficiency
  personality: Trait[];
  ideology: Ideology;
  appearance: Appearance;
  relationships: Relationship[];
  health: HealthState;
  possessions: string[];
  goals: string[];
  fears: string[];
  morale: number; // 0-100
  alive: boolean;
  deathDay?: number;
  deathCause?: string;
  role?: string; // current job assignment, e.g. "Farm Steward"
  /** 0 = founder (Earth-born). Each generation born here increments it. */
  generation: number;
  /** How this person acquired their trade, recorded when they came of age. */
  trainedVia?: "school" | "parent" | "practitioner" | "archive" | "none";
  trainedBy?: string;
}

export type ResourceKind =
  | "food"
  | "water"
  | "energy"
  | "medicine"
  | "rawMaterials" // mined ore, biomass
  | "materials" // processed/refined
  | "components" // manufactured parts
  | "tools"
  | "spareParts"
  | "fuel"
  | "seeds";

export type Resources = Record<ResourceKind, number>;

export interface PlanetProfile {
  name: string;
  gravityG: number; // relative to Earth's 1g
  atmosphere: { n2: number; o2: number; co2: number; other: number; pressureAtm: number };
  dayLengthHours: number;
  yearLengthDays: number;
  axialTiltDeg: number;
  meanTempC: number;
  seasonalRangeC: number;
  hydrosphere: "abundant" | "moderate" | "scarce";
  soilFertility: "rich" | "moderate" | "poor" | "toxic";
  nativeLifePresent: boolean;
  hazards: string[];
  seed: number;
}

export interface EcologySpecies {
  id: string;
  name: string;
  role: "producer" | "consumer" | "predator" | "decomposer";
  habitat: string;
  populationIndex: number; // relative abundance 0-100
  dependsOn: string[]; // ids of species/resources it needs
  edibleToHumans: boolean;
  dangerLevel: number; // 0-100
}

export type SettlementStage =
  | "landing_camp"
  | "modular_settlement"
  | "permanent_buildings"
  | "town"
  | "city"
  | "regional_civilization";

// Director-mode levers. Every field is read by the daily tick, so a change here
// diverges the history from that day forward.
export interface ColonyPolicy {
  rationing: "generous" | "standard" | "strict";
  birthPolicy: "encouraged" | "neutral" | "restricted";
  laborPriority: "food" | "industry" | "construction" | "learning" | "balanced";
  expeditions: "aggressive" | "normal" | "cautious";
}

export interface Tradition {
  id: string;
  name: string;
  description: string;
  kind: "holiday" | "ritual" | "myth" | "custom" | "art";
  foundedDay: number;
  originEventId: string;
  observance: number; // 0-100, how widely it is actually kept right now
  peakObservance: number;
  lastRevivedDay?: number;
  status: "active" | "faded";
}

export interface Archive {
  id: string;
  name: string;
  kind: "ship_library" | "written_record" | "school_curriculum";
  createdDay: number;
  integrity: number; // 0-100; decays when no institution maintains it
  topics: ("earth_history" | "technical" | "medical" | "colony_history")[];
  maintainedBy: "school" | "museum" | "none";
}

export interface Building {
  id: string;
  type:
    | "habitat_module"
    | "power_station"
    | "water_reclaimer"
    | "farm_dome"
    | "workshop"
    | "medbay"
    | "storage_depot"
    | "mine"
    | "refinery"
    | "school"
    | "hall_of_governance"
    | "museum"
    | "house"
    | "market";
  builtDay: number;
  x: number;
  z: number;
  condition: number; // 0-100
  staffedBy: string[]; // colonist ids
  label: string;
  builtByName?: string; // lead builder at the time, for provenance generations later
  builtByIds?: string[];
  lastRenovatedDay?: number;
  renovations: number; // full rebuilds after falling derelict
  renovatedByName?: string;
  /** Condition-points of fabric made good over this structure's life. Every 100
   *  points is one building's worth of material replaced piece by piece. */
  fabricReplaced: number;
  /** People this structure can shelter. Set explicitly so the descent lander,
   *  which brought the whole landing party down, can differ from a habitat. */
  housing?: number;
}

export interface HistoryEvent {
  id: string;
  day: number;
  /** 1 = routine, 2 = notable, 3 = defining. Drives what surfaces at century scale. */
  significance: 1 | 2 | 3;
  /** Set on aggregated crisis periods so repeated days collapse into one record. */
  durationDays?: number;
  endDay?: number;
  title: string;
  description: string;
  category:
    | "landing"
    | "birth"
    | "death"
    | "construction"
    | "crisis"
    | "governance"
    | "culture"
    | "exploration"
    | "technology"
    | "ecology";
  colonistIds?: string[];
}

export interface Faction {
  id: string;
  name: string;
  ideology: Ideology;
  memberIds: string[];
  founded: number;
}

export interface GovernmentState {
  systemName: string; // e.g. "Mission Emergency Protocol", "Provisional Council"
  established: boolean;
  establishedDay?: number;
  leaderIds: string[];
  laws: string[];
}

export interface ExplorationExpedition {
  id: string;
  memberIds: string[];
  departedDay: number;
  returnDay: number;
  destination: { x: number; z: number };
  status: "underway" | "returned" | "lost" | "delayed";
  findings: string[];
}

export interface MuseumObject {
  id: string;
  name: string;
  originDay: number;
  provenance: string[]; // chain of custody / history notes
  ownerColonistId?: string;
  /** Why this object was kept when most possessions were not. */
  significanceReason: string;
  significance: number; // higher = more likely to stay on display rather than be archived
  archived: boolean;
}

/** A dead colonist reduced to what history and descendants actually need. */
export interface ArchivedColonist {
  id: string;
  name: string;
  sex: Sex;
  birthDay: number;
  deathDay: number;
  deathCause: string;
  occupation: Occupation;
  bornOnEarth: boolean;
  ageAtDeath: number;
  parentIds: string[];
  childIds: string[];
  topSkill?: { skill: Skill; level: number };
}

export type TechLevel = {
  manufacturing: number; // 0-100
  medicine: number;
  agriculture: number;
  energy: number;
  construction: number;
};

export interface SimState {
  seed: number;
  day: number; // simulation day count since landing (day 0 = landing)
  colonists: Colonist[];
  planet: PlanetProfile;
  ecology: EcologySpecies[];
  resources: Resources;
  productionRates: Partial<Record<ResourceKind, number>>; // last-tick net per day
  buildings: Building[];
  settlementStage: SettlementStage;
  history: HistoryEvent[];
  factions: Faction[];
  government: GovernmentState;
  expeditions: ExplorationExpedition[];
  museum: MuseumObject[];
  tech: TechLevel;
  landed: boolean;
  traditions: Tradition[];
  archives: Archive[];
  policy: ColonyPolicy;
  /** Dead colonists, reduced. Kept out of the per-tick hot path. */
  dead: ArchivedColonist[];
  /** Skill pools from the most recent tick, for systems that need them cheaply. */
  knowledgeCtxPool: Partial<Record<Skill, number>>;
  /**
   * The physical limits of the territory the colony has actually surveyed.
   * Ore is finite and depletes as it is mined; farmable ground is finite too.
   * Both grow only by sending expeditions out to find more, which is what makes
   * survey policy a real strategic choice and stops growth being unbounded.
   */
  resourceBase: {
    oreKnown: number;
    oreRemaining: number;
    arableSites: number;
    arableUsed: number;
    depositsFound: number;
    valleysFound: number;
  };
  /** Running totals that would otherwise require scanning all of history. */
  stats: {
    births: number;
    deaths: number;
    peakPopulation: number;
    foodCrisisDays: number;
    powerCrisisDays: number;
    waterCrisisDays: number;
    housingShortfallDays: number;
    techRegressions: number;
    expeditionsLaunched: number;
    expeditionsLost: number;
    buildingsReplaced: number;
  };
  worstMortalityYear?: { endDay: number; share: number; deaths: number };
  /** Rolling per-year mortality accumulator. */
  yearMortality: { yearStartDay: number; deaths: number; startPop: number };
  births: number;
  generationsBornOffworld: number;
  maxAncestryDepth: number;
  lastEarthMemoryHolderDeathDay?: number;
  extinctDay?: number;
}
