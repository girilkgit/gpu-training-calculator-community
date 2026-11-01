import { FAILURE_PRESETS, RECOVERY_PRESETS, CHECKPOINT } from '@/data/defaults';
import type { CalculatorState, UpdateFn } from '@/hooks/useCalculator';
import { mtbfHours } from '@/lib/model';
import { formatDuration } from '@/lib/format';
import { Section, Field, NumberInput, Select, Toggle, RadioGroup } from './ui';

export function ReliabilitySection({
  state,
  update,
  updateRel,
}: {
  state: CalculatorState;
  update: UpdateFn;
  updateRel: (patch: Partial<CalculatorState['rel']>) => void;
}) {
  const mtbf = mtbfHours(state.job.gpus, state.job.gpusPerNode, state.rel.failuresPer1000NodeDays);
  const autoInterval = state.rel.checkpointIntervalHours === 'auto';
  const failureIsCustom = !state.failurePresetId || state.failurePresetId === 'custom';
  const recoveryIsCustom = !state.recoveryPresetId || state.recoveryPresetId === 'custom';

  return (
    <Section title="Reliability" defaultOpen>
      <div className="space-y-4">
        <Field
          label="Failure rate"
          hint={
            failureIsCustom ? (
              <span className="block text-sky-700 dark:text-sky-400">Custom: type your own number in the box below.</span>
            ) : (
              <span className="block">{FAILURE_PRESETS.find((p) => p.id === state.failurePresetId)?.source}</span>
            )
          }
        >
          <Select<string>
            value={state.failurePresetId || 'custom'}
            onChange={(v) => {
              update('failurePresetId', v);
              const preset = FAILURE_PRESETS.find((p) => p.id === v);
              if (preset) updateRel({ failuresPer1000NodeDays: preset.value });
            }}
            options={[
              ...FAILURE_PRESETS.map((p) => ({ value: p.id, label: p.label })),
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </Field>

        <Field
          label="Crashes per 1,000 node-days"
          hint={
            <span className="block">
              One node is {state.job.gpusPerNode} GPUs. A higher number means a less reliable cluster. At{' '}
              {state.job.gpus.toLocaleString()} GPUs this is a crash every{' '}
              <strong className="text-slate-600 dark:text-slate-300">{formatDuration(mtbf)}</strong>.
            </span>
          }
        >
          <NumberInput
            value={state.rel.failuresPer1000NodeDays}
            onChange={(v) => {
              update('failurePresetId', 'custom');
              updateRel({ failuresPer1000NodeDays: v });
            }}
            min={0}
            step={0.01}
          />
        </Field>

        <Field
          label="Recovery per failure"
          hint={
            <span className="block">
              {recoveryIsCustom ? (
                <span className="text-sky-700 dark:text-sky-400">Custom: type your own time in the box below.</span>
              ) : (
                RECOVERY_PRESETS.find((p) => p.id === state.recoveryPresetId)?.source
              )}
            </span>
          }
        >
          <Select<string>
            value={state.recoveryPresetId || 'custom'}
            onChange={(v) => {
              update('recoveryPresetId', v);
              const preset = RECOVERY_PRESETS.find((p) => p.id === v);
              if (preset) updateRel({ recoveryHours: preset.hours });
            }}
            options={[
              ...RECOVERY_PRESETS.map((p) => ({ value: p.id, label: p.label })),
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </Field>

        <Field label="Recovery time (minutes)">
          <NumberInput
            value={state.rel.recoveryHours * 60}
            onChange={(v) => {
              update('recoveryPresetId', 'custom');
              updateRel({ recoveryHours: v / 60 });
            }}
            min={0}
            step={1}
            suffix="min"
          />
        </Field>

        <Field label="Checkpoint pause (seconds)" hint={`Default: ${CHECKPOINT.asyncStallSeconds.default} s (PyTorch async)`}>
          <NumberInput
            value={state.rel.checkpointStallHours * 3600}
            onChange={(v) => updateRel({ checkpointStallHours: v / 3600 })}
            min={0}
            step={1}
            suffix="s"
          />
        </Field>

        <div>
          <Field label="Checkpoint interval">
            <div className="space-y-2">
              <Toggle
                checked={autoInterval}
                onChange={(v) => updateRel({ checkpointIntervalHours: v ? 'auto' : 60 })}
                label="Auto (recommended — Young-Daly)"
              />
              {!autoInterval && (
                <NumberInput
                  value={(state.rel.checkpointIntervalHours as number) / 60}
                  onChange={(v) => updateRel({ checkpointIntervalHours: v * 60 })}
                  min={1}
                  step={1}
                  suffix="min"
                />
              )}
            </div>
          </Field>
        </div>

        <Field label="Setup hours" hint="One-off cluster setup / validation time.">
          <NumberInput value={state.rel.setupHours} onChange={(v) => updateRel({ setupHours: v })} min={0} step={0.5} suffix="h" />
        </Field>

        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400">
            Advanced
          </summary>
          <div className="mt-3">
            <Field label="Method">
              <RadioGroup<'daly' | 'paper'>
                value={state.rel.method}
                onChange={(v) => updateRel({ method: v })}
                options={[
                  { value: 'daly', label: 'Improved (recommended)' },
                  { value: 'paper', label: 'Whitepaper method' },
                ]}
              />
            </Field>
          </div>
        </details>
      </div>
    </Section>
  );
}