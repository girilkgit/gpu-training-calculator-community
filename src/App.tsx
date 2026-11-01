import { useCalculator } from '@/hooks/useCalculator';
import { ScenarioPicker } from '@/components/ScenarioPicker';
import { JobSection } from '@/components/JobSection';
import { ReliabilitySection } from '@/components/ReliabilitySection';
import { PricingSection } from '@/components/PricingSection';
import { ExtrasSection } from '@/components/ExtrasSection';
import { HeadlineCards, TimeBar, CostTable } from '@/components/Results';
import { SensitivityChart } from '@/components/SensitivityChart';
import { AssumptionsPanel } from '@/components/AssumptionsPanel';
import RangeCard from '@/components/results/RangeCard';
import { DATA_AS_OF } from '@/data/defaults';
import HeroBanner from '@/components/HeroBanner';
import KeyNumbers from '@/components/KeyNumbers';
import HelpBox from '@/components/HelpBox';

function App() {
  const { state, result, loadScenario, update, updateJob, updateRel, updateCost, setChip, setJobSizeMode } =
    useCalculator();

  return (
    <div className="min-h-screen bg-slate-200 p-2 text-slate-900 sm:p-5 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-6xl rounded-2xl border-2 border-sky-400/70 bg-slate-100 px-4 py-6 shadow-sm sm:px-6 dark:border-sky-700 dark:bg-slate-900">
        {/* Compact header with the orb */}
        <div className="mb-4">
          <HeroBanner />
        </div>

        {/* Help: written answers that quote the current numbers */}
        <div className="mb-4">
          <HelpBox state={state} result={result} />
        </div>

        {/* Live plain-English summary: rewrites itself when any input changes */}
        <div className="mb-6">
          <KeyNumbers state={state} result={result} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Left: inputs */}
          <div className="space-y-3">
            <ScenarioPicker state={state} onPick={loadScenario} />
            <JobSection
              state={state}
              update={update}
              updateJob={updateJob}
              setChip={setChip}
              setJobSizeMode={setJobSizeMode}
            />
            <ReliabilitySection state={state} update={update} updateRel={updateRel} />
            <PricingSection state={state} updateCost={updateCost} />
            <ExtrasSection state={state} updateCost={updateCost} />
          </div>

          {/* Right: results */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing: {state.scenarioLabel}
            </p>
            <HeadlineCards run={result.run} cost={result.cost} />
            <RangeCard state={state} result={result} />
            <TimeBar run={result.run} />
            <CostTable cost={result.cost} />
            <SensitivityChart state={state} result={result} />
            <AssumptionsPanel state={state} run={result.run} cost={result.cost} />
            <p className="px-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              Estimate, not a quote. Not financial or procurement advice. Defaults as of {DATA_AS_OF}. Prices from{' '}
              <span className="font-medium">nebius.com/prices</span> and may change.
            </p>
          </div>
        </div>

        {/* Contact: visible on every screen size */}
        <section
          aria-label="Contact"
          className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center"
        >
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Questions, feedback or your own cluster to size?</span>
          </p>
          <a
            href="mailto:info@naadimage.com?subject=GPU%20Training%20Calculator"
            className="inline-flex shrink-0 items-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-600 dark:bg-slate-900/60 dark:text-sky-200 dark:hover:border-sky-600 dark:hover:bg-slate-700"
          >
            info@naadimage.com
          </a>
        </section>
      </main>
    </div>
  );
}

export default App;