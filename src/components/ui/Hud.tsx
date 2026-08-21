"use client";
import { useMemo, useState } from "react";
import { useSimStore, type TimeSpeed, type PlayerMode } from "@/store/simStore";
import type { Colonist, HistoryEvent, ResourceKind } from "@/lib/sim/types";

const STAGE_LABELS: Record<string, string> = {
  landing_camp: "Landing Camp",
  modular_settlement: "Modular Settlement",
  permanent_buildings: "Permanent Settlement",
  town: "Town",
  city: "City",
  regional_civilization: "Regional Civilization",
};

const CATEGORY_COLORS: Record<HistoryEvent["category"], string> = {
  landing: "#e8c468",
  birth: "#8fd18f",
  death: "#d98080",
  construction: "#8fb8d8",
  crisis: "#e07850",
  governance: "#c8a0e0",
  culture: "#e8b8d0",
  exploration: "#80c8c0",
  technology: "#a8b8e8",
  ecology: "#a0c880",
};

function fmtDay(day: number, yearLen: number) {
  const year = Math.floor(day / yearLen) + 1;
  const doy = (day % yearLen) + 1;
  return `Year ${year}, Day ${doy}`;
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
  const selectColonist = useSimStore((s) => s.selectColonist);
  const killColonist = useSimStore((s) => s.killColonist);
  const grantResources = useSimStore((s) => s.grantResources);
  const reset = useSimStore((s) => s.reset);
  void version;

  const [panel, setPanel] = useState<"history" | "people" | "planet" | "museum" | null>(null);
  const [skipping, setSkipping] = useState(false);

  const living = useMemo(() => sim.colonists.filter((c) => c.alive), [sim.colonists, version]);
  const selected = selectedId ? sim.colonists.find((c) => c.id === selectedId) : null;
  const yearLen = sim.planet.yearLengthDays;
  const extinct = living.length === 0;

  const leaders = sim.government.leaderIds
    .map((id) => sim.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => !!c && c.alive);

  function doSkip(years: number) {
    setSkipping(true);
    // let the UI paint the "simulating" state before the blocking loop
    setTimeout(() => {
      skipYears(years);
      setSkipping(false);
    }, 30);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col font-mono text-[13px] text-stone-200">
      {/* top bar */}
      <div className="pointer-events-auto flex items-center gap-4 bg-black/60 px-4 py-2 backdrop-blur">
        <span className="text-base font-bold tracking-widest text-amber-200">SECOND DAWN</span>
        <span className="text-stone-400">{sim.planet.name}</span>
        <span>{fmtDay(sim.day, yearLen)}</span>
        <span className="text-stone-400">{STAGE_LABELS[sim.settlementStage]}</span>
        <span className={extinct ? "text-red-400" : ""}>
          Pop {living.length}
          {extinct && " — EXTINCT"}
        </span>
        <span className="text-stone-400">
          {sim.government.systemName}
          {leaders.length > 0 && ` · ${leaders[0].name}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {([0, 1, 10, 100] as TimeSpeed[]).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-0.5 ${speed === s ? "bg-amber-500 text-black" : "bg-stone-800 hover:bg-stone-700"}`}
            >
              {s === 0 ? "⏸" : `${s}×`}
            </button>
          ))}
          <button
            onClick={() => doSkip(1)}
            disabled={skipping || extinct}
            className="rounded bg-stone-800 px-2 py-0.5 hover:bg-stone-700 disabled:opacity-40"
          >
            +1yr
          </button>
          <button
            onClick={() => doSkip(10)}
            disabled={skipping || extinct}
            className="rounded bg-stone-800 px-2 py-0.5 hover:bg-stone-700 disabled:opacity-40"
          >
            +10yr
          </button>
          {skipping && <span className="animate-pulse text-amber-300">simulating…</span>}
        </div>
      </div>

      {/* resource strip */}
      <div className="pointer-events-auto flex flex-wrap gap-x-4 gap-y-1 bg-black/45 px-4 py-1.5 text-[12px] backdrop-blur">
        {(
          [
            ["food", "Food"],
            ["water", "Water"],
            ["energy", "Energy"],
            ["medicine", "Meds"],
            ["rawMaterials", "Ore"],
            ["materials", "Materials"],
            ["components", "Components"],
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
            <span key={k} className={low ? "text-red-400" : "text-stone-300"}>
              {label} <b>{Math.floor(v)}</b>
              {rate !== undefined && (
                <span className={rate >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {" "}
                  {rate >= 0 ? "+" : ""}
                  {rate}/d
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* left panel buttons */}
      <div className="pointer-events-auto mt-2 flex gap-1 px-3">
        {(["history", "people", "planet", "museum"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPanel(panel === p ? null : p)}
            className={`rounded px-2 py-1 capitalize ${panel === p ? "bg-amber-500 text-black" : "bg-black/60 hover:bg-stone-800"}`}
          >
            {p}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {(["observer", "director", "colonist", "god"] as PlayerMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 capitalize ${mode === m ? "bg-purple-400 text-black" : "bg-black/60 hover:bg-stone-800"}`}
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

      <div className="flex flex-1 overflow-hidden">
        {/* left panel */}
        {panel && (
          <div className="pointer-events-auto m-3 flex w-[380px] flex-col overflow-hidden rounded-lg bg-black/70 backdrop-blur">
            <div className="border-b border-stone-700 px-3 py-2 font-bold capitalize text-amber-200">{panel}</div>
            <div className="flex-1 overflow-y-auto p-3">
              {panel === "history" && <HistoryPanel history={sim.history} yearLen={yearLen} />}
              {panel === "people" && (
                <PeoplePanel colonists={sim.colonists} onSelect={selectColonist} yearLen={yearLen} />
              )}
              {panel === "planet" && <PlanetPanel />}
              {panel === "museum" && <MuseumPanel />}
            </div>
          </div>
        )}
        <div className="flex-1" />
        {/* colonist inspector */}
        {selected && (
          <div className="pointer-events-auto m-3 w-[340px] self-start overflow-y-auto rounded-lg bg-black/70 p-3 backdrop-blur" style={{ maxHeight: "70vh" }}>
            <ColonistCard
              c={selected}
              all={sim.colonists}
              yearLen={yearLen}
              onClose={() => selectColonist(null)}
              onSelect={selectColonist}
              godMode={mode === "god"}
              onKill={() => killColonist(selected.id)}
            />
          </div>
        )}
      </div>

      {/* god mode toolbar */}
      {mode === "god" && (
        <div className="pointer-events-auto flex items-center gap-2 bg-purple-950/70 px-4 py-2 backdrop-blur">
          <span className="text-purple-300">EXPERIMENT MODE</span>
          <button onClick={grantResources} className="rounded bg-purple-700 px-2 py-0.5 hover:bg-purple-600">
            Grant supply drop
          </button>
          <button onClick={() => reset()} className="rounded bg-purple-700 px-2 py-0.5 hover:bg-purple-600">
            New colony (new seed)
          </button>
          <span className="text-purple-400/70">Click a colonist, then use their card to intervene.</span>
        </div>
      )}

      {/* latest event ticker */}
      {sim.history.length > 0 && (
        <div className="pointer-events-auto bg-black/60 px-4 py-1.5 text-[12px] backdrop-blur">
          {(() => {
            const last = sim.history[sim.history.length - 1];
            return (
              <span>
                <span style={{ color: CATEGORY_COLORS[last.category] }}>■</span>{" "}
                <b>{last.title}</b> — {last.description}{" "}
                <span className="text-stone-500">({fmtDay(last.day, yearLen)})</span>
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ history, yearLen }: { history: HistoryEvent[]; yearLen: number }) {
  return (
    <div className="flex flex-col gap-2">
      {[...history].reverse().map((h) => (
        <div key={h.id} className="border-l-2 pl-2" style={{ borderColor: CATEGORY_COLORS[h.category] }}>
          <div className="font-bold">{h.title}</div>
          <div className="text-stone-400">{h.description}</div>
          <div className="text-[11px] text-stone-500">{fmtDay(h.day, yearLen)}</div>
        </div>
      ))}
    </div>
  );
}

function PeoplePanel({
  colonists,
  onSelect,
  yearLen,
}: {
  colonists: Colonist[];
  onSelect: (id: string) => void;
  yearLen: number;
}) {
  void yearLen;
  const [showDead, setShowDead] = useState(false);
  const living = colonists.filter((c) => c.alive);
  const dead = colonists.filter((c) => !c.alive);
  const list = showDead ? dead : living;
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => setShowDead(false)}
          className={`rounded px-2 py-0.5 ${!showDead ? "bg-amber-500 text-black" : "bg-stone-800"}`}
        >
          Living ({living.length})
        </button>
        <button
          onClick={() => setShowDead(true)}
          className={`rounded px-2 py-0.5 ${showDead ? "bg-amber-500 text-black" : "bg-stone-800"}`}
        >
          Dead ({dead.length})
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {list.slice(0, 400).map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="rounded px-2 py-1 text-left hover:bg-stone-800"
          >
            <span className={c.alive ? "" : "text-stone-500 line-through"}>{c.name}</span>{" "}
            <span className="text-stone-500">
              {Math.floor(c.ageYears)}y · {c.occupation}
              {!c.bornOnEarth && " · offworld-born"}
              {!c.alive && c.deathCause ? ` · † ${c.deathCause}` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanetPanel() {
  const sim = useSimStore((s) => s.sim);
  const p = sim.planet;
  return (
    <div className="flex flex-col gap-2">
      <div>
        <b>{p.name}</b> — gravity {p.gravityG.toFixed(2)}g, day {p.dayLengthHours.toFixed(1)}h, year{" "}
        {p.yearLengthDays} days
      </div>
      <div>
        Atmosphere: N₂ {p.atmosphere.n2}% · O₂ {p.atmosphere.o2}% · CO₂ {p.atmosphere.co2}% ·{" "}
        {p.atmosphere.pressureAtm.toFixed(2)} atm
      </div>
      <div>
        Mean temp {p.meanTempC.toFixed(1)}°C (±{p.seasonalRangeC.toFixed(0)}° seasonal) · water:{" "}
        {p.hydrosphere} · soil: {p.soilFertility}
      </div>
      <div>Hazards: {p.hazards.join("; ")}</div>
      <div className="mt-2 border-t border-stone-700 pt-2 font-bold text-amber-200">Native ecology</div>
      {sim.ecology.length === 0 && <div className="text-stone-400">No native life detected.</div>}
      {sim.ecology.map((sp) => (
        <div key={sp.id} className="text-stone-300">
          <b>{sp.name}</b> <span className="text-stone-500">({sp.role}, {sp.habitat})</span>
          <div className="h-1.5 w-full rounded bg-stone-800">
            <div
              className="h-1.5 rounded"
              style={{
                width: `${sp.populationIndex}%`,
                background: sp.populationIndex < 15 ? "#d98080" : "#a0c880",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MuseumPanel() {
  const sim = useSimStore((s) => s.sim);
  const hasMuseum = sim.buildings.some((b) => b.type === "museum");
  return (
    <div className="flex flex-col gap-3">
      {!hasMuseum && (
        <div className="text-stone-400">
          No museum building exists yet — these artifacts are held in storage, waiting for a civilization
          that wants to remember.
        </div>
      )}
      {sim.museum.map((m) => (
        <div key={m.id} className="rounded bg-stone-900/70 p-2">
          <div className="font-bold text-amber-100">{m.name}</div>
          <ul className="mt-1 list-inside list-disc text-[12px] text-stone-400">
            {m.provenance.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ColonistCard({
  c,
  all,
  yearLen,
  onClose,
  onSelect,
  godMode,
  onKill,
}: {
  c: Colonist;
  all: Colonist[];
  yearLen: number;
  onClose: () => void;
  onSelect: (id: string) => void;
  godMode: boolean;
  onKill: () => void;
}) {
  void yearLen;
  const rel = (kind: string) =>
    c.relationships
      .filter((r) => r.kind === kind)
      .map((r) => all.find((x) => x.id === r.colonistId))
      .filter((x): x is Colonist => !!x);
  const spouse = rel("spouse")[0];
  const children = rel("child");
  const parents = rel("parent");
  const friends = rel("friend");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-bold text-amber-100">{c.name}</div>
          <div className="text-stone-400">
            {c.alive ? `Age ${Math.floor(c.ageYears)}` : `Died age ${Math.floor(c.ageYears)} — ${c.deathCause}`} ·{" "}
            {c.occupation} · {c.bornOnEarth ? "born on Earth" : "offworld-born"}
          </div>
        </div>
        <button onClick={onClose} className="text-stone-500 hover:text-white">
          ✕
        </button>
      </div>
      <div className="text-stone-300">
        {c.appearance.heightCm}cm, {c.appearance.build} build, {c.appearance.hairStyle} hair,{" "}
        {c.appearance.complexion} complexion
        {c.appearance.distinguishingFeature ? `; ${c.appearance.distinguishingFeature}` : ""}
      </div>
      <div>
        <span className="text-stone-500">Personality:</span> {c.personality.join(", ")} ·{" "}
        <span className="text-stone-500">ideology:</span> {c.ideology}
      </div>
      {Object.keys(c.skills).length > 0 && (
        <div>
          <span className="text-stone-500">Skills:</span>{" "}
          {(Object.entries(c.skills) as [string, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([s, v]) => `${s} ${v}`)
            .join(", ")}
        </div>
      )}
      {c.alive && (
        <div>
          <span className="text-stone-500">Health:</span> {Math.round(c.health.physical)} phys /{" "}
          {Math.round(c.health.mental)} mental · <span className="text-stone-500">morale:</span>{" "}
          {Math.round(c.morale)}
          {c.health.pregnant && " · pregnant"}
          {c.health.chronicConditions.length > 0 && ` · ${c.health.chronicConditions.join(", ")}`}
        </div>
      )}
      {c.goals.length > 0 && (
        <div>
          <span className="text-stone-500">Goals:</span> {c.goals.join("; ")}
        </div>
      )}
      {c.fears.length > 0 && (
        <div>
          <span className="text-stone-500">Fears:</span> {c.fears.join("; ")}
        </div>
      )}
      {c.possessions.length > 0 && (
        <div>
          <span className="text-stone-500">Possessions:</span> {c.possessions.join("; ")}
        </div>
      )}
      {(spouse || parents.length > 0 || children.length > 0 || friends.length > 0) && (
        <div className="border-t border-stone-700 pt-2">
          {spouse && (
            <div>
              <span className="text-stone-500">Spouse:</span>{" "}
              <RelLink c={spouse} onSelect={onSelect} />
            </div>
          )}
          {parents.length > 0 && (
            <div>
              <span className="text-stone-500">Parents:</span>{" "}
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
              <span className="text-stone-500">Children:</span>{" "}
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
              <span className="text-stone-500">Friends:</span>{" "}
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
        <button onClick={onKill} className="mt-2 rounded bg-red-900 px-2 py-1 text-red-200 hover:bg-red-800">
          ☠ Remove from simulation (experiment)
        </button>
      )}
    </div>
  );
}

function RelLink({ c, onSelect }: { c: Colonist; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(c.id)} className={`underline decoration-dotted hover:text-amber-200 ${c.alive ? "" : "text-stone-500 line-through"}`}>
      {c.name}
    </button>
  );
}
