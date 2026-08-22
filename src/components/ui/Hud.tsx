"use client";
import { useMemo, useState } from "react";
import { useSimStore, type TimeSpeed, type PlayerMode } from "@/store/simStore";
import type { Building, Colonist, ColonyPolicy, HistoryEvent, ResourceKind } from "@/lib/sim/types";
import { findPerson, type PersonView } from "@/lib/sim/lookup";
import { earthKnowledge } from "@/lib/sim/knowledge";

const STAGE_LABELS: Record<string, string> = {
  landing_camp: "Landing Camp",
  modular_settlement: "Modular Settlement",
  permanent_buildings: "Permanent Settlement",
  town: "Town",
  city: "City",
  regional_civilization: "Regional Civilization",
};

const CATEGORY_COLORS: Record<HistoryEvent["category"], string> = {
  landing: "oklch(80% 0.12 85)",
  birth: "oklch(75% 0.13 150)",
  death: "oklch(68% 0.14 25)",
  construction: "oklch(74% 0.09 230)",
  crisis: "oklch(68% 0.17 45)",
  governance: "oklch(72% 0.11 310)",
  culture: "oklch(76% 0.10 350)",
  exploration: "oklch(75% 0.10 190)",
  technology: "oklch(74% 0.09 270)",
  ecology: "oklch(74% 0.11 130)",
};

function fmtDay(day: number, yearLen: number) {
  const year = Math.floor(day / yearLen) + 1;
  const doy = (day % yearLen) + 1;
  return `Year ${year} · Day ${doy}`;
}

export default function Hud() {
  const sim = useSimStore((s) => s.sim);
  const version = useSimStore((s) => s.version);
  const speed = useSimStore((s) => s.speed);
  const mode = useSimStore((s) => s.mode);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const setMode = useSimStore((s) => s.setMode);
  const skipYears = useSimStore((s) => s.skipYears);
  const selectedId = useSimStore((s) => s.selectedColonistId);
  const selectedBuildingId = useSimStore((s) => s.selectedBuildingId);
  const selectColonist = useSimStore((s) => s.selectColonist);
  const selectBuilding = useSimStore((s) => s.selectBuilding);
  const killColonist = useSimStore((s) => s.killColonist);
  const grantResources = useSimStore((s) => s.grantResources);
  const reset = useSimStore((s) => s.reset);
  void version;

  const [panel, setPanel] = useState<"history" | "people" | "planet" | "culture" | "museum" | null>(null);
  const [skipping, setSkipping] = useState(false);

  const living = useMemo(() => sim.colonists.filter((c) => c.alive), [sim.colonists, version]);
  const selected = selectedId ? sim.colonists.find((c) => c.id === selectedId) : null;
  const selectedBuilding = selectedBuildingId ? sim.buildings.find((b) => b.id === selectedBuildingId) : null;
  const yearLen = sim.planet.yearLengthDays;
  const extinct = living.length === 0;

  const leaders = sim.government.leaderIds
    .map((id) => sim.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => !!c && c.alive);

  function doSkip(years: number) {
    setSkipping(true);
    setTimeout(() => {
      skipYears(years);
      setSkipping(false);
    }, 30);
  }

  const lastEvent = sim.history[sim.history.length - 1];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col text-[13px]">
      {/* ── top bar ─────────────────────────────────────── */}
      <div className="hud-bar pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <span
          className="text-[15px] font-semibold tracking-[0.22em]"
          style={{ fontFamily: "var(--font-display-stack)", color: "var(--color-accent)" }}
        >
          SECOND DAWN
        </span>

        <div className="flex items-center gap-3 font-mono text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
          <span style={{ color: "var(--color-ink)" }}>{sim.planet.name}</span>
          <span>{fmtDay(sim.day, yearLen)}</span>
        </div>

        <span className="hud-chip">{STAGE_LABELS[sim.settlementStage]}</span>

        <div className="flex items-center gap-1.5 font-mono text-[12px]">
          <span className="hud-label">Pop</span>
          <span style={{ color: extinct ? "var(--color-danger)" : "var(--color-ink)" }} className="font-bold">
            {living.length}
          </span>
          {extinct && (
            <span className="font-bold tracking-widest" style={{ color: "var(--color-danger)" }}>
              EXTINCT
            </span>
          )}
        </div>

        <div className="hidden items-center gap-1.5 font-mono text-[12px] md:flex" style={{ color: "var(--color-ink-muted)" }}>
          <span className="hud-label">Gov</span>
          <span>{sim.government.systemName}</span>
          {leaders.length > 0 && <span style={{ color: "var(--color-ink-faint)" }}>· {leaders[0].name}</span>}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hud-seg" role="group" aria-label="Simulation speed">
            {([0, 1, 10, 100] as TimeSpeed[]).map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className="hud-btn" data-on={speed === s}>
                {s === 0 ? "❚❚" : `${s}×`}
              </button>
            ))}
          </div>
          <div className="hud-seg">
            <button onClick={() => doSkip(1)} disabled={skipping || extinct} className="hud-btn">
              +1yr
            </button>
            <button onClick={() => doSkip(10)} disabled={skipping || extinct} className="hud-btn">
              +10yr
            </button>
          </div>
          {skipping && (
            <span className="hud-label animate-pulse" style={{ color: "var(--color-accent)" }}>
              simulating
            </span>
          )}
        </div>
      </div>

      {/* ── resource strip ──────────────────────────────── */}
      <div className="hud-bar pointer-events-auto flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-1.5" style={{ background: "var(--color-paper-0)" }}>
        {(
          [
            ["food", "Food"],
            ["water", "Water"],
            ["energy", "Energy"],
            ["medicine", "Meds"],
            ["rawMaterials", "Ore"],
            ["materials", "Matls"],
            ["components", "Comp"],
            ["tools", "Tools"],
            ["spareParts", "Parts"],
            ["fuel", "Fuel"],
            ["seeds", "Seeds"],
          ] as [ResourceKind, string][]
        ).map(([k, label]) => {
          const v = sim.resources[k];
          const rate = sim.productionRates[k];
          const low = (k === "food" && v < living.length * 10) || (k === "water" && v < living.length * 5) || v < 5;
          return (
            <span key={k} className="flex items-baseline gap-1.5 font-mono text-[11.5px]">
              <span className="hud-label">{label}</span>
              <span className="tabular-nums font-medium" style={{ color: low ? "var(--color-danger)" : "var(--color-ink)" }}>
                {Math.floor(v).toLocaleString()}
              </span>
              {rate !== undefined && (
                <span className="tabular-nums text-[10.5px]" style={{ color: rate >= 0 ? "var(--color-ok)" : "var(--color-danger)" }}>
                  {rate >= 0 ? "+" : ""}
                  {rate}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* ── panel + mode buttons ────────────────────────── */}
      <div className="pointer-events-auto mt-2.5 flex gap-1.5 px-3">
        <div className="hud-seg">
          {(["history", "people", "planet", "culture", "museum"] as const).map((p) => (
            <button key={p} onClick={() => setPanel(panel === p ? null : p)} className="hud-btn capitalize" data-on={panel === p}>
              {p}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <div className="hud-seg">
            {(["observer", "director", "colonist", "god"] as PlayerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="hud-btn capitalize"
                data-on={mode === m}
                data-tone="mode"
                title={
                  m === "observer"
                    ? "Watch history unfold"
                    : m === "director"
                    ? "Colony overview"
                    : m === "colonist"
                    ? "Follow one person"
                    : "Experiment mode: intervene directly"
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* left panel */}
        {panel && (
          <div className="hud-panel pointer-events-auto m-3 flex w-[380px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--rule)" }}>
              <span
                className="text-[13px] font-semibold uppercase tracking-[0.18em]"
                style={{ fontFamily: "var(--font-display-stack)", color: "var(--color-accent)" }}
              >
                {panel}
              </span>
              <button onClick={() => setPanel(null)} className="hud-btn" aria-label="Close panel">
                ✕
              </button>
            </div>
            <div className="hud-scroll flex-1 overflow-y-auto p-4">
              {panel === "history" && <HistoryPanel history={sim.history} yearLen={yearLen} />}
              {panel === "people" && <PeoplePanel onSelect={selectColonist} yearLen={yearLen} />}
              {panel === "planet" && <PlanetPanel />}
              {panel === "culture" && <CulturePanel yearLen={yearLen} />}
              {panel === "museum" && <MuseumPanel />}
            </div>
          </div>
        )}
        <div className="flex-1" />
        {/* inspector: colonist or building */}
        {(selected || selectedBuilding) && (
          <div className="hud-panel hud-scroll pointer-events-auto m-3 w-[350px] self-start overflow-y-auto p-4" style={{ maxHeight: "70vh" }}>
            {selected && (
              <ColonistCard
                c={selected}
                all={sim.colonists}
                onClose={() => selectColonist(null)}
                onSelect={selectColonist}
                godMode={mode === "god"}
                onKill={() => killColonist(selected.id)}
              />
            )}
            {selectedBuilding && (
              <BuildingCard
                b={selectedBuilding}
                sim={sim}
                yearLen={yearLen}
                onClose={() => selectBuilding(null)}
                onSelect={selectColonist}
              />
            )}
          </div>
        )}
      </div>

      {/* ── director policy bar ─────────────────────────── */}
      {mode === "director" && <DirectorBar />}

      {/* ── god mode toolbar ────────────────────────────── */}
      {mode === "god" && (
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-3 border-t px-4 py-2 backdrop-blur"
          style={{ background: "oklch(22% 0.06 310 / 0.85)", borderColor: "oklch(45% 0.1 310 / 0.5)" }}
        >
          <span className="hud-label" style={{ color: "var(--color-mode)" }}>
            Experiment mode
          </span>
          <button onClick={grantResources} className="hud-btn" style={{ borderColor: "oklch(45% 0.1 310 / 0.6)" }}>
            Grant supply drop
          </button>
          <button onClick={() => reset()} className="hud-btn" style={{ borderColor: "oklch(45% 0.1 310 / 0.6)" }}>
            New colony · new seed
          </button>
          <span className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            Click a colonist, then intervene from their card.
          </span>
        </div>
      )}

      {/* ── event ticker ────────────────────────────────── */}
      {lastEvent && (
        <div key={lastEvent.id} className="hud-bar ticker-enter pointer-events-auto flex items-baseline gap-2.5 border-t px-4 py-2" style={{ borderColor: "var(--rule)", borderBottom: "none" }}>
          <span className="mt-px inline-block h-2 w-2 shrink-0 self-center rounded-full" style={{ background: CATEGORY_COLORS[lastEvent.category] }} />
          <span className="shrink-0 font-semibold" style={{ color: "var(--color-ink)" }}>
            {lastEvent.title}
          </span>
          <span className="truncate" style={{ color: "var(--color-ink-muted)" }}>
            {lastEvent.description}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
            {fmtDay(lastEvent.day, yearLen)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── director ───────────────────────── */

const POLICY_GROUPS: {
  key: keyof ColonyPolicy;
  label: string;
  options: { value: string; hint: string }[];
}[] = [
  {
    key: "rationing",
    label: "Rations",
    options: [
      { value: "strict", hint: "Stores last longer; morale falls." },
      { value: "standard", hint: "Full rations, no morale effect." },
      { value: "generous", hint: "Morale rises; food drains faster." },
    ],
  },
  {
    key: "birthPolicy",
    label: "Families",
    options: [
      { value: "restricted", hint: "Births discouraged while the colony is fragile." },
      { value: "neutral", hint: "No colony position on family size." },
      { value: "encouraged", hint: "Population grows faster; more mouths sooner." },
    ],
  },
  {
    key: "laborPriority",
    label: "Labor",
    options: [
      { value: "balanced", hint: "No sector favoured." },
      { value: "food", hint: "Farms prioritized; industry and building slow." },
      { value: "industry", hint: "Mining, refining and fabrication prioritized." },
      { value: "construction", hint: "Crews build faster; production suffers." },
      { value: "learning", hint: "Teaching intensifies; skills spread, output dips." },
    ],
  },
  {
    key: "expeditions",
    label: "Survey",
    options: [
      { value: "cautious", hint: "Rare, safer expeditions." },
      { value: "normal", hint: "Regular survey rotation." },
      { value: "aggressive", hint: "Frequent expeditions; more teams lost." },
    ],
  },
];

function DirectorBar() {
  const sim = useSimStore((s) => s.sim);
  const setPolicy = useSimStore((s) => s.setPolicy);
  const version = useSimStore((s) => s.version);
  void version;
  const [hint, setHint] = useState<string | null>(null);

  return (
    <div
      className="pointer-events-auto flex flex-col gap-2 border-t px-4 py-2.5 backdrop-blur"
      style={{ background: "var(--color-paper-0)", borderColor: "var(--rule)" }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {POLICY_GROUPS.map((g) => (
          <div key={g.key} className="flex items-center gap-2">
            <span className="hud-label w-16 shrink-0">{g.label}</span>
            <div className="hud-seg">
              {g.options.map((o) => (
                <button
                  key={o.value}
                  className="hud-btn"
                  data-on={sim.policy[g.key] === o.value}
                  onClick={() => setPolicy(g.key, o.value as never)}
                  onMouseEnter={() => setHint(o.hint)}
                  onMouseLeave={() => setHint(null)}
                  onFocus={() => setHint(o.hint)}
                  onBlur={() => setHint(null)}
                >
                  {o.value}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
        {hint ?? "Policies take effect on the next simulated day and compound over generations."}
      </div>
    </div>
  );
}

/* ───────────────────────── panels ───────────────────────── */

const SIG_LABEL = ["", "routine", "notable", "defining"];

function HistoryPanel({ history, yearLen }: { history: HistoryEvent[]; yearLen: number }) {
  // Five centuries produce far more events than anyone can scroll. Filter by
  // significance and page through, rather than mounting the whole record.
  const [minSig, setMinSig] = useState<1 | 2 | 3>(2);
  const [limit, setLimit] = useState(60);
  const filtered = useMemo(
    () => history.filter((h) => h.significance >= minSig).reverse(),
    [history, minSig, history.length]
  );
  const shown = filtered.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <div className="hud-seg self-start">
        {([3, 2, 1] as const).map((s) => (
          <button key={s} onClick={() => { setMinSig(s); setLimit(60); }} className="hud-btn" data-on={minSig === s}>
            {s === 3 ? "defining" : s === 2 ? "notable" : "all"}
          </button>
        ))}
      </div>
      <div className="hud-label">
        {filtered.length.toLocaleString()} events at this level · showing {shown.length}
      </div>
      {shown.map((h) => (
        <div key={h.id} className="border-l-2 pl-3" style={{ borderColor: CATEGORY_COLORS[h.category] }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
              {h.title}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
              {fmtDay(h.day, yearLen)}
              {h.durationDays && h.durationDays > 1 ? ` · ${h.durationDays}d` : ""}
            </span>
          </div>
          <div className="mt-0.5 leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
            {h.description}
          </div>
          {h.significance === 3 && (
            <div className="hud-label mt-0.5" style={{ color: "var(--color-accent)" }}>
              {SIG_LABEL[h.significance]}
            </div>
          )}
        </div>
      ))}
      {shown.length < filtered.length && (
        <button onClick={() => setLimit((l) => l + 120)} className="hud-btn self-start">
          Load 120 more
        </button>
      )}
    </div>
  );
}

function PeoplePanel({ onSelect, yearLen }: { onSelect: (id: string) => void; yearLen: number }) {
  const sim = useSimStore((s) => s.sim);
  // deliberately not subscribed to `version`: re-rendering thousands of archive
  // rows on every simulated day is what made this panel slow to open
  const [showDead, setShowDead] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);

  const living = sim.colonists;
  const dead = sim.dead;
  const q = query.trim().toLowerCase();

  // The dead outnumber the living many times over by Year 500, so both lists are
  // filtered and paged rather than rendered whole.
  const rows = useMemo(() => {
    if (showDead) {
      const src = q ? dead.filter((d) => d.name.toLowerCase().includes(q)) : dead;
      return src.slice(-limit).reverse().map((d) => ({
        id: d.id, name: d.name, alive: false,
        meta: `${Math.floor(d.ageAtDeath)}y · ${d.occupation} · † ${d.deathCause} · ${fmtDay(d.deathDay, yearLen)}`,
      }));
    }
    const src = q ? living.filter((c) => c.name.toLowerCase().includes(q)) : living;
    return src.slice(0, limit).map((c) => ({
      id: c.id, name: c.name, alive: true,
      meta: `${Math.floor(c.ageYears)}y · ${c.occupation}${c.bornOnEarth ? " · Earth-born" : ` · gen ${c.generation}`}`,
    }));
    // keyed on counts rather than array identity: the roster only changes when
    // somebody is born or dies, so ticking the clock does not rebuild the list
  }, [showDead, q, limit, living, dead, living.length, dead.length, yearLen]);

  const total = showDead ? dead.length : living.length;

  return (
    <div>
      <div className="hud-seg mb-2">
        <button onClick={() => { setShowDead(false); setLimit(60); }} className="hud-btn" data-on={!showDead}>
          Living · {living.length.toLocaleString()}
        </button>
        <button onClick={() => { setShowDead(true); setLimit(60); }} className="hud-btn" data-on={showDead}>
          Dead · {dead.length.toLocaleString()}
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setLimit(60); }}
        placeholder="search by name"
        className="mb-2 w-full rounded-md border px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
        style={{ background: "var(--color-paper-2)", borderColor: "var(--rule)", color: "var(--color-ink)" }}
      />
      <div className="hud-label mb-1">
        showing {rows.length} of {total.toLocaleString()}
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-paper-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          >
            <span style={{ color: r.alive ? "var(--color-ink)" : "var(--color-ink-faint)" }}>{r.name}</span>{" "}
            <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-faint)" }}>{r.meta}</span>
          </button>
        ))}
      </div>
      {rows.length < total && (
        <button onClick={() => setLimit((l) => l + 200)} className="hud-btn mt-2 self-start">
          Load 200 more
        </button>
      )}
    </div>
  );
}

function PlanetPanel() {
  const sim = useSimStore((s) => s.sim);
  const p = sim.planet;
  const rows: [string, string][] = [
    ["Gravity", `${p.gravityG.toFixed(2)} g`],
    ["Day / Year", `${p.dayLengthHours.toFixed(1)} h · ${p.yearLengthDays} days`],
    ["Atmosphere", `N₂ ${p.atmosphere.n2}% · O₂ ${p.atmosphere.o2}% · CO₂ ${p.atmosphere.co2}%`],
    ["Pressure", `${p.atmosphere.pressureAtm.toFixed(2)} atm`],
    ["Mean temp", `${p.meanTempC.toFixed(1)} °C (±${p.seasonalRangeC.toFixed(0)}° seasonal)`],
    ["Water", p.hydrosphere],
    ["Soil", p.soilFertility],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div
        className="text-[16px] font-semibold tracking-[0.08em]"
        style={{ fontFamily: "var(--font-display-stack)", color: "var(--color-ink)" }}
      >
        {p.name}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <span className="hud-label">{label}</span>
            <span className="text-right font-mono text-[12px]" style={{ color: "var(--color-ink)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="hud-label mb-1">Hazards</div>
        <div style={{ color: "var(--color-ink-muted)" }}>{p.hazards.join("; ")}</div>
      </div>
      <div className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
        <div className="hud-label mb-2" style={{ color: "var(--color-accent)" }}>
          Native ecology
        </div>
        {sim.ecology.length === 0 && <div style={{ color: "var(--color-ink-muted)" }}>No native life detected.</div>}
        <div className="flex flex-col gap-2.5">
          {sim.ecology.map((sp) => (
            <div key={sp.id}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: "var(--color-ink)" }}>{sp.name}</span>
                <span className="font-mono text-[10.5px]" style={{ color: "var(--color-ink-faint)" }}>
                  {sp.role} · {sp.habitat}
                </span>
              </div>
              <div className="hud-meter mt-1">
                <div
                  style={{
                    width: `${sp.populationIndex}%`,
                    background: sp.populationIndex < 15 ? "var(--color-danger)" : "oklch(70% 0.11 130)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const TRADITION_TINT: Record<string, string> = {
  holiday: "oklch(80% 0.12 85)",
  ritual: "oklch(76% 0.10 350)",
  myth: "oklch(72% 0.11 310)",
  custom: "oklch(75% 0.10 190)",
  art: "oklch(74% 0.11 130)",
};

function CulturePanel({ yearLen }: { yearLen: number }) {
  const sim = useSimStore((s) => s.sim);
  const version = useSimStore((s) => s.version);
  void version;
  const living = sim.colonists.filter((c) => c.alive);
  const offworld = living.filter((c) => !c.bornOnEarth).length;
  const earthBorn = living.length - offworld;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="hud-label">Earth-born living</span>
          <span className="font-mono text-[12px]" style={{ color: earthBorn === 0 ? "var(--color-danger)" : "var(--color-ink)" }}>
            {earthBorn}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="hud-label">Born on {sim.planet.name}</span>
          <span className="font-mono text-[12px]" style={{ color: "var(--color-ink)" }}>
            {offworld}
          </span>
        </div>
        <div className="hud-meter mt-1">
          <div style={{ width: `${living.length ? (offworld / living.length) * 100 : 0}%` }} />
        </div>
        {earthBorn === 0 && sim.lastEarthMemoryHolderDeathDay !== undefined && (
          <div className="mt-1 leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
            Nobody alive remembers Earth. The last person who did died on day{" "}
            {sim.lastEarthMemoryHolderDeathDay}.
          </div>
        )}
      </div>

      <div className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
        <div className="hud-label mb-2" style={{ color: "var(--color-accent)" }}>
          Traditions
        </div>
        {sim.traditions.length === 0 && (
          <div className="leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
            No traditions yet. They emerge only from things the colony actually lives through — a famine
            survived, a team that never came home, a charter that holds.
          </div>
        )}
        {(["active", "faded"] as const).map((status) => {
          const list = sim.traditions.filter((t) => t.status === status);
          if (!list.length) return null;
          return (
            <div key={status} className="mb-3">
              <div className="hud-label mb-1.5">
                {status === "active" ? "Kept today" : "No longer kept"}
              </div>
              <div className="flex flex-col gap-3">
                {list.map((t) => (
                  <div
                    key={t.id}
                    className="border-l-2 pl-3"
                    style={{ borderColor: TRADITION_TINT[t.kind], opacity: status === "faded" ? 0.55 : 1 }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                        {t.name}
                      </span>
                      <span className="hud-chip shrink-0">{t.kind}</span>
                    </div>
                    <div className="mt-0.5 leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
                      {t.description}
                    </div>
                    {status === "active" && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="hud-label">observance</span>
                        <div className="hud-meter flex-1">
                          <div style={{ width: `${t.observance}%` }} />
                        </div>
                        <span className="font-mono text-[10.5px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
                          {Math.round(t.observance)}
                        </span>
                      </div>
                    )}
                    <div className="mt-0.5 font-mono text-[10.5px]" style={{ color: "var(--color-ink-faint)" }}>
                      took hold {fmtDay(t.foundedDay, yearLen)}
                      {t.lastRevivedDay ? ` · revived ${fmtDay(t.lastRevivedDay, yearLen)}` : ""}
                      {status === "faded" ? ` · peaked at ${Math.round(t.peakObservance)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {sim.factions.length > 0 && (
        <div className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
          <div className="hud-label mb-2" style={{ color: "var(--color-accent)" }}>
            Factions
          </div>
          <div className="flex flex-col gap-2">
            {sim.factions.map((f) => {
              const alive = f.memberIds.filter((id) => sim.colonists.find((c) => c.id === id)?.alive).length;
              return (
                <div key={f.id} className="flex items-baseline justify-between gap-2">
                  <span style={{ color: "var(--color-ink)" }}>{f.name}</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
                    {f.ideology} · {alive} living
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MuseumPanel() {
  const sim = useSimStore((s) => s.sim);
  const version = useSimStore((s) => s.version);
  void version;
  const [showArchived, setShowArchived] = useState(false);
  const [limit, setLimit] = useState(30);
  const hasMuseum = sim.buildings.some((b) => b.type === "museum" && b.condition > 25);
  const list = sim.museum.filter((m) => m.archived === showArchived);
  const shown = [...list].sort((a, b) => b.significance - a.significance).slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      {!hasMuseum && (
        <div className="leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
          No museum stands right now — these objects wait in storage for a civilization with the room to
          remember.
        </div>
      )}
      <div className="hud-seg self-start">
        <button onClick={() => { setShowArchived(false); setLimit(30); }} className="hud-btn" data-on={!showArchived}>
          On display · {sim.museum.filter((m) => !m.archived).length}
        </button>
        <button onClick={() => { setShowArchived(true); setLimit(30); }} className="hud-btn" data-on={showArchived}>
          In storage · {sim.museum.filter((m) => m.archived).length}
        </button>
      </div>
      {shown.map((m) => (
        <div key={m.id} className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--color-paper-2)" }}>
          <div className="font-semibold" style={{ color: "var(--color-accent)" }}>
            {m.name}
          </div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--color-ink-faint)" }}>
            kept because: {m.significanceReason}
          </div>
          <ul className="mt-1.5 flex list-inside list-disc flex-col gap-0.5 text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
            {m.provenance.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
      {shown.length < list.length && (
        <button onClick={() => setLimit((l) => l + 40)} className="hud-btn self-start">
          Load 40 more
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── building card ───────────────────────── */

const BUILDING_NAMES: Record<Building["type"], string> = {
  habitat_module: "Habitat Module",
  power_station: "Power Station",
  water_reclaimer: "Water Reclaimer",
  farm_dome: "Farm Dome",
  workshop: "Workshop",
  medbay: "Medical Bay",
  storage_depot: "Storage Depot",
  mine: "Mine",
  refinery: "Refinery",
  school: "School",
  hall_of_governance: "Hall of Governance",
  museum: "Museum",
  house: "Residential Block",
  market: "Market",
};

function BuildingCard({
  b,
  sim,
  yearLen,
  onClose,
  onSelect,
}: {
  b: Building;
  sim: ReturnType<typeof useSimStore.getState>["sim"];
  yearLen: number;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const ageYears = (sim.day - b.builtDay) / yearLen;
  const builders = (b.builtByIds ?? [])
    .map((id) => findPerson(sim, id))
    .filter((c): c is PersonView => !!c);
  const fabricCycles = Math.floor((b.fabricReplaced ?? 0) / 100);
  // events recorded while this structure was going up — the era it belongs to
  const era = sim.history
    .filter((h) => Math.abs(h.day - b.builtDay) < yearLen && h.category !== "crisis")
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="text-[17px] font-semibold tracking-[0.04em]"
            style={{ fontFamily: "var(--font-display-stack)", color: "var(--color-ink)" }}
          >
            {b.label || BUILDING_NAMES[b.type]}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px]" style={{ color: "var(--color-ink-muted)" }}>
            {BUILDING_NAMES[b.type]} · standing {ageYears < 1 ? "under a year" : `${Math.floor(ageYears)} years`}
          </div>
        </div>
        <button onClick={onClose} className="hud-btn" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="hud-label w-16 shrink-0">Condition</span>
        <div className="hud-meter w-full">
          <div
            style={{
              width: `${Math.max(0, Math.min(100, b.condition))}%`,
              background: b.condition < 35 ? "var(--color-danger)" : "var(--color-accent)",
            }}
          />
        </div>
        <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
          {Math.round(b.condition)}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
        <div>
          <span className="hud-label">Raised · </span>
          <span style={{ color: "var(--color-ink-muted)" }}>{fmtDay(b.builtDay, yearLen)}</span>
        </div>
        {builders.length > 0 ? (
          <div>
            <span className="hud-label">Crew · </span>
            {builders.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <RelLink c={c} onSelect={onSelect} />
              </span>
            ))}
          </div>
        ) : b.builtByName ? (
          <div>
            <span className="hud-label">Origin · </span>
            <span style={{ color: "var(--color-ink-muted)" }}>{b.builtByName}</span>
          </div>
        ) : null}
        {builders.length > 0 && builders.every((c) => !c.alive) && (
          <div className="leading-relaxed" style={{ color: "var(--color-ink-faint)" }}>
            Everyone who built this is dead. It has outlived its makers.
          </div>
        )}
        {(b.renovations > 0 || fabricCycles > 0) && (
          <div className="leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
            {b.renovations > 0 && (
              <>Rebuilt from ruin {b.renovations} time{b.renovations === 1 ? "" : "s"}
                {b.renovatedByName ? `, most recently under ${b.renovatedByName}` : ""}. </>
            )}
            {fabricCycles > 0 && (
              <>Its fabric has been made good the equivalent of {fabricCycles} whole rebuild
                {fabricCycles === 1 ? "" : "s"}, piece by piece — little of what was first raised is still here.</>
            )}
          </div>
        )}
      </div>

      {era.length > 0 && (
        <div className="border-t pt-3" style={{ borderColor: "var(--rule)" }}>
          <div className="hud-label mb-1.5">Standing when it was raised</div>
          <div className="flex flex-col gap-1">
            {era.map((h) => (
              <div key={h.id} className="text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
                {h.title}{" "}
                <span className="font-mono text-[10.5px]" style={{ color: "var(--color-ink-faint)" }}>
                  {fmtDay(h.day, yearLen)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── colonist card ───────────────────────── */

function Meter({ value, color }: { value: number; color?: string }) {
  return (
    <div className="hud-meter w-full">
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? "var(--color-accent)" }} />
    </div>
  );
}

function ColonistCard({
  c,
  all,
  onClose,
  onSelect,
  godMode,
  onKill,
}: {
  c: Colonist;
  all: Colonist[];
  onClose: () => void;
  onSelect: (id: string) => void;
  godMode: boolean;
  onKill: () => void;
}) {
  const sim = useSimStore((s) => s.sim);
  const earth = earthKnowledge(sim, c);
  // relationships resolve through the archive too, so the dead stay nameable
  const rel = (kind: string) =>
    c.relationships
      .filter((r) => r.kind === kind)
      .map((r) => findPerson(sim, r.colonistId))
      .filter((x): x is PersonView => !!x);
  void all;
  const spouse = rel("spouse")[0];
  const children = rel("child");
  const parents = rel("parent");
  const friends = rel("friend");
  const skills = (Object.entries(c.skills) as [string, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="text-[17px] font-semibold tracking-[0.04em]"
            style={{ fontFamily: "var(--font-display-stack)", color: "var(--color-ink)" }}
          >
            {c.name}
          </div>
          <div className="mt-0.5 font-mono text-[11.5px]" style={{ color: "var(--color-ink-muted)" }}>
            {c.alive ? `Age ${Math.floor(c.ageYears)}` : `† age ${Math.floor(c.ageYears)} — ${c.deathCause}`} · {c.occupation} ·{" "}
            {c.bornOnEarth ? "Earth-born" : `generation ${c.generation}`}
          </div>
        </div>
        <button onClick={onClose} className="hud-btn" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
        {c.appearance.heightCm} cm, {c.appearance.build} build, {c.appearance.hairStyle} hair, {c.appearance.complexion} complexion
        {c.appearance.distinguishingFeature ? `; ${c.appearance.distinguishingFeature}` : ""}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {c.personality.map((t) => (
          <span key={t} className="hud-chip">
            {t}
          </span>
        ))}
        <span className="hud-chip" style={{ color: "var(--color-accent)", borderColor: "var(--color-accent-strong)" }}>
          {c.ideology}
        </span>
      </div>

      {c.alive && (
        <div className="flex flex-col gap-2">
          {(
            [
              ["Physical", c.health.physical, undefined],
              ["Mental", c.health.mental, undefined],
              ["Morale", c.morale, c.morale < 30 ? "var(--color-danger)" : undefined],
            ] as [string, number, string | undefined][]
          ).map(([label, v, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="hud-label w-16 shrink-0">{label}</span>
              <Meter value={v} color={color} />
              <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
                {Math.round(v)}
              </span>
            </div>
          ))}
          {(c.health.pregnant || c.health.chronicConditions.length > 0) && (
            <div className="font-mono text-[11.5px]" style={{ color: "var(--color-ink-muted)" }}>
              {c.health.pregnant && "pregnant"}
              {c.health.pregnant && c.health.chronicConditions.length > 0 && " · "}
              {c.health.chronicConditions.join(", ")}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border p-2" style={{ borderColor: "var(--rule)", background: "var(--color-paper-2)" }}>
        <div className="hud-label mb-0.5">What they know of Earth</div>
        <div className="text-[12px]" style={{ color: "var(--color-ink)" }}>
          <span style={{ color: "var(--color-accent)" }}>{earth.level}</span> · via {earth.source}
        </div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
          {earth.detail}
        </div>
      </div>

      {c.trainedVia && c.trainedVia !== "none" && (
        <div className="text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
          <span className="hud-label">Trained · </span>
          {c.trainedVia === "school"
            ? `at the colony school under ${c.trainedBy}`
            : c.trainedVia === "parent"
            ? `by their parent, ${c.trainedBy}`
            : c.trainedVia === "practitioner"
            ? `apprenticed to ${c.trainedBy}`
            : "reconstructed from written records — no living teacher remained"}
        </div>
      )}

      {skills.length > 0 && (
        <div>
          <div className="hud-label mb-1.5">Skills</div>
          <div className="flex flex-col gap-1.5">
            {skills.map(([s, v]) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-[11.5px]" style={{ color: "var(--color-ink-muted)" }}>
                  {s}
                </span>
                <Meter value={v} />
                <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(c.goals.length > 0 || c.fears.length > 0 || c.possessions.length > 0) && (
        <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
          {c.goals.length > 0 && (
            <div>
              <span className="hud-label">Goals · </span>
              <span style={{ color: "var(--color-ink-muted)" }}>{c.goals.join("; ")}</span>
            </div>
          )}
          {c.fears.length > 0 && (
            <div>
              <span className="hud-label">Fears · </span>
              <span style={{ color: "var(--color-ink-muted)" }}>{c.fears.join("; ")}</span>
            </div>
          )}
          {c.possessions.length > 0 && (
            <div>
              <span className="hud-label">Carries · </span>
              <span style={{ color: "var(--color-ink-muted)" }}>{c.possessions.join("; ")}</span>
            </div>
          )}
        </div>
      )}

      {(spouse || parents.length > 0 || children.length > 0 || friends.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
          {spouse && (
            <div>
              <span className="hud-label">Spouse · </span>
              <RelLink c={spouse} onSelect={onSelect} />
            </div>
          )}
          {parents.length > 0 && (
            <div>
              <span className="hud-label">Parents · </span>
              {parents.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <RelLink c={p} onSelect={onSelect} />
                </span>
              ))}
            </div>
          )}
          {children.length > 0 && (
            <div>
              <span className="hud-label">Children · </span>
              {children.map((ch, i) => (
                <span key={ch.id}>
                  {i > 0 && ", "}
                  <RelLink c={ch} onSelect={onSelect} />
                </span>
              ))}
            </div>
          )}
          {friends.length > 0 && (
            <div>
              <span className="hud-label">Friends · </span>
              {friends.slice(0, 5).map((f, i) => (
                <span key={f.id}>
                  {i > 0 && ", "}
                  <RelLink c={f} onSelect={onSelect} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {godMode && c.alive && (
        <button onClick={onKill} className="hud-btn mt-1 self-start" data-tone="danger">
          ☠ Remove from simulation
        </button>
      )}
    </div>
  );
}

function RelLink({ c, onSelect }: { c: PersonView | Colonist; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(c.id)}
      className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
      style={{ color: c.alive ? "var(--color-ink)" : "var(--color-ink-faint)", textDecoration: c.alive ? undefined : "line-through" }}
    >
      {c.name}
    </button>
  );
}
