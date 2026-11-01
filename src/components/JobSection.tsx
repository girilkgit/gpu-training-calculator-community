import { CHIPS, type ChipId } from '@/data/defaults';
import type { CalculatorState, UpdateFn, JobSizeMode } from '@/hooks/useCalculator';
import { idealHoursFromModel, checkpointSizeTB } from '@/lib/model';
import { formatNumber, formatDuration } from '@/lib/format';
import { Section, Field, NumberInput, Select, Slider, RadioGroup } from './ui';

export function JobSection({
  state,
  update,
  updateJob,
  setChip,
  setJobSizeMode,
}: {
  state: CalculatorState;
  update: UpdateFn;
  updateJob: (patch: Partial<CalculatorState['job']>) => void;
  setChip: (c: ChipId) => void;
  setJobSizeMode: (m: JobSizeMode) => void;
}) {
  const chip = CHIPS[state.chip];
  const modelIdeal =
    state.jobSizeMode === 'model'
      ? idealHoursFromModel(state.paramsBillions, state.tokensTrillions, state.job.gpus, chip.peakBf16DenseTflops)
      : state.job.idealHours;
  const ckptTB = checkpointSizeTB(state.paramsBillions);

  return (
    <Section title="Job" defaultOpen>
      <div className="space-y-4">
        <Field label="Number of GPUs">
          <NumberInput value={state.job.gpus} onChange={(v) => updateJob({ gpus: v })} min={1} step={1} />
        </Field>

        <Field label="Chip">
          <Select<ChipId>
            value={state.chip}
            onChange={setChip}
            options={(Object.keys(CHIPS) as ChipId[]).map((id) => ({ value: id, label: CHIPS[id].label }))}
          />
        </Field>

        <Field label="Job size">
          <RadioGroup<JobSizeMode>
            value={state.jobSizeMode}
            onChange={setJobSizeMode}
            options={[
              { value: 'ideal', label: 'Ideal hours at 100%' },
              { value: 'model', label: 'From model size' },
            ]}
          />
        </Field>

        {state.jobSizeMode === 'ideal' ? (
          <Field label="Ideal hours at 100% speed" hint="Hours the job would take at full theoretical peak.">
            <NumberInput value={state.job.idealHours} onChange={(v) => updateJob({ idealHours: v })} min={0} step={1} suffix="h" />
          </Field>
        ) : (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
            <Field label="Parameters (billions)">
              <NumberInput value={state.paramsBillions} onChange={(v) => update('paramsBillions', v)} min={0} step={1} suffix="B" />
            </Field>
            <Field label="Training tokens (trillions)">
              <NumberInput value={state.tokensTrillions} onChange={(v) => update('tokensTrillions', v)} min={0} step={1} suffix="T" />
            </Field>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <div>Peak BF16 dense: {formatNumber(chip.peakBf16DenseTflops, 0)} TFLOPS/GPU</div>
              <div>Ideal hours: {formatDuration(modelIdeal)} ({formatNumber(modelIdeal, 1)} h)</div>
              <div>Checkpoint size: {formatNumber(ckptTB, 2)} TB</div>
            </div>
          </div>
        )}

        <div>
          <Field
            label={`MFU — ${chip.label}`}
            hint={<span className="block max-w-xs">{chip.mfuNote}</span>}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Slider
                  value={state.job.mfu}
                  onChange={(v) => updateJob({ mfu: v })}
                  min={chip.mfu.low}
                  max={chip.mfu.high}
                  step={0.01}
                />
                <span className="w-12 text-right text-sm tabular-nums text-slate-700 dark:text-slate-200">
                  {(state.job.mfu * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{(chip.mfu.low * 100).toFixed(0)}%</span>
                <span className="text-slate-500">default {(chip.mfu.default * 100).toFixed(0)}%</span>
                <span>{(chip.mfu.high * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Field>
        </div>
      </div>
    </Section>
  );
}
