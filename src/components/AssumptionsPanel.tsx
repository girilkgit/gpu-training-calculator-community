import type { CalculatorState } from '@/hooks/useCalculator';
import type { RunResult, CostResult } from '@/lib/model';
import {
  CHIPS,
  FAILURE_PRESETS,
  RECOVERY_PRESETS,
  CHECKPOINT,
  SETUP,
  PEOPLE,
  PROVIDER_PRESETS,
  DATA_AS_OF,
  type Confidence,
} from '@/data/defaults';
import { Badge } from './ui';
import { formatNumber, formatUSD, formatDuration } from '@/lib/format';
import { mtbfHours } from '@/lib/model';

interface Row {
  label: string;
  value: string;
  confidence: Confidence;
  source: string;
}

export function AssumptionsPanel({
  state,
  run,
  cost,
}: {
  state: CalculatorState;
  run: RunResult;
  cost: CostResult;
}) {
  const chip = CHIPS[state.chip];
  const failurePreset = FAILURE_PRESETS.find((p) => p.id === state.failurePresetId);
  const recoveryPreset = RECOVERY_PRESETS.find((p) => p.id === state.recoveryPresetId);
  const mtbf = mtbfHours(state.job.gpus, state.job.gpusPerNode, state.rel.failuresPer1000NodeDays);

  const rows: Row[] = [
    {
      label: `${chip.label} peak BF16 dense`,
      value: `${formatNumber(chip.peakBf16DenseTflops, 0)} TFLOPS/GPU`,
      confidence: 'vendor',
      source: 'NVIDIA product pages (dense = sparsity figure halved).',
    },
    {
      label: `${chip.label} MFU default`,
      value: `${(chip.mfu.default * 100).toFixed(0)}%`,
      confidence: 'measured',
      source: chip.mfuNote,
    },
    {
      label: 'Provider on-demand price',
      value: `${formatUSD(PROVIDER_PRESETS.onDemandUsdPerGpuHour[state.chip])}/GPU-h`,
      confidence: 'vendor',
      source: `${PROVIDER_PRESETS.source} (verified ${PROVIDER_PRESETS.asOf}).`,
    },
    {
      label: 'Max commitment discount',
      value: `${PROVIDER_PRESETS.maxCommitDiscountPct}%`,
      confidence: 'vendor',
      source: PROVIDER_PRESETS.note,
    },
    {
      label: 'Failure rate',
      value: failurePreset
        ? `${formatNumber(state.rel.failuresPer1000NodeDays, 2)} / 1k node-days`
        : `${formatNumber(state.rel.failuresPer1000NodeDays, 4)} / 1k node-days (custom)`,
      confidence: failurePreset?.confidence ?? 'assumption',
      source: failurePreset?.source ?? 'User-entered value.',
    },
    {
      label: 'MTBF at this cluster size',
      value: formatDuration(mtbf),
      confidence: failurePreset?.confidence ?? 'assumption',
      source: 'Derived: (24 × 1000) / (failures × nodes).',
    },
    {
      label: 'Recovery per failure',
      value: recoveryPreset
        ? recoveryPreset.label
        : `${formatNumber(state.rel.recoveryHours * 60, 0)} min (custom)`,
      confidence: recoveryPreset?.confidence ?? 'assumption',
      source: recoveryPreset?.source ?? 'User-entered value.',
    },
    {
      label: 'Checkpoint pause',
      value: `${formatNumber(state.rel.checkpointStallHours * 3600, 0)} s`,
      confidence: 'measured',
      source: 'PyTorch async: ~6 s (7B); Lablup 18-32 s; PyTorch "often under 30 s".',
    },
    {
      label: 'Checkpoint interval',
      value: state.rel.checkpointIntervalHours === 'auto' ? 'Auto (Young-Daly)' : `${formatNumber((state.rel.checkpointIntervalHours as number) / 60, 0)} min`,
      confidence: 'assumption',
      source: `Young-Daly = sqrt(2 × stall × MTBF). ${CHECKPOINT.typicalIntervalHours}.`,
    },
    {
      label: 'Setup hours',
      value: `${formatNumber(state.rel.setupHours, 1)} h`,
      confidence: SETUP.confidence,
      source: SETUP.note,
    },
    {
      label: 'Run-time model',
      value: 'Daly (2006)',
      confidence: 'measured',
      source: 'Daly 2006: failures can strike during training, checkpoints, rework and recovery.',
    },
    {
      label: 'Checkpoint bytes/param',
      value: `${CHECKPOINT.bytesPerParam} B`,
      confidence: 'measured',
      source: 'fp32 weights + 2 Adam states (Epoch AI: 405B → 4,860 GB).',
    },
    {
      label: 'People rate',
      value: `${formatUSD(PEOPLE.defaultRatePerHour)}/h`,
      confidence: 'assumption',
      source: PEOPLE.note,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Assumptions used</h3>
        <span className="text-[11px] text-slate-400">as of {DATA_AS_OF}</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-700/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{r.value}</span>
                <Badge kind={r.confidence}>{r.confidence}</Badge>
              </div>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">{r.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
}