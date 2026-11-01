import type { CalculatorState, CalculatorResult } from '@/hooks/useCalculator';
import { formatDuration } from '@/lib/format';

function usd(v: number): string {
  if (!isFinite(v) || v < 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{children}</strong>;
}

/**
 * "Summary": a few sentences that rewrite themselves whenever an input changes.
 * Reads only from the calculator result, so it never disagrees with the numbers above.
 */
export default function KeyNumbers({ state, result }: { state: CalculatorState; result: CalculatorResult }) {
  const { run, cost } = result;
  const gpus = state.job.gpus;
  const nodes = Math.max(1, Math.round(gpus / Math.max(1, state.job.gpusPerNode)));

  const lostHours = Math.max(0, run.totalHours - run.trainHours);
  const lostShare = run.totalHours > 0 ? (lostHours / run.totalHours) * 100 : 0;

  // Largest source of lost time, shown only when the breakdown adds up to the total.
  const b = run.breakdown;
  const parts: { name: string; hours: number }[] = [
    { name: 'checkpoints', hours: b.checkpoints },
    { name: 'recovering from crashes', hours: b.recovery },
    { name: 'redoing lost work', hours: b.rework },
    { name: 'setup', hours: b.setup },
  ];
  const sum = b.useful + parts.reduce((s, p) => s + p.hours, 0);
  const adds = run.totalHours > 0 && Math.abs(sum - run.totalHours) / run.totalHours < 0.02;
  const biggest = adds ? [...parts].sort((x, y) => y.hours - x.hours)[0] : null;

  const failures = run.expectedFailures;
  const reserved = state.cost.billing === 'reserved';
  // Reserved: you pay for every reserved hour, so the waste is the bill minus the cost of pure training.
  const wastedSpend = reserved
    ? Math.max(0, cost.gpuCost - gpus * run.trainHours * cost.effectivePricePerGpuHour)
    : cost.wastedGpuCost;
  const wastedShare = cost.gpuCost > 0 ? (wastedSpend / cost.gpuCost) * 100 : 0;

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50"
    >
      <h2 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Summary</h2>
      <ul className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <li>
          <B>{gpus.toLocaleString()} GPUs</B> ({nodes.toLocaleString()} nodes) need about <B>{formatDuration(run.totalHours)}</B> to
          finish. Pure training would take <B>{formatDuration(run.trainHours)}</B>.
        </li>
        <li>
          Expect around <B>{failures < 10 ? failures.toFixed(1) : Math.round(failures).toLocaleString()} crashes</B> during training, one every{' '}
          <B>{formatDuration(run.mtbfHours)}</B>.
          {lostHours > 0.01 && (
            <>
              {' '}
              Crashes, checkpoints and setup together add <B>{lostShare.toFixed(1)}%</B> to the run
              {biggest && biggest.hours > 0 ? `; the biggest part is ${biggest.name}` : ''}.
            </>
          )}
        </li>
        <li>
          The estimated total is <B>{usd(cost.totalCost)}</B>
          {wastedSpend > 0 && (
            <>
              . About <B>{usd(wastedSpend)}</B> ({wastedShare.toFixed(1)}% of GPU spend) pays for GPUs that are not training
            </>
          )}
          .
        </li>
        <li>
          You pay <B>${cost.effectivePricePerGpuHour.toFixed(2)}</B> per GPU-hour, but each <em>useful</em> GPU-hour costs{' '}
          <B>${cost.effectivePricePerUsefulGpuHour.toFixed(2)}</B>.
          {reserved && cost.unusedReservedHours > 0 && (
            <> You have reserved {formatDuration(cost.unusedReservedHours)} more than the run needs.</>
          )}
        </li>
      </ul>
    </section>
  );
}