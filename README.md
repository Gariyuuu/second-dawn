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
- **Cultural evolution** — traditions form only from things the colony actually lived through. A famine survived and grieved becomes *The Lean Days*, a fast kept each year. Two lost survey teams become *The Horizon Vigil*. A charter that holds for a decade earns *Charter Day*. When the last Earth-born colonist dies, Earth itself becomes *The Blue World* — taught to children as half history, half parable. Language drifts once most speakers were born on the planet, and children's names drift with it: Earth first-names give way to ones coined locally (Vell, Corvane, Peregrine) while family surnames carry down.
- **Director policy** — rationing, family policy, labor priority, and survey aggressiveness are real levers read by every daily tick; they compound over generations into different civilizations (see the policy test below).
- **Settlement growth** — lander camp → modular settlement → permanent buildings → town → city → regional civilization, physically constructed building by building in the 3D scene.
- **Expeditions** — survey teams depart, find minerals/water/species/fuel, get delayed, or are lost with all hands.
- **Museum & provenance** — objects (a landing helmet, a wedding ring, a half-filled journal) outlive their owners with a chain of custody.
- **Buildings with history** — click any structure in the 3D scene to see when it was raised, which colonists built it, what else was happening that year, and whether anyone who built it is still alive. A century in, most structures are standing over their makers.
- **History** — only events that genuinely occur are recorded: first birth, first local harvest, power crises, constitution signed, the last Earth memory.

## Player modes

Observer · Director · Colonist (follow one person) · God/Experiment (remove colonists, grant supply drops, reroll colonies).

Time: pause / 1× / 10× / 100× / +1 year / +10 years.

## The success test

`scripts/divergence-test.ts` runs two colonies from the same seed; in one, the lead engineer dies in Year 2. After 100 simulated years:

| | Colony A — engineer lives | Colony B — engineer dies Year 2 |
| --- | --- | --- |
| Population | 576 | 92 |
| Settlement | City | Permanent settlement (never grew) |
| Energy tech | 100 | 20 (collapsed) |
| Living engineering skill | 366 | 0 |
| Crisis events | 242 | 471 |
| Food / energy stores | full | zero |

The mechanism is cascading, not scripted: the lead engineer died before his expertise propagated through teaching, so the engineering skill pool fell below the threshold that sustains energy tech, energy tech regressed from 100 to 20, power stations could no longer be maintained, and the colony spent the following decades in a compounding loop of power, water, and food crises. Colony B's museum ends up with *more* artifacts than Colony A's — a consequence of how many more people died.

```
npx tsx scripts/divergence-test.ts   # ~5s per 100-year colony
npx tsx scripts/policy-test.ts       # Director-policy divergence + tradition emergence
```

`policy-test.ts` shows the Director levers produce equally divergent societies from one seed — 60 years later: restricted births leaves 61 people in a modular settlement; balanced reaches a city of 451; generous rations plus encouraged families reaches 581 but pays for it with 118 food crises; aggressive survey costs enough lost teams to hold the colony at 264.

## Run it

```
npm install
npm run dev
```

Next.js + TypeScript + Three.js (react-three-fiber) + Zustand. Simulation core is pure TypeScript (`src/lib/sim/`), deterministic per seed, and runs headless in Node for testing.

## Honest scope notes

This is a vertical slice of the full vision. Colonists render as instanced low-poly figures — premium character and environment assets are a planned upgrade, not present. The tick is a uniform daily step with no level-of-detail coarsening; caching skill totals brought 100 years down to about 5 seconds, so centuries are practical, but millennia would need real LOD. Architecture styles don't yet change with era, class/prestige/religion dynamics are shallow, and Colonist mode does not yet follow an individual through their life.
