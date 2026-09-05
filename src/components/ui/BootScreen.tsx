"use client";

/**
 * Boot screen — the W3 group's shared loading pattern, in second-dawn's palette.
 *
 * This app had none. The dynamic import of WorldScene carried no `loading:`
 * fallback, so between opening the page and the first drawn frame there was a
 * black rectangle and nothing else: no wordmark, no sign that anything was
 * happening, no way to tell a slow machine from a broken one.
 *
 * Two waits, reported honestly because they differ in kind:
 *  - `chunk`  the scene bundle is downloading. Nothing here can measure that,
 *             so the bar runs INDETERMINATE — the pattern's documented
 *             fallback, never its default.
 *  - `scene`  the bundle has landed and the world is meshing and compiling.
 *             That is countable in frames, so the bar is determinate.
 */
export function BootScreen({
  stage,
  progress = 0,
}: {
  stage: "chunk" | "scene";
  progress?: number;
}) {
  const indeterminate = stage === "chunk";
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div className="sd-boot">
      <div className="sd-boot-inner">
        <div className="sd-boot-mark">SECOND DAWN</div>
        <div className="sd-boot-sub">a colony, two hundred years</div>

        <div
          className="sd-boot-bar"
          data-indeterminate={indeterminate ? "true" : undefined}
          role="progressbar"
          aria-label="Loading the colony"
          aria-valuemin={0}
          aria-valuemax={100}
          {...(indeterminate ? {} : { "aria-valuenow": pct })}
        >
          <i style={{ ["--p" as string]: progress }} />
        </div>

        <div className="sd-boot-status">
          {indeterminate ? "opening the record" : `surveying the valley · ${pct}%`}
        </div>
      </div>
    </div>
  );
}
