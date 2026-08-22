import { Rand } from "./rng";
import type { HistoryEvent, SimState, Tradition } from "./types";

/**
 * A candidate tradition: something the colony actually lived through that was
 * significant enough that people might still be marking it a generation later.
 * Nothing here fires on a timer — each candidate has to find its origin event
 * in the canonical history first.
 */
interface Candidate {
  id: string;
  kind: Tradition["kind"];
  /** Returns the originating event plus naming inputs, or null if it never happened. */
  detect: (s: SimState) => { origin: HistoryEvent | null; subject?: string } | null;
  build: (s: SimState, origin: HistoryEvent | null, subject: string | undefined, rand: Rand) => {
    name: string;
    description: string;
  };
}

const yearsOf = (s: SimState, days: number) => days / s.planet.yearLengthDays;

// Naming pools give two colonies that both survived a famine different names for
// the observance, so histories don't read as reskins of one another.
const FAST_NAMES = ["The Lean Days", "The Thin Season", "Short Commons", "The Fasting", "Hollow Week"];
const VIGIL_NAMES = ["The Horizon Vigil", "The Outward Lamps", "Night of the Unreturned", "The Waiting"];
const FOUNDING_NAMES = ["Landing Day", "Descent Day", "First Ground", "The Arrival"];
const CHARTER_NAMES = ["Charter Day", "Signing Day", "The Speaking", "Covenant Day"];
const HARVEST_NAMES = ["First Furrow", "Greening Day", "The First Yield", "Rootfall"];
const MEMORIAL_NAMES = ["The Long Winter Remembrance", "Ashday", "The Counting of Names", "Grievance Night"];
const EARTH_NAMES = ["The Blue World", "The Old Water", "The Drowned Garden", "The World Behind"];

const CANDIDATES: Candidate[] = [
  {
    id: "t-founding",
    kind: "holiday",
    detect: (s) => {
      const origin = s.history.find((h) => h.category === "landing") ?? null;
      // only becomes a holiday once the colony has survived long enough to celebrate
      return origin && yearsOf(s, s.day) >= 3 ? { origin } : null;
    },
    build: (s, origin, _subj, rand) => ({
      name: rand.pick(FOUNDING_NAMES),
      description: `The anniversary of the descent is kept each year — by now less a celebration of arrival than an assertion that the colony intends to still be here next year.`,
    }),
  },
  {
    id: "t-lean-fast",
    kind: "ritual",
    detect: (s) => {
      const famines = s.history.filter((h) => h.category === "crisis" && h.title.includes("Food"));
      const total = famines.reduce((a, h) => a + (h.durationDays ?? 1), 0);
      // needs a hunger long enough to have marked a generation, then survived
      if (total < 120) return null;
      const first = famines[0];
      if (yearsOf(s, s.day - first.day) < 2) return null;
      const recent = famines[famines.length - 1];
      if (yearsOf(s, s.day - recent.day) < 1.5) return null; // still hungry; not yet memory
      return { origin: first, subject: String(Math.round(total)) };
    },
    build: (s, origin, subject, rand) => ({
      name: rand.pick(FAST_NAMES),
      description: `Each year the colony eats at ration weight for three days, marking the ${subject} days of hunger that began around day ${origin?.day ?? 0}. Those who lived through it insisted the next generation should know what it felt like.`,
    }),
  },
  {
    id: "t-horizon-vigil",
    kind: "ritual",
    detect: (s) => {
      const lost = s.history.filter((h) => h.title === "Expedition Lost");
      if (lost.length < 2) return null;
      if (yearsOf(s, s.day - lost[0].day) < 1) return null;
      const names = lost.flatMap((h) => h.colonistIds ?? []).length;
      return { origin: lost[0], subject: String(names) };
    },
    build: (s, origin, subject, rand) => ({
      name: rand.pick(VIGIL_NAMES),
      description: `A night kept for survey teams that never came back — lamps set facing outward from the settlement edge, one for each of the ${subject} names lost since day ${origin?.day ?? 0}.`,
    }),
  },
  {
    id: "t-first-harvest",
    kind: "holiday",
    detect: (s) => {
      const h = s.history.find((e) => e.title === "First Local Harvest") ?? null;
      return h && yearsOf(s, s.day - h.day) >= 5 ? { origin: h } : null;
    },
    build: (s, origin, _subj, rand) => ({
      name: rand.pick(HARVEST_NAMES),
      description: `Marks the first crop raised in ${s.planet.name}'s own soil, on day ${origin?.day ?? 0} — the day the colony stopped being wholly dependent on what it brought with it.`,
    }),
  },
  {
    id: "t-charter-day",
    kind: "holiday",
    detect: (s) => {
      if (!s.government.established || s.government.establishedDay === undefined) return null;
      if (yearsOf(s, s.day - s.government.establishedDay) < 10) return null;
      const origin = s.history.find((h) => h.title === "Constitution Signed") ?? null;
      return { origin, subject: s.government.systemName };
    },
    build: (s, _o, subject, rand) => ({
      name: rand.pick(CHARTER_NAMES),
      description: `The signing of ${subject} is marked with open debate in the hall — anyone may speak, and by custom the leaders answer last.`,
    }),
  },
  {
    id: "t-mass-mourning",
    kind: "ritual",
    detect: (s) => {
      // a year in which an unusual share of the colony died
      const worst = s.worstMortalityYear;
      if (!worst || worst.share < 0.12) return null;
      if (yearsOf(s, s.day - worst.endDay) < 3) return null;
      return { origin: null, subject: `${Math.round(worst.share * 100)}%` };
    },
    build: (s, _o, subject, rand) => ({
      name: rand.pick(MEMORIAL_NAMES),
      description: `Remembers the year the colony buried ${subject} of its people. Names are read aloud from the roll; families who lost no one read for those who left no family.`,
    }),
  },
  {
    id: "t-blue-world",
    kind: "myth",
    detect: (s) => {
      const last = s.history.find((h) => h.title === "The Last Earth Memory") ?? null;
      if (!last) return null;
      return yearsOf(s, s.day - last.day) >= 3 ? { origin: last } : null;
    },
    build: (s, origin, _subj, rand) => ({
      name: rand.pick(EARTH_NAMES),
      description: `With no one left who saw it, Earth has passed from memory into story — taught as a place of blue water and crowded sky, and used to explain both where the colony came from and why it must not fail.`,
    }),
  },
  {
    id: "t-keeping",
    kind: "custom",
    detect: (s) => {
      const m = s.buildings.find((b) => b.type === "museum");
      return m && yearsOf(s, s.day - m.builtDay) >= 2 ? { origin: null } : null;
    },
    build: () => ({
      name: "The Keeping",
      description: `Families bring one object a generation to the museum. What gets chosen says more about the colony than anything written down.`,
    }),
  },
  {
    id: "t-ridge-figures",
    kind: "art",
    detect: (s) => {
      const pop = s.colonists.filter((c) => c.alive).length;
      const settled = s.settlementStage === "town" || s.settlementStage === "city" || s.settlementStage === "regional_civilization";
      return settled && pop > 150 && yearsOf(s, s.day) > 20 ? { origin: null } : null;
    },
    build: () => ({
      name: "Ridge Figures",
      description: `Large figures cut into the pale rock above the settlement — begun as survey markers, continued as something between a signature and a prayer.`,
    }),
  },
  {
    id: "t-dialect",
    kind: "custom",
    detect: (s) => {
      const living = s.colonists.filter((c) => c.alive);
      if (!living.length) return null;
      const offworld = living.filter((c) => !c.bornOnEarth).length / living.length;
      return offworld > 0.9 && yearsOf(s, s.day) > 40 ? { origin: null } : null;
    },
    build: () => ({
      name: "The Settlement Dialect",
      description: `Speech here has drifted from the mission's standard: shipboard words survive with new meanings, "downwell" has replaced "outside", and the Earth months are now simply the names of local seasons.`,
    }),
  },
];

/**
 * Traditions form when a genuinely significant thing happened and enough time
 * has passed to make meaning of it. Formation is deliberately rate-limited: a
 * society does not acquire a new sacred day every few years forever.
 */
export function formTraditions(s: SimState, rand: Rand, day: number, makeEvent: (
  day: number, title: string, description: string, category: HistoryEvent["category"]
) => HistoryEvent) {
  const active = s.traditions.filter((t) => t.observance > 20).length;
  // cultural saturation: an established society resists adding more major days
  const saturation = Math.min(0.95, active / 7);
  if (rand.next() < saturation) return;

  for (const cand of CANDIDATES) {
    if (s.traditions.some((t) => t.id === cand.id)) continue;
    const hit = cand.detect(s);
    if (!hit) continue;
    const { name, description } = cand.build(s, hit.origin, hit.subject, rand);
    s.traditions.push({
      id: cand.id,
      name,
      description,
      kind: cand.kind,
      foundedDay: day,
      originEventId: hit.origin?.id ?? "",
      observance: 60,
      peakObservance: 60,
      lastRevivedDay: undefined,
      status: "active",
    });
    s.history.push(
      makeEvent(day, `A Tradition Takes Hold: ${name}`, description, "culture")
    );
    return; // at most one new tradition per formation check
  }
}

/**
 * Traditions live or die by transmission. One kept by people who remember why it
 * exists stays strong; one whose origin generation is gone survives only if an
 * institution carries it, and otherwise fades — and can later be revived if
 * circumstances make it meaningful again.
 */
export function transmitTraditions(s: SimState, rand: Rand, day: number, makeEvent: (
  day: number, title: string, description: string, category: HistoryEvent["category"]
) => HistoryEvent) {
  const living = s.colonists.filter((c) => c.alive);
  if (!living.length) return;
  const schools = s.buildings.filter((b) => b.type === "school" && b.condition > 25).length;
  const museums = s.buildings.filter((b) => b.type === "museum" && b.condition > 25).length;
  const halls = s.buildings.filter((b) => b.type === "hall_of_governance" && b.condition > 25).length;

  for (const t of s.traditions) {
    // share of the living who were alive when it began — the people who know why
    const rememberers = living.filter((c) => c.birthDay <= t.foundedDay).length / living.length;

    let delta = 0;
    delta += rememberers * 2.2; // living memory sustains it
    if (schools > 0) delta += 0.55; // taught as colony history
    if (museums > 0 && t.kind !== "myth") delta += 0.25;
    if (halls > 0 && t.kind === "holiday") delta += 0.3;
    delta -= 0.85; // observance costs effort; without support it slips

    // a myth needs no institution — it survives by being a good story
    if (t.kind === "myth") delta += 0.55;
    // hardship crowds out observance
    if (s.resources.food <= 0) delta -= 1.2;

    t.observance = Math.max(0, Math.min(100, t.observance + delta * 0.02));
    t.peakObservance = Math.max(t.peakObservance, t.observance);

    const wasActive = t.status === "active";
    if (t.observance < 8 && wasActive) {
      t.status = "faded";
      s.history.push(
        makeEvent(day, `${t.name} Falls Out of Practice`, `Observance of ${t.name} has lapsed. The last people who remembered why it started are gone, and nothing has carried it in their place.`, "culture")
      );
    } else if (t.observance > 35 && t.status === "faded") {
      t.status = "active";
      t.lastRevivedDay = day;
      s.history.push(
        makeEvent(day, `${t.name} Revived`, `${t.name} is being kept again, reconstructed from records and older people's accounts. What it means now is not quite what it meant before.`, "culture")
      );
    }
  }
}
