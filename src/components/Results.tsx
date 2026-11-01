import type { RunResult, CostResult } from '@/lib/model';
import { formatDuration, formatUSD, formatPercent, formatNumber } from '@/lib/format';
import { Clock, DollarSign, Gauge, TrendingUp } from 'lucide-react';

export function HeadlineCards({ run, cost }: { run: RunResult; cost: CostResult }) {
  const cards = [
    {
      label: 'Total time',
      value: formatDuration(run.totalHours),
      sub: `${formatNumber(run.totalHours, 1)} h`,
      Icon: Clock,
      tint: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-900/20',
    },
    {
      label: 'Total cost',
      value: formatUSD(cost.totalCost),
      sub: `${formatUSD(cost.gpuCost)} GPU`,
      Icon: DollarSign,
      tint: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Useful-time share',
      value: formatPercent(run.usefulShare),
      sub: `${formatDuration(run.trainHours)} training`,
      Icon: Gauge,
      tint: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-900/20',
    },
    {
      label: 'Effective $ / useful GPU-h',
      value: formatUSD(cost.effectivePricePerUsefulGpuHour),
      sub: `list ${formatUSD(cost.effectivePricePerGpuHour)}`,
      Icon: TrendingUp,
      tint: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</span>
            <c.Icon className={`h-4 w-4 ${c.tint}`} />
          </div>
          <div className={`text-xl font-semibold ${c.tint}`}>{c.value}</div>
          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

const SEGMENTS: { key: keyof RunResult['breakdown']; label: string; color: string }[] = [
  { key: 'useful', label: 'Useful training', color: 'bg-sky-500' },
  { key: 'checkpoints', label: 'Checkpoint pauses', color: 'bg-violet-400' },
  { key: 'recovery', label: 'Recovery', color: 'bg-amber-400' },
  { key: 'rework', label: 'Lost work', color: 'bg-rose-400' },
  { key: 'setup', label: 'Setup', color: 'bg-slate-400' },
];

export function TimeBar({ run }: { run: RunResult }) {
  const total = run.totalHours;
  const rows = SEGMENTS.filter((s) => run.breakdown[s.key] > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Time breakdown</h3>

      <div className="flex h-7 w-full overflow-hidden rounded-md">
        {rows.map((s, i) => {
          const v = run.breakdown[s.key];
          const pct = (v / total) * 100;
          return (
            <div
              key={s.key}
              className={`${s.color} ${i > 0 ? 'border-l border-white/30 dark:border-slate-900/40' : ''}`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${formatDuration(v)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        {rows.map((s) => {
          const v = run.breakdown[s.key];
          const pct = (v / total) * 100;
          return (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                {s.label}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                {formatDuration(v)} · {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CostTable({ cost }: { cost: CostResult }) {
  const rows: { label: string; value: number; muted?: boolean; strong?: boolean }[] = [
    { label: 'GPU', value: cost.gpuCost },
    { label: 'Storage', value: cost.storageCost },
    { label: 'Egress', value: cost.egressCost },
    { label: 'People', value: cost.peopleCost },
    { label: 'Contingency', value: cost.contingencyCost },
    { label: 'Total', value: cost.totalCost, strong: true },
    { label: 'GPU money not spent on training', value: cost.wastedGpuCost, muted: true },
  ];

  const extrasZero = cost.storageCost + cost.egressCost + cost.peopleCost === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cost breakdown</h3>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex items-center justify-between px-4 py-2.5 ${
              r.strong ? 'bg-slate-50 dark:bg-slate-900/30' : ''
            }`}
          >
            <span
              className={`text-sm ${r.muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'} ${
                r.strong ? 'font-semibold' : ''
              }`}
            >
              {r.label}
            </span>
            <span
              className={`tabular-nums ${r.muted ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'} ${
                r.strong ? 'font-semibold' : ''
              }`}
            >
              {formatUSD(r.value)}
            </span>
          </div>
        ))}
      </div>
      {extrasZero && (
        <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-400 dark:border-slate-700 dark:text-slate-500">
          Excludes storage, egress and people costs unless you add them in Optional extras.
        </p>
      )}
    </div>
  );
}