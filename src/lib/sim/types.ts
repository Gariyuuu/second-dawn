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
}

export interface HistoryEvent {
  id: string;
  day: number;
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
  holidays: { name: string; day: number; recurring: boolean; originEventId: string }[];
  generationsBornOffworld: number;
  lastEarthMemoryHolderDeathDay?: number;
}
