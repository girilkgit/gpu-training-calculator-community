// src/lib/model.ts
// Pure calculation engine: no React, no network, no side effects.
// All durations are in HOURS unless the name says otherwise.

export const GIB_PER_TB = 1e12 / 2 ** 30; // 1 TB (10^12 bytes) = 931.32 GiB

export type Method = 'paper' | 'daly';
export type IntervalSetting = number | 'auto';

export interface JobInputs {
  gpus: number;
  gpusPerNode: number; // 8 for HGX H100/H200/B200
  idealHours: number; // hours the job would take at 100% of theoretical peak
  mfu: number; // real utilisation, 0..1 (e.g. 0.40)
}

export interface ReliabilityInputs {
  failuresPer1000NodeDays: number; // crashes per 1,000 nodes per day
  recoveryHours: number; // detect + replace node + restart + reload checkpoint + warm-up, per failure
  checkpointStallHours: number; // how long training PAUSES for each checkpoint
  checkpointIntervalHours: IntervalSetting; // hours between checkpoints, or 'auto'
  setupHours: number; // one-off cluster setup / validation time
  method: Method; // 'paper' = the whitepaper's first-order maths, 'daly' = recommended
}

export interface CostInputs {
  pricePerGpuHour: number; // USD list price
  discountPct: number; // 0..100 (commitment discount)
  billing: 'used' | 'reserved'; // pay for hours used, or for a fixed reserved block
  reservedHours: number; // only used when billing = 'reserved'
  storageTB: number; // dataset + checkpoints kept
  storagePricePerGiBMonth: number;
  storageMonths: number;
  egressGiB: number;
  egressPricePerGiB: number;
  peopleHours: number;
  peopleRatePerHour: number;
  contingencyPct: number; // % of GPU cost held back for reruns / surprises
}

export interface RunResult {
  trainHours: number; // useful training time = idealHours / mfu
  mtbfHours: number; // mean time between failures for THIS cluster size
  intervalHours: number; // checkpoint interval actually used
  expectedFailures: number;
  wallHoursExSetup: number;
  totalHours: number; // wall-clock hours the cluster is reserved/used, incl. setup
  usefulShare: number; // trainHours / totalHours
  breakdown: { useful: number; checkpoints: number; recovery: number; rework: number; setup: number };
}

export interface CostResult {
  billedHours: number;
  unusedReservedHours: number;
  effectivePricePerGpuHour: number;
  gpuCost: number;
  storageCost: number;
  egressCost: number;
  peopleCost: number;
  contingencyCost: number;
  totalCost: number;
  wastedGpuCost: number; // GPU money spent on anything other than useful training
  effectivePricePerUsefulGpuHour: number; // gpuCost / useful GPU-hours: the number to compare providers on
}

// ---------- building blocks ----------

/** Mean time between failures for the whole job. More nodes = more crashes. */
export function mtbfHours(gpus: number, gpusPerNode: number, failuresPer1000NodeDays: number): number {
  const nodes = gpus / gpusPerNode;
  if (failuresPer1000NodeDays <= 0 || nodes <= 0) return Infinity;
  return (24 * 1000) / (failuresPer1000NodeDays * nodes);
}

/** Convert a "crashes every X hours at N GPUs" claim into a per-node rate. */
export function failuresPer1000NodeDaysFromMtbf(mtbf: number, gpus: number, gpusPerNode: number): number {
  return (24 * 1000) / (mtbf * (gpus / gpusPerNode));
}

/** Young-Daly rule of thumb for the best checkpoint interval. */
export function youngDalyIntervalHours(stallHours: number, mtbf: number): number {
  return Math.sqrt(2 * stallHours * mtbf);
}

/**
 * Expected wall-clock time with random failures (Daly 2006). Counts failures that
 * strike during checkpoints, recovery and re-done work, not only "useful" time.
 * T = useful hours, tau = checkpoint interval, C = stall per checkpoint, R = recovery, M = MTBF.
 */
export function dalyWallHours(T: number, tau: number, C: number, R: number, M: number): number {
  if (!isFinite(M)) return T + (T / tau) * C;
  return M * Math.exp(R / M) * (Math.exp((tau + C) / M) - 1) * (T / tau);
}

/** The whitepaper's first-order method: failures counted against useful time only. */
export function paperWallHours(T: number, tau: number, C: number, R: number, M: number): number {
  const n = isFinite(M) ? T / M : 0;
  return T + (T / tau) * C + n * R + (n * tau) / 2;
}

// ---------- helpers for the "from model size" input ----------

/** Hours at 100% of peak, using the 6 x parameters x tokens rule of thumb (dense models). */
export function idealHoursFromModel(paramsBillions: number, tokensTrillions: number, gpus: number, peakTflops: number): number {
  const flops = 6 * paramsBillions * 1e9 * tokensTrillions * 1e12;
  return flops / (gpus * peakTflops * 1e12) / 3600;
}

/** Checkpoint size in TB. ~12 bytes per parameter = fp32 weights + two Adam states. */
export function checkpointSizeTB(paramsBillions: number, bytesPerParam = 12): number {
  return (paramsBillions * 1e9 * bytesPerParam) / 1e12;
}

/** Pause per checkpoint if training stops while it is written. */
export function blockingStallHours(sizeTB: number, writeTBPerSecond: number): number {
  return sizeTB / writeTBPerSecond / 3600;
}

// ---------- main calculations ----------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function computeRun(job: JobInputs, rel: ReliabilityInputs): RunResult {
  const trainHours = job.idealHours / job.mfu;
  const mtbf = mtbfHours(job.gpus, job.gpusPerNode, rel.failuresPer1000NodeDays);
  const C = rel.checkpointStallHours;
  const tau =
    rel.checkpointIntervalHours === 'auto'
      ? clamp(youngDalyIntervalHours(C, mtbf), 1 / 6, trainHours)
      : Math.min(rel.checkpointIntervalHours, trainHours);

  const wallHoursExSetup =
    rel.method === 'paper'
      ? paperWallHours(trainHours, tau, C, rel.recoveryHours, mtbf)
      : dalyWallHours(trainHours, tau, C, rel.recoveryHours, mtbf);

  const expectedFailures = isFinite(mtbf) ? (rel.method === 'paper' ? trainHours : wallHoursExSetup) / mtbf : 0;
  const checkpoints = (trainHours / tau) * C;
  const recovery = expectedFailures * rel.recoveryHours;
  const rework = Math.max(0, wallHoursExSetup - trainHours - checkpoints - recovery); // lost work since last checkpoint (approx. split)
  const totalHours = wallHoursExSetup + rel.setupHours;

  return {
    trainHours,
    mtbfHours: mtbf,
    intervalHours: tau,
    expectedFailures,
    wallHoursExSetup,
    totalHours,
    usefulShare: trainHours / totalHours,
    breakdown: { useful: trainHours, checkpoints, recovery, rework, setup: rel.setupHours },
  };
}

export function computeCost(job: JobInputs, run: RunResult, cost: CostInputs): CostResult {
  const effectivePricePerGpuHour = cost.pricePerGpuHour * (1 - cost.discountPct / 100);
  const billedHours = cost.billing === 'reserved' ? Math.max(cost.reservedHours, run.totalHours) : run.totalHours;
  const unusedReservedHours = cost.billing === 'reserved' ? Math.max(0, cost.reservedHours - run.totalHours) : 0;
  const gpuCost = job.gpus * effectivePricePerGpuHour * billedHours;
  const storageCost = cost.storageTB * GIB_PER_TB * cost.storagePricePerGiBMonth * cost.storageMonths;
  const egressCost = cost.egressGiB * cost.egressPricePerGiB;
  const peopleCost = cost.peopleHours * cost.peopleRatePerHour;
  const contingencyCost = (gpuCost * cost.contingencyPct) / 100;
  const totalCost = gpuCost + storageCost + egressCost + peopleCost + contingencyCost;
  const wastedGpuCost = job.gpus * effectivePricePerGpuHour * (run.totalHours - run.trainHours);
  return {
    billedHours,
    unusedReservedHours,
    effectivePricePerGpuHour,
    gpuCost,
    storageCost,
    egressCost,
    peopleCost,
    contingencyCost,
    totalCost,
    wastedGpuCost,
    effectivePricePerUsefulGpuHour: gpuCost / (job.gpus * run.trainHours),
  };
}
