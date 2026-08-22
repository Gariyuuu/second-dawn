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

## Multi-century validation

The simulation is validated to Year 500, not Year 100. `scripts/` contains the harness:

```
npx tsx scripts/sweep.ts --seeds 100 --years 200 --out reports/y200.json
npx tsx scripts/analyze.ts y200        # statistical sanity + suspicious-convergence flags
npx tsx scripts/acceptance.ts          # determinism, speed-independence, resilience, counterfactual
npx tsx scripts/citizen-test.ts        # the Year-500 random-citizen interview
npx tsx scripts/probe500.ts            # subsystem health at 25/50/100/200/300/500
```

Long-horizon testing found and fixed several compounding defects that a 100-year run never surfaced:

| Defect found at century scale | Root cause | Fix |
| --- | --- | --- |
| Every trade forgotten by Y160; colony extinct | Children learned from a *random* adult; if that adult was unskilled they learned nothing, so the unskilled share compounded | Apprenticeship: youths are matched to living practitioners in trades the colony is short of, by a school where one exists, otherwise by parents |
| Medicine drained to zero and never returned | Medicine was consumed but never produced | Medbay + doctors + materials manufacture it, against a target set by population |
| All 189 buildings collapsed within five years | Maintenance over-repaired ~17× actual decay, exhausting spare parts, and every building decayed in lockstep | Repair is a budget matched to wear; wear rate varies by building type |
| Colony froze at 21 buildings for 400 years | The top-priority build was permanently unaffordable and the planner considered nothing else | Planner builds the most pressing thing it can actually pay for |
| Population grew without limit | Mining created ore from nothing, so there was no resource ceiling | Finite depletable deposits and finite farmland, expanded only by exploration; plus an ordinary demographic transition |
| Every colony reached identical outcomes | Generated planet hazards were never simulated, and hydrosphere was unused | Storms, floods, quakes, UV summers and algal blooms actually strike; water yield scales with hydrosphere |
| Technology maxed at 100 everywhere | Tech tracked *absolute* skill totals, which saturate in any large colony | Tech tracks practitioner density and mastery *per capita*, so a growing society can lose ground |

## Knowledge and cultural memory

Knowledge exists in five distinguishable places, and they are not interchangeable: living expert practice, apprentice practice, what was written down, institutional teaching, and the tools to do the work. A school makes transmission faithful and organised — it cannot teach what neither its teachers nor its records contain.

Every person carries a **ceiling** per trade, set by the quality of what they were taught. Learn from a master under a school and you can approach their level; learn from a manual and you get theory, capped well short of practical mastery. Practice moves you toward your ceiling and no further; getting past it means rediscovery, which only the foremost practitioner alive can attempt, only with a workshop, and only slowly. Archives record only as deeply as practitioners troubled to write things down, so a trade nobody ever mastered is a trade no archive can teach.

Traditions live or die by transmission against finite cultural attention. They move gradually through **active → declining → rare → dormant**, and a dormant one can be revived from records — returning changed, with its provenance chain kept. Nothing expires on a timer.

## Multi-century validation

Colonies are hard to kill once they have schools, farmland and a few hundred people — 2% die by Year 200, 23% by Year 500, and the deaths are concentrated in the first two centuries. That is deliberate: a mature civilization *should* be resilient, and the measured proof that institutions matter is that the same expert-cohort shock costs a year-3 colony half its population and a year-250 colony nothing lasting.

This is a vertical slice of the full vision. Colonists render as instanced low-poly figures — premium character and environment assets are a planned upgrade, not present. The tick is a uniform daily step with no level-of-detail coarsening; caching skill totals brought 100 years down to about 5 seconds, so centuries are practical, but millennia would need real LOD. Architecture styles don't yet change with era, class/prestige/religion dynamics are shallow, and Colonist mode does not yet follow an individual through their life.
