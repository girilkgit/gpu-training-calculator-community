import { useMemo, useState } from 'react';
import { computeRun, computeCost, type JobInputs, type ReliabilityInputs, type CostInputs } from '@/lib/model';
import { CHIPS, FAILURE_PRESETS, RECOVERY_PRESETS, CHECKPOINT } from '@/data/defaults';
import type { CalculatorState, CalculatorResult } from '@/hooks/useCalculator';
import { formatUSD } from '@/lib/format';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';

function compactUSD(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

interface Driver {
  label: string;
  low: number;
  high: number;
  apply: (value: number, job: JobInputs, rel: ReliabilityInputs, cost: CostInputs) => {
    job: JobInputs;
    rel: ReliabilityInputs;
    cost: CostInputs;
  };
}

interface EvaluatedDriver {
  label: string;
  cheaper: number;
  costlier: number;
  swing: number;
}

function Bar({ d, baselinePct }: { d: EvaluatedDriver; baselinePct: number }) {
  // The filled bar runs from cheaper to costlier on the shared scale.
  // Blue is the portion left of the centre line; orange is the right.
  // CSS vars (--bar-left, --bar-width, --blue-width) are set on the row.
  void d; void baselinePct;
  return (
    <div className="relative h-5 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-900/50">
      <div className="absolute top-0 bottom-0" style={{ left: 'var(--bar-left)', width: 'var(--bar-width)' }}>
        <div className="absolute top-0 bottom-0" style={{ left: 0, width: 'var(--blue-width)', background: '#3b82f6' }} />
        <div className="absolute top-0 bottom-0" style={{ left: 'var(--blue-width)', right: 0, background: '#f97316' }} />
      </div>
    </div>
  );
}

function Collapsible({ label, children, open: openProp }: { label: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(openProp ?? false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function SensitivityChart({ state, result }: { state: CalculatorState; result: CalculatorResult }) {
  const [showAll, setShowAll] = useState(false);

  const { drivers, baseline } = useMemo(() => {
    const { job, rel, cost, chip } = state;
    const chipMfu = CHIPS[chip].mfu;
    const crashLow = Math.min(...FAILURE_PRESETS.map((p) => p.value));
    const crashHigh = Math.max(...FAILURE_PRESETS.map((p) => p.value));
    const recoveryLow = Math.min(...RECOVERY_PRESETS.map((p) => p.hours));
    const recoveryHigh = Math.max(...RECOVERY_PRESETS.map((p) => p.hours));
    const stallLow = CHECKPOINT.asyncStallSeconds.low / 3600;
    const stallHigh = CHECKPOINT.asyncStallSeconds.high / 3600;
    const priceLow = cost.pricePerGpuHour * 0.65;
    const priceHigh = cost.pricePerGpuHour * 1.2;

    const driverDefs: Driver[] = [
      { label: 'MFU', low: chipMfu.low, high: chipMfu.high, apply: (v, j, r, c) => ({ job: { ...j, mfu: v }, rel: r, cost: c }) },
      { label: 'Crash rate', low: crashLow, high: crashHigh, apply: (v, j, r, c) => ({ job: j, rel: { ...r, failuresPer1000NodeDays: v }, cost: c }) },
      { label: 'Recovery time', low: recoveryLow, high: recoveryHigh, apply: (v, j, r, c) => ({ job: j, rel: { ...r, recoveryHours: v }, cost: c }) },
      { label: 'Checkpoint pause', low: stallLow, high: stallHigh, apply: (v, j, r, c) => ({ job: j, rel: { ...r, checkpointStallHours: v }, cost: c }) },
      { label: 'GPU price', low: priceLow, high: priceHigh, apply: (v, j, r, c) => ({ job: j, rel: r, cost: { ...c, pricePerGpuHour: v } }) },
      { label: 'Setup hours', low: 0, high: 12, apply: (v, j, r, c) => ({ job: j, rel: { ...r, setupHours: v }, cost: c }) },
    ];

    const evaluated = driverDefs.map((d) => {
      const lowInputs = d.apply(d.low, job, rel, cost);
      const highInputs = d.apply(d.high, job, rel, cost);
      const lowTotal = computeCost(lowInputs.job, computeRun(lowInputs.job, lowInputs.rel), lowInputs.cost).totalCost;
      const highTotal = computeCost(highInputs.job, computeRun(highInputs.job, highInputs.rel), highInputs.cost).totalCost;
      const cheaper = Math.min(lowTotal, highTotal);
      const costlier = Math.max(lowTotal, highTotal);
      return { label: d.label, cheaper, costlier, swing: costlier - cheaper };
    });
    evaluated.sort((a, b) => b.swing - a.swing);
    return { drivers: evaluated, baseline: result.cost.totalCost };
  }, [state, result]);

  const biggest = drivers[0] ?? null;
  const visible = showAll ? drivers : drivers.slice(0, 4);
  const allValues = drivers.flatMap((d) => [d.cheaper, d.costlier, baseline]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const span = Math.max(maxVal - minVal, 1);
  const baselinePct = ((baseline - minVal) / span) * 100;

  const rowStyle = (d: EvaluatedDriver): React.CSSProperties => {
    const cheaperPct = ((d.cheaper - minVal) / span) * 100;
    const costlierPct = ((d.costlier - minVal) / span) * 100;
    const barLeft = Math.min(cheaperPct, costlierPct);
    const barWidth = Math.max(costlierPct - cheaperPct, 0.3);
    // blue is the portion of the bar left of the centre line; orange is the right.
    const splitWithin = Math.max(0, Math.min(barWidth, baselinePct - barLeft));
    return {
      // CSS vars consumed by the Bar component
      ['--bar-left' as string]: `${barLeft}%`,
      ['--bar-width' as string]: `${barWidth}%`,
      ['--blue-width' as string]: `${splitWithin}%`,
    } as React.CSSProperties;
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-1 flex items-center gap-2">
        <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">What matters most</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        How much the total cost could change if one assumption turns out better or worse. Each bar changes one assumption and keeps everything else as you set it.
      </p>

      {biggest && (
        <div className="mb-3">
          <p className="text-xs text-slate-700 dark:text-slate-200">
            Biggest swing: <span className="font-medium">{biggest.label}</span>. Across its range it changes the total by about {compactUSD(biggest.swing)}.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">This shows where the uncertainty is, not what will happen.</p>
        </div>
      )}

      {/* Chart area: the bar column is the 2nd grid column; the spanning centre line + caption sit over it. */}
      <div className="relative">
        {/* caption centred above the centre line, over the bar column only */}
        <div
          className="pointer-events-none absolute -top-4 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500"
          style={{ left: `calc(140px + (100% - 140px - 64px) * ${baselinePct / 100})` }}
        >
          Current total {compactUSD(baseline)}
        </div>

        <div className="space-y-1.5">
          {visible.map((d) => (
            <div
              key={d.label}
              title={`Cheaper: ${formatUSD(d.cheaper)} · Costlier: ${formatUSD(d.costlier)}`}
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: '140px minmax(0,1fr) 64px', height: '36px', ...rowStyle(d) }}
            >
              <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{d.label}</span>
              <Bar d={d} baselinePct={baselinePct} />
              <span className="text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">{compactUSD(d.swing)}</span>
            </div>
          ))}
        </div>

        {/* one thin centre line spanning all rows, over the bar column only, above the bars */}
        <div
          className="pointer-events-none absolute z-10"
          style={{
            top: '20px',
            bottom: '4px',
            left: `calc(140px + (100% - 140px - 64px) * ${baselinePct / 100})`,
            width: '1px',
            background: 'rgba(100,116,139,0.6)',
          }}
        />
      </div>

      {drivers.length > 4 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 text-xs font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          {showAll ? 'Show fewer' : `Show all ${drivers.length}`}
        </button>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#3b82f6' }} /> cheaper</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#f97316' }} /> costlier</span>
      </div>

      <div className="mt-4 space-y-3">
        <Collapsible label="How to read this">
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <li>The centre line is your current total cost.</li>
            <li>A bar to the left shows the saving if that assumption turns out better. A bar to the right shows the extra cost if it turns out worse.</li>
            <li>The longer the whole bar, the more that assumption matters. The number on the right is the full range from best case to worst case.</li>
          </ul>
        </Collapsible>

        <Collapsible label="Show the numbers">
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/40">
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 font-medium">Driver</th>
                  <th className="px-3 py-2 text-right font-medium">Cheaper case</th>
                  <th className="px-3 py-2 text-right font-medium">Costlier case</th>
                  <th className="px-3 py-2 text-right font-medium">Swing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {drivers.map((d) => (
                  <tr key={d.label} className="text-slate-700 dark:text-slate-200">
                    <td className="px-3 py-2">{d.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatUSD(d.cheaper)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatUSD(d.costlier)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatUSD(d.swing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
