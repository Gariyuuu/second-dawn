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
          {(["history", "people", "planet", "museum"] as const).map((p) => (
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
              {panel === "people" && <PeoplePanel colonists={sim.colonists} onSelect={selectColonist} />}
              {panel === "planet" && <PlanetPanel />}
              {panel === "museum" && <MuseumPanel />}
            </div>
          </div>
        )}
        <div className="flex-1" />
        {/* colonist inspector */}
        {selected && (
          <div className="hud-panel hud-scroll pointer-events-auto m-3 w-[350px] self-start overflow-y-auto p-4" style={{ maxHeight: "70vh" }}>
            <ColonistCard
              c={selected}
              all={sim.colonists}
              onClose={() => selectColonist(null)}
              onSelect={selectColonist}
              godMode={mode === "god"}
              onKill={() => killColonist(selected.id)}
            />
          </div>
        )}
      </div>

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

/* ───────────────────────── panels ───────────────────────── */

function HistoryPanel({ history, yearLen }: { history: HistoryEvent[]; yearLen: number }) {
  return (
    <div className="flex flex-col gap-3">
      {[...history].reverse().map((h) => (
        <div key={h.id} className="border-l-2 pl-3" style={{ borderColor: CATEGORY_COLORS[h.category] }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
              {h.title}
            </span>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums" style={{ color: "var(--color-ink-faint)" }}>
              {fmtDay(h.day, yearLen)}
            </span>
          </div>
          <div className="mt-0.5 leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
            {h.description}
          </div>
        </div>
      ))}
    </div>
  );
}

function PeoplePanel({ colonists, onSelect }: { colonists: Colonist[]; onSelect: (id: string) => void }) {
  const [showDead, setShowDead] = useState(false);
  const living = colonists.filter((c) => c.alive);
  const dead = colonists.filter((c) => !c.alive);
  const list = showDead ? dead : living;
  return (
    <div>
      <div className="hud-seg mb-3">
        <button onClick={() => setShowDead(false)} className="hud-btn" data-on={!showDead}>
          Living · {living.length}
        </button>
        <button onClick={() => setShowDead(true)} className="hud-btn" data-on={showDead}>
          Dead · {dead.length}
        </button>
      </div>
      <div className="flex flex-col">
        {list.slice(0, 400).map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-paper-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          >
            <span style={{ color: c.alive ? "var(--color-ink)" : "var(--color-ink-faint)", textDecoration: c.alive ? "none" : "line-through" }}>
              {c.name}
            </span>{" "}
            <span className="font-mono text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
              {Math.floor(c.ageYears)}y · {c.occupation}
              {!c.bornOnEarth && " · offworld"}
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

function MuseumPanel() {
  const sim = useSimStore((s) => s.sim);
  const hasMuseum = sim.buildings.some((b) => b.type === "museum");
  return (
    <div className="flex flex-col gap-3">
      {!hasMuseum && (
        <div className="leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
          No museum building exists yet — these artifacts wait in storage for a civilization that wants to
          remember.
        </div>
      )}
      {sim.museum.map((m) => (
        <div key={m.id} className="rounded-lg border p-3" style={{ borderColor: "var(--rule)", background: "var(--color-paper-2)" }}>
          <div className="font-semibold" style={{ color: "var(--color-accent)" }}>
            {m.name}
          </div>
          <ul className="mt-1.5 flex list-inside list-disc flex-col gap-0.5 text-[12px]" style={{ color: "var(--color-ink-muted)" }}>
            {m.provenance.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
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
  const rel = (kind: string) =>
    c.relationships
      .filter((r) => r.kind === kind)
      .map((r) => all.find((x) => x.id === r.colonistId))
      .filter((x): x is Colonist => !!x);
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
            {c.bornOnEarth ? "Earth-born" : "offworld-born"}
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

function RelLink({ c, onSelect }: { c: Colonist; onSelect: (id: string) => void }) {
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
