import { describe, it, expect } from 'vitest';
import {
  computeRun, computeCost, mtbfHours, failuresPer1000NodeDaysFromMtbf, youngDalyIntervalHours,
  dalyWallHours, idealHoursFromModel, checkpointSizeTB, GIB_PER_TB,
  type JobInputs, type ReliabilityInputs, type CostInputs,
} from './model';
import { simulateWallHours } from './montecarlo';

const noExtras = { storageTB: 0, storagePricePerGiBMonth: 0, storageMonths: 0, egressGiB: 0, egressPricePerGiB: 0, peopleHours: 0, peopleRatePerHour: 0, contingencyPct: 0 };

const cloudXJob: JobInputs = { gpus: 3000, gpusPerNode: 8, idealHours: 72, mfu: 0.5 };
const cloudXRel: ReliabilityInputs = {
  failuresPer1000NodeDays: failuresPer1000NodeDaysFromMtbf(9.8, 3000, 8),
  recoveryHours: 1, checkpointStallHours: 5 / 60, checkpointIntervalHours: 3, setupHours: 5, method: 'paper',
};
const nebiusJob: JobInputs = { gpus: 3000, gpusPerNode: 8, idealHours: 72, mfu: 0.5 / 0.97 };
const nebiusRel: ReliabilityInputs = {
  failuresPer1000NodeDays: failuresPer1000NodeDaysFromMtbf(33, 3000, 8),
  recoveryHours: 12 / 60, checkpointStallHours: 3 / 60, checkpointIntervalHours: 3, setupHours: 3, method: 'paper',
};

describe('replicates a published first-order worked example (method = paper)', () => {
  it('Cloud X: 144 + 14.7 + 4 + 22.1 + 5 = ~189.8 h', () => {
    const r = computeRun(cloudXJob, cloudXRel);
    expect(r.trainHours).toBeCloseTo(144, 5);
    expect(r.expectedFailures).toBeCloseTo(14.69, 1);
    expect(r.breakdown.checkpoints).toBeCloseTo(4, 2);
    expect(r.breakdown.recovery).toBeCloseTo(14.69, 1);
    expect(r.breakdown.rework).toBeCloseTo(22.04, 1);
    expect(Math.abs(r.totalHours - 189.8)).toBeLessThan(0.15);
  });
  it('Nebius: ~139.7 + 0.8 + 2.3 + 6.3 + 3 = ~152.1 h', () => {
    const r = computeRun(nebiusJob, nebiusRel);
    expect(r.trainHours).toBeCloseTo(139.7, 1);
    expect(Math.abs(r.totalHours - 152.1)).toBeLessThan(0.3);
  });
  it('reserved-block costs match the paper tables', () => {
    const cx = computeCost(cloudXJob, computeRun(cloudXJob, cloudXRel), { ...noExtras, pricePerGpuHour: 2.8, discountPct: 0, billing: 'reserved', reservedHours: 192 } as CostInputs);
    const nb = computeCost(nebiusJob, computeRun(nebiusJob, nebiusRel), { ...noExtras, pricePerGpuHour: 3.5, discountPct: 0, billing: 'reserved', reservedHours: 192 } as CostInputs);
    expect(cx.gpuCost).toBeCloseTo(1_612_800, 0);
    expect(nb.gpuCost).toBeCloseTo(2_016_000, 0);
    expect(cx.unusedReservedHours).toBeCloseTo(2.2, 0);
  });
  it('pay-for-hours-used cost is close to the paper "training job cost"', () => {
    const nb = computeCost(nebiusJob, computeRun(nebiusJob, nebiusRel), { ...noExtras, pricePerGpuHour: 3.5, discountPct: 0, billing: 'used', reservedHours: 0 } as CostInputs);
    expect(Math.abs(nb.gpuCost - 1_597_050) / 1_597_050).toBeLessThan(0.002);
  });
});

describe('building blocks', () => {
  it('MTBF scales with cluster size', () => {
    expect(mtbfHours(3000, 8, 6.5)).toBeCloseTo(9.85, 1);
    expect(mtbfHours(6000, 8, 6.5)).toBeCloseTo(mtbfHours(3000, 8, 6.5) / 2, 6);
  });
  it('Young-Daly interval', () => {
    expect(youngDalyIntervalHours(5 / 60, 9.8)).toBeCloseTo(1.28, 2);
  });
  it('storage: 52.5 TB for one month at $0.08/GiB-month is about $3.9k', () => {
    expect(52.5 * GIB_PER_TB * 0.08).toBeCloseTo(3911, -1);
  });
  it('checkpoint size: 405B params x 12 bytes = 4.86 TB (Epoch AI example)', () => {
    expect(checkpointSizeTB(405)).toBeCloseTo(4.86, 2);
  });
  it('6ND rule: 70B params x 15T tokens on 3000 H100/H200 (989 TFLOPS) = ~590 h at 100%', () => {
    expect(idealHoursFromModel(70, 15, 3000, 989)).toBeCloseTo(590, -1);
  });
});

describe('Daly formula (method = daly)', () => {
  it('Cloud X inputs: ~192.6 h before setup (the paper method says 184.7)', () => {
    expect(dalyWallHours(144, 3, 5 / 60, 1, 9.8)).toBeCloseTo(192.6, 0);
  });
  it('agrees with a Monte Carlo simulation within 2%', () => {
    const sim = simulateWallHours({ trainHours: 144, intervalHours: 3, stallHours: 5 / 60, recoveryHours: 1, mtbfHours: 9.8, trials: 3000, seed: 42 });
    const formula = dalyWallHours(144, 3, 5 / 60, 1, 9.8);
    expect(Math.abs(sim.mean - formula) / formula).toBeLessThan(0.02);
    expect(sim.p10).toBeLessThan(sim.p50);
    expect(sim.p50).toBeLessThan(sim.p90);
  });
  it('with no failures it is just training + checkpoint pauses', () => {
    expect(dalyWallHours(100, 2, 0.1, 0.5, Infinity)).toBeCloseTo(105, 6);
  });
  it('breakdown always adds up to the total', () => {
    const r = computeRun(cloudXJob, { ...cloudXRel, method: 'daly', checkpointIntervalHours: 'auto' });
    const b = r.breakdown;
    expect(b.useful + b.checkpoints + b.recovery + b.rework + b.setup).toBeCloseTo(r.totalHours, 6);
  });
});

import { SCENARIOS } from '../data/defaults';
describe('built-in scenario', () => {
  const s = SCENARIOS.evidenceBasedH200;
  const run = computeRun(s.job, s.rel);
  const cost = computeCost(s.job, run, s.cost);

  it('uses Daly, Auto checkpoints and no extras', () => {
    expect(s.rel.method).toBe('daly');
    expect(s.rel.checkpointIntervalHours).toBe('auto');
    expect(s.cost.billing).toBe('used');
    expect(s.cost.storageTB).toBe(0);
    expect(s.cost.peopleHours).toBe(0);
    expect(s.cost.egressGiB).toBe(0);
  });

  it('known result (3,000 GPUs, 72 ideal hours at 40%, $5.40 per GPU-hour, no extras)', () => {
    expect(run.trainHours).toBeCloseTo(180, 5);
    expect(run.totalHours).toBeGreaterThan(190.5);
    expect(run.totalHours).toBeLessThan(192.5);
    expect(cost.totalCost).toBeGreaterThan(3.09e6);
    expect(cost.totalCost).toBeLessThan(3.11e6);
  });

  it('breakdown adds up to the total', () => {
    const b = run.breakdown;
    expect(b.useful + b.checkpoints + b.recovery + b.rework + b.setup).toBeCloseTo(run.totalHours, 6);
  });
});
