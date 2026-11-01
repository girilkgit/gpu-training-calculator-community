import { SCENARIOS } from '@/data/defaults';
import type { CalculatorState } from '@/hooks/useCalculator';

const scenarioKeys = Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[];

export function ScenarioPicker({
  state,
  onPick,
}: {
  state: CalculatorState;
  onPick: (key: keyof typeof SCENARIOS) => void;
}) {
  const isCustom = state.scenarioKey === null;
  const description = !isCustom && state.scenarioKey ? SCENARIOS[state.scenarioKey].description : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Start from an example</h2>
      <div className="grid grid-cols-1 gap-2">
        {scenarioKeys.map((key) => {
          const active = state.scenarioKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                active
                  ? 'border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-900/20 dark:text-sky-200'
                  : 'border-slate-200 text-slate-700 hover:border-sky-400 hover:bg-sky-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:bg-sky-900/20'
              }`}
            >
              {SCENARIOS[key].label}
            </button>
          );
        })}
      </div>

      {isCustom ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Custom</span>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Your inputs have been edited from a preset scenario.</p>
        </div>
      ) : description ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
    </div>
  );
}

export type { CalculatorState };
