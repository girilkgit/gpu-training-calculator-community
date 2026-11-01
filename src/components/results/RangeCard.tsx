import { useEffect, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { simulateWallHours, type SimResult } from '@/lib/montecarlo';
import { computeCost, type JobInputs, type RunResult, type CostInputs, type CostResult } from '@/lib/model';
import type { CalculatorState, CalculatorResult } from '@/hooks/useCalculator';

function compactHours(h: number, dp = 0): string {
  if (!isFinite(h) || h < 0) return '—';
  if (h >= 1000) return `${(h / 1000).toFixed(h >= 10000 ? 0 : 1)}k h`;
  return `${h.toFixed(dp)} h`;
}

function compactUSD(v: number, dp?: number): string {
  if (!isFinite(v) || v < 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(dp ?? (v >= 1e7 ? 0 : 1))}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(dp ?? 0)}K`;
  return `$${Math.round(v)}`;
}

/** Narrow ranges need more digits, otherwise lucky and safe look identical. */
function narrow(p10: number, p50: number, p90: number): boolean {
  return p50 > 0 && (p90 - p10) / p50 < 0.05;
}

function RangeRow({
  label,
  p10,
  p50,
  p90,
  fmt,
}: {
  label: string;
  p10: number;
  p50: number;
  p90: number;
  fmt: (v: number) => string;
}) {
  const span = p90 - p10;
  const pct = span > 1e-9 ? Math.max(0, Math.min(100, ((p50 - p10) / span) * 100)) : 50;
  const labelPct = Math.max(16, Math.min(84, pct));

  return (
    <div className="flex items-start gap-3">
      <span className="w-10 shrink-0 pt-5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative min-w-0 flex-1 pt-5">
        <span
          className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"
          style={{ left: `${labelPct}%` }}
        >
          Typical · <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{fmt(p50)}</span>
        </span>
        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-rose-500 dark:from-emerald-500 dark:via-amber-400 dark:to-rose-500">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800 shadow dark:border-slate-900 dark:bg-white"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span className="whitespace-nowrap">
            Lucky · <span className="tabular-nums">{fmt(p10)}</span>
          </span>
          <span className="whitespace-nowrap">
            Safe budget · <span className="tabular-nums">{fmt(p90)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RangeCard({
  state,
  result,
}: {
  state: CalculatorState;
  result: CalculatorResult;
}) {
  const { run, cost } = result;
  const rel = state.rel;
  const job: JobInputs = state.job;
  const costInputs: CostInputs = state.cost;

  // Debounced simulation: recompute 300 ms after the inputs stop changing.
  const sig = [
    run.trainHours,
    run.intervalHours,
    run.mtbfHours,
    rel.checkpointStallHours,
    rel.recoveryHours,
    rel.setupHours,
    costInputs.billing,
    costInputs.reservedHours,
  ].join('|');

  const [sim, setSim] = useState<(SimResult & { setup: number }) | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const r = simulateWallHours({
        trainHours: run.trainHours,
        intervalHours: run.intervalHours,
        stallHours: rel.checkpointStallHours,
        recoveryHours: rel.recoveryHours,
        mtbfHours: run.mtbfHours,
        trials: 2000,
        seed: 42,
      });
      const setup = rel.setupHours;
      setSim({ mean: r.mean + setup, p10: r.p10 + setup, p50: r.p50 + setup, p90: r.p90 + setup, setup });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const [showHelp, setShowHelp] = useState(false);

  if (rel.method !== 'daly' || !sim) return null;

  const isReserved = costInputs.billing === 'reserved';

  // Cost at each percentile: rebuild a RunResult with totalHours swapped for the percentile.
  const costAt = (hours: number): CostResult => {
    const modRun: RunResult = { ...run, totalHours: hours };
    return computeCost(job, modRun, costInputs);
  };

  const t10 = sim.p10;
  const t50 = sim.p50;
  const t90 = sim.p90;

  const hoursDp = Math.round(t10) === Math.round(t90) ? 1 : 0;

  const c10 = costAt(t10).totalCost;
  const c50 = costAt(t50).totalCost;
  const c90 = costAt(t90).totalCost;
  const costDp = narrow(c10, c50, c90) && c50 >= 1e6 ? 2 : undefined;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Range of outcomes</h3>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Crash luck only · simulated 2,000 times</span>
      </div>

      <div className="space-y-2">
        <RangeRow label="Time" p10={t10} p50={t50} p90={t90} fmt={(v) => compactHours(v, hoursDp)} />
        {isReserved ? (
          <div className="flex items-baseline gap-3">
            <span className="w-10 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">Cost</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {compactUSD(cost.totalCost)}
              </span>{' '}
              · Reserved capacity costs the same however long the run takes
            </span>
          </div>
        ) : (
          <RangeRow label="Cost" p10={c10} p50={c50} p90={c90} fmt={(v) => compactUSD(v, costDp)} />
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setShowHelp((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Info className="h-3.5 w-3.5" />
          How to read this
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHelp ? '' : '-rotate-90'}`} />
        </button>
        {showHelp && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            This shows how much your run could vary just from the luck of when GPUs crash. The bar runs from a lucky run
            (left: 1 in 10 runs finish this fast or faster) to a safe budget (right: 9 in 10 runs finish by this
            point). The dot is the typical run, where half finish sooner and half later. Plan on the right-hand
            figure if you need to be safe. This range covers crash luck only. It does not cover being wrong about
            your inputs, such as MFU or failure rate. &lsquo;What matters most&rsquo; shows that.
          </p>
        )}
      </div>
    </div>
  );
}