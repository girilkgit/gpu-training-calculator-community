import { useMemo, useState, useCallback } from 'react';
import {
  computeRun,
  computeCost,
  mtbfHours,
  idealHoursFromModel,
  checkpointSizeTB,
  type JobInputs,
  type ReliabilityInputs,
  type CostInputs,
} from '@/lib/model';
import {
  SCENARIOS,
  CHIPS,
  type ChipId,
  NEBIUS_PRICING,
  FAILURE_PRESETS,
  RECOVERY_PRESETS,
} from '@/data/defaults';

// Which dropdown option matches a number, so a loaded scenario shows its preset and source note.
// Anything that matches no preset shows as "Custom".
const matchFailurePreset = (v: number) =>
  FAILURE_PRESETS.find((p) => Math.abs(p.value - v) < 1e-9)?.id ?? 'custom';
const matchRecoveryPreset = (hours: number) =>
  RECOVERY_PRESETS.find((p) => Math.abs(p.hours - hours) < 1e-9)?.id ?? 'custom';

export type JobSizeMode = 'ideal' | 'model';

export interface CalculatorState {
  scenarioKey: keyof typeof SCENARIOS | null;
  scenarioLabel: string;
  job: JobInputs;
  rel: ReliabilityInputs;
  cost: CostInputs;
  chip: ChipId;
  jobSizeMode: JobSizeMode;
  paramsBillions: number;
  tokensTrillions: number;
  failurePresetId: string;
  recoveryPresetId: string;
}

const initialScenario = SCENARIOS.evidenceBasedH200;

function deriveInitialState(): CalculatorState {
  return {
    scenarioKey: 'evidenceBasedH200',
    scenarioLabel: initialScenario.label,
    job: { ...initialScenario.job },
    rel: { ...initialScenario.rel },
    cost: { ...initialScenario.cost },
    chip: 'H200',
    jobSizeMode: 'ideal',
    paramsBillions: 70,
    tokensTrillions: 15,
    failurePresetId: matchFailurePreset(initialScenario.rel.failuresPer1000NodeDays),
    recoveryPresetId: matchRecoveryPreset(initialScenario.rel.recoveryHours),
  };
}

export interface CalculatorResult {
  run: ReturnType<typeof computeRun>;
  cost: ReturnType<typeof computeCost>;
  mtbf: number;
  derivedIdealHours: number;
  checkpointSizeTB: number;
}

export type UpdateFn = <K extends keyof CalculatorState>(field: K, value: CalculatorState[K]) => void;

export function useCalculator() {
  const [state, setState] = useState<CalculatorState>(deriveInitialState);

  const loadScenario = useCallback((key: keyof typeof SCENARIOS) => {
    const s = SCENARIOS[key];
    setState({
      scenarioKey: key,
      scenarioLabel: s.label,
      job: { ...s.job },
      rel: { ...s.rel },
      cost: { ...s.cost },
      chip: 'H200',
      jobSizeMode: 'ideal',
      paramsBillions: 70,
      tokensTrillions: 15,
      failurePresetId: matchFailurePreset(s.rel.failuresPer1000NodeDays),
      recoveryPresetId: matchRecoveryPreset(s.rel.recoveryHours),
    });
  }, []);

  const markCustom = useCallback((prev: CalculatorState): CalculatorState => ({
    ...prev,
    scenarioKey: null,
    scenarioLabel: 'Custom',
  }), []);

  const update = useCallback(<K extends keyof CalculatorState>(field: K, value: CalculatorState[K]) => {
    setState((prev) => markCustom({ ...prev, [field]: value }));
  }, [markCustom]);

  const updateJob = useCallback((patch: Partial<JobInputs>) => {
    setState((prev) => markCustom({ ...prev, job: { ...prev.job, ...patch } }));
  }, [markCustom]);

  const updateRel = useCallback((patch: Partial<ReliabilityInputs>) => {
    setState((prev) => markCustom({ ...prev, rel: { ...prev.rel, ...patch } }));
  }, [markCustom]);

  const updateCost = useCallback((patch: Partial<CostInputs>) => {
    setState((prev) => markCustom({ ...prev, cost: { ...prev.cost, ...patch } }));
  }, [markCustom]);

  const setChip = useCallback((chip: ChipId) => {
    setState((prev) => markCustom({
      ...prev,
      chip,
      cost: { ...prev.cost, pricePerGpuHour: NEBIUS_PRICING.onDemandUsdPerGpuHour[chip] },
      job: { ...prev.job, mfu: CHIPS[chip].mfu.default },
    }));
  }, [markCustom]);

  const setJobSizeMode = useCallback((mode: JobSizeMode) => {
    setState((prev) => markCustom({ ...prev, jobSizeMode: mode }));
  }, [markCustom]);

  const result: CalculatorResult = useMemo(() => {
    const chip = CHIPS[state.chip];
    const derivedIdealHours =
      state.jobSizeMode === 'model'
        ? idealHoursFromModel(state.paramsBillions, state.tokensTrillions, state.job.gpus, chip.peakBf16DenseTflops)
        : state.job.idealHours;

    const effectiveJob: JobInputs = {
      ...state.job,
      idealHours: state.jobSizeMode === 'model' ? derivedIdealHours : state.job.idealHours,
    };

    const run = computeRun(effectiveJob, state.rel);
    const cost = computeCost(effectiveJob, run, state.cost);
    const mtbf = mtbfHours(state.job.gpus, state.job.gpusPerNode, state.rel.failuresPer1000NodeDays);
    const ckpt = checkpointSizeTB(state.paramsBillions);

    return { run, cost, mtbf, derivedIdealHours, checkpointSizeTB: ckpt };
  }, [state]);

  return { state, result, loadScenario, update, updateJob, updateRel, updateCost, setChip, setJobSizeMode };
}