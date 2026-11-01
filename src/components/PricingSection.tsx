import { PROVIDER_PRESETS } from '@/data/defaults';
import type { CalculatorState } from '@/hooks/useCalculator';
import { Section, Field, NumberInput, Slider, RadioGroup } from './ui';

export function PricingSection({
  state,
  updateCost,
}: {
  state: CalculatorState;
  updateCost: (patch: Partial<CalculatorState['cost']>) => void;
}) {
  return (
    <Section title="Pricing" defaultOpen>
      <div className="space-y-4">
        <Field label="Price per GPU-hour (USD)">
          <NumberInput
            value={state.cost.pricePerGpuHour}
            onChange={(v) => updateCost({ pricePerGpuHour: v })}
            min={0}
            step={0.1}
            prefix="$"
            suffix="/h"
          />
        </Field>

        <Field
          label={`Commitment discount — ${(state.cost.discountPct).toFixed(0)}%`}
          hint={<span className="block max-w-xs">{PROVIDER_PRESETS.note}</span>}
        >
          <div className="flex items-center gap-2">
            <Slider
              value={state.cost.discountPct}
              onChange={(v) => updateCost({ discountPct: v })}
              min={0}
              max={PROVIDER_PRESETS.maxCommitDiscountPct}
              step={1}
            />
            <span className="w-10 text-right text-sm tabular-nums text-slate-700 dark:text-slate-200">
              {state.cost.discountPct.toFixed(0)}%
            </span>
          </div>
        </Field>

        <Field label="Billing">
          <RadioGroup<'used' | 'reserved'>
            value={state.cost.billing}
            onChange={(v) => updateCost({ billing: v })}
            options={[
              { value: 'used', label: 'Pay for hours used' },
              { value: 'reserved', label: 'Reserved block' },
            ]}
          />
        </Field>

        {state.cost.billing === 'reserved' && (
          <Field label="Reserved block hours">
            <NumberInput
              value={state.cost.reservedHours}
              onChange={(v) => updateCost({ reservedHours: v })}
              min={0}
              step={1}
              suffix="h"
            />
          </Field>
        )}
      </div>
    </Section>
  );
}