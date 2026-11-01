import { PROVIDER_PRESETS } from '@/data/defaults';
import type { CalculatorState } from '@/hooks/useCalculator';
import { Section, Field, NumberInput, Select } from './ui';

const STORAGE_TYPES: { value: string; label: string }[] = [
  { value: 'sharedFilesystem', label: 'Shared filesystem' },
  { value: 'weka', label: 'Weka' },
  { value: 'objectStandard', label: 'Object storage (standard)' },
];

export function ExtrasSection({
  state,
  updateCost,
}: {
  state: CalculatorState;
  updateCost: (patch: Partial<CalculatorState['cost']>) => void;
}) {
  const storageKey = (() => {
    const price = state.cost.storagePricePerGiBMonth;
    const entries = Object.entries(PROVIDER_PRESETS.storageUsdPerGiBMonth) as [string, number][];
    const match = entries.find(([, p]) => Math.abs(p - price) < 1e-6);
    return match?.[0] ?? 'custom';
  })();

  return (
    <Section title="Optional extras" defaultOpen>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Costs beyond GPU time. Each one adds nothing until you enter a value.
        </p>

        <Field label="Storage (TB)" hint="Space for training data and checkpoints.">
          <NumberInput value={state.cost.storageTB} onChange={(v) => updateCost({ storageTB: v })} min={0} step={1} suffix="TB" />
        </Field>

        <Field label="Storage type" hint="Picks a listed price. To use your own price, type it in the box below.">
          <Select<string>
            value={storageKey}
            onChange={(v) => {
              if (v === 'custom') return;
              const prices = PROVIDER_PRESETS.storageUsdPerGiBMonth as Record<string, number>;
              updateCost({ storagePricePerGiBMonth: prices[v] });
            }}
            options={[...STORAGE_TYPES, { value: 'custom', label: 'Custom' }]}
          />
        </Field>

        <Field label="Storage price ($/GiB-month)" hint="Dollars per GiB per month. Changes when you pick a storage type.">
          <NumberInput
            value={state.cost.storagePricePerGiBMonth}
            onChange={(v) => updateCost({ storagePricePerGiBMonth: v })}
            min={0}
            step={0.001}
          />
        </Field>

        <Field label="Storage months" hint="How long you keep the data. Cost = TB × 931.32 GiB per TB × price × months.">
          <NumberInput value={state.cost.storageMonths} onChange={(v) => updateCost({ storageMonths: v })} min={0} step={1} suffix="mo" />
        </Field>

        <Field label="Egress (GiB)" hint="Data copied out of the cloud. It costs nothing unless the price below is above $0.">
          <NumberInput value={state.cost.egressGiB} onChange={(v) => updateCost({ egressGiB: v })} min={0} step={1} suffix="GiB" />
        </Field>

        <Field label="Egress price ($/GiB)" hint="$0 by default because network egress is listed as free. Enter a price if your provider charges.">
          <NumberInput
            value={state.cost.egressPricePerGiB}
            onChange={(v) => updateCost({ egressPricePerGiB: v })}
            min={0}
            step={0.001}
          />
        </Field>

        <Field label="People hours" hint="Staff time to set up and watch the run. Zero by default, so nothing is added until you enter hours.">
          <NumberInput value={state.cost.peopleHours} onChange={(v) => updateCost({ peopleHours: v })} min={0} step={1} suffix="h" />
        </Field>

        <Field label="People rate ($/hour)" hint="Hourly cost of that staff time. It only matters once People hours is above 0.">
          <NumberInput value={state.cost.peopleRatePerHour} onChange={(v) => updateCost({ peopleRatePerHour: v })} min={0} step={5} suffix="/h" />
        </Field>

        <Field label="Contingency (% of GPU cost)" hint="An allowance for reruns and surprises, as a percentage of the GPU cost only. Zero by default.">
          <NumberInput value={state.cost.contingencyPct} onChange={(v) => updateCost({ contingencyPct: v })} min={0} step={1} suffix="%" />
        </Field>
      </div>
    </Section>
  );
}