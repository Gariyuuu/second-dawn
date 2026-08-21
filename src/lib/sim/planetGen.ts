import { Rand } from "./rng";
import type { EcologySpecies, PlanetProfile } from "./types";

const PLANET_NAMES = [
  "Kepler's Rest", "Novaterra", "Halcyon", "Meridian", "Aurelia",
  "Threshold", "Cascadia Prime", "Vesper", "Solmara", "Erebos",
];

export function generatePlanet(rand: Rand, seed: number): PlanetProfile {
  const o2 = rand.float(0.17, 0.24);
  const co2 = rand.float(0.002, 0.015);
  const other = rand.float(0.005, 0.02);
  const n2 = 1 - o2 - co2 - other;
  return {
    name: rand.pick(PLANET_NAMES),
    gravityG: rand.float(0.82, 1.12),
    atmosphere: {
      n2: Math.round(n2 * 1000) / 10,
      o2: Math.round(o2 * 1000) / 10,
      co2: Math.round(co2 * 1000) / 10,
      other: Math.round(other * 1000) / 10,
      pressureAtm: rand.float(0.85, 1.15),
    },
    dayLengthHours: rand.float(21, 29),
    yearLengthDays: rand.int(290, 480),
    axialTiltDeg: rand.float(8, 32),
    meanTempC: rand.float(4, 16),
    seasonalRangeC: rand.float(12, 30),
    hydrosphere: rand.weighted([
      ["abundant", 3],
      ["moderate", 5],
      ["scarce", 2],
    ]),
    soilFertility: rand.weighted([
      ["rich", 2],
      ["moderate", 5],
      ["poor", 3],
    ]),
    nativeLifePresent: rand.bool(0.8),
    hazards: rand
      .shuffle([
        "electrical dust storms",
        "seasonal flooding of the lowlands",
        "high-UV summers",
        "seismic activity along the eastern ridge",
        "toxic algal blooms in still water",
        "hurricane-force katabatic winds",
      ])
      .slice(0, rand.int(1, 3)),
    seed,
  };
}

// Internally consistent food web: producers ← consumers ← predators, decomposers close the loop.
export function generateEcology(rand: Rand, planet: PlanetProfile): EcologySpecies[] {
  if (!planet.nativeLifePresent) return [];

  const species: EcologySpecies[] = [];
  const habitats =
    planet.hydrosphere === "abundant"
      ? ["coastal shallows", "river valleys", "upland plains", "fern forests"]
      : planet.hydrosphere === "moderate"
      ? ["lake margins", "steppe", "canyon systems", "scrub flats"]
      : ["oasis basins", "rock fields", "dry plateaus"];

  const producerNames = [
    "veilgrass", "amber kelp", "spiral fern", "glasscap moss", "bluereed", "crownlichen",
  ];
  const consumerNames = [
    "burrower drove", "reed skimmer", "shellback grazer", "misthopper", "duneskipper",
  ];
  const predatorNames = ["ridge stalker", "pale lurker", "wind courser"];
  const decomposerNames = ["ashworm colony", "rot-lace fungus"];

  const producerCount = rand.int(3, 5);
  for (let i = 0; i < producerCount; i++) {
    species.push({
      id: `sp-prod-${i}`,
      name: producerNames[i % producerNames.length],
      role: "producer",
      habitat: rand.pick(habitats),
      populationIndex: rand.int(55, 90),
      dependsOn: ["sunlight", "soil"],
      edibleToHumans: rand.bool(0.4),
      dangerLevel: 0,
    });
  }

  const producers = species.filter((s) => s.role === "producer");
  const consumerCount = rand.int(2, 4);
  for (let i = 0; i < consumerCount; i++) {
    const diet = rand.shuffle(producers).slice(0, rand.int(1, 2));
    species.push({
      id: `sp-cons-${i}`,
      name: consumerNames[i % consumerNames.length],
      role: "consumer",
      habitat: rand.pick(habitats),
      populationIndex: rand.int(30, 65),
      dependsOn: diet.map((d) => d.id),
      edibleToHumans: rand.bool(0.5),
      dangerLevel: rand.int(0, 15),
    });
  }

  const consumers = species.filter((s) => s.role === "consumer");
  if (consumers.length > 0) {
    const predatorCount = rand.int(1, 2);
    for (let i = 0; i < predatorCount; i++) {
      const prey = rand.shuffle(consumers).slice(0, rand.int(1, 2));
      species.push({
        id: `sp-pred-${i}`,
        name: predatorNames[i % predatorNames.length],
        role: "predator",
        habitat: rand.pick(habitats),
        populationIndex: rand.int(8, 22),
        dependsOn: prey.map((p) => p.id),
        edibleToHumans: false,
        dangerLevel: rand.int(35, 75),
      });
    }
  }

  for (let i = 0; i < rand.int(1, 2); i++) {
    species.push({
      id: `sp-dec-${i}`,
      name: decomposerNames[i % decomposerNames.length],
      role: "decomposer",
      habitat: rand.pick(habitats),
      populationIndex: rand.int(40, 80),
      dependsOn: species.map((s) => s.id),
      edibleToHumans: false,
      dangerLevel: rand.int(0, 10),
    });
  }

  return species;
}
