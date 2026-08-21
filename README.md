# SECOND DAWN

A realistic 3D generational civilization simulation. A colony ship carrying ~120 persistent individuals reaches a habitable but unfamiliar planet. Earth is inaccessible. There will be no rescue. You watch — and optionally influence — humanity beginning again.

## What's simulated

- **120 persistent colonists** — name, age, appearance, occupation, skills, personality, ideology, family/friend/rival graph, health, morale, possessions, goals, fears. No respawning; when the last electrical engineer dies, that knowledge can genuinely be lost.
- **Planet generation** — gravity, atmosphere, day/year length, temperature, hydrosphere, soil, hazards; internally consistent per seed.
- **Native ecology** — producers → consumers → predators → decomposers food web. Human expansion degrades producer populations; consumers starve in cascade.
- **Real resource quantities** — food, water, energy, medicine, ore, materials, components, tools, spare parts, fuel, seeds. No "resources +5".
- **Production chains** — mine → refinery → materials → workshop → components/parts/tools; farm domes → food (skill-, soil-, tech-dependent).
- **Technology regression/recovery** — tech fields decay when living expertise falls below a threshold; schools + deep expertise recover it. Teaching transfers skills.
- **Generations** — romance, marriage, pregnancy, birth, childhood, inheritance of surname and ideology, education by mentors. Eventually nobody alive remembers Earth — and that transition is logged as a major historical event.
- **Emergent governance** — starts under Mission Emergency Protocol; once permanently settled, a constitution emerges from the dominant ideology (Commons Assembly, Charter Republic, Technical Directorate, Founders' Covenant, or Provisional Council). Factions crystallize. Leaders die and are succeeded.
- **Cultural evolution** — Landing Day becomes a holiday only after the colony survives long enough for the anniversary to mean something.
- **Settlement growth** — lander camp → modular settlement → permanent buildings → town → city → regional civilization, physically constructed building by building in the 3D scene.
- **Expeditions** — survey teams depart, find minerals/water/species/fuel, get delayed, or are lost with all hands.
- **Museum & provenance** — objects (a landing helmet, a wedding ring, a half-filled journal) outlive their owners with a chain of custody.
- **History** — only events that genuinely occur are recorded: first birth, first local harvest, power crises, constitution signed, the last Earth memory.

## Player modes

Observer · Director · Colonist (follow one person) · God/Experiment (remove colonists, grant supply drops, reroll colonies).

Time: pause / 1× / 10× / 100× / +1 year / +10 years.

## The success test

`scripts/divergence-test.ts` runs two colonies from the same seed; in one, the lead engineer dies in Year 2. After 100 simulated years the societies plausibly diverge (engineering knowledge pool, crisis frequency, chronic infrastructure shortfalls, different recorded histories):

```
npx tsx scripts/divergence-test.ts
```

## Run it

```
npm install
npm run dev
```

Next.js + TypeScript + Three.js (react-three-fiber) + Zustand. Simulation core is pure TypeScript (`src/lib/sim/`), deterministic per seed, and runs headless in Node for testing.

## Honest scope notes

This is a vertical slice of the full vision. Colonists render as instanced low-poly figures (premium character/environment assets are a planned upgrade, not present). Simulation LOD is a uniform daily tick — centuries are possible but take ~1–2 min of compute per 100 years. Language drift, art, architecture styles, class/prestige/religion dynamics, and individual-colonist play mode are scaffolded in the data model but not yet deeply simulated.
