// src/data/defaults.ts
// Every default the calculator uses, with where it came from.
// confidence: 'vendor' = vendor-published, 'measured' = published measurement, 'assumption' = no public benchmark found.
import type { JobInputs, ReliabilityInputs, CostInputs } from '../lib/model';

export type Confidence = 'vendor' | 'measured' | 'assumption';
export const DATA_AS_OF = '2026-10-17';

// ---------------- Chips ----------------
export type ChipId = 'H100' | 'H200' | 'B200';

export const CHIPS: Record<ChipId, {
  label: string;
  peakBf16DenseTflops: number; // dense (no sparsity) per GPU
  peakFp8DenseTflops: number;
  mfu: { low: number; default: number; high: number }; // BF16
  mfuNote: string;
}> = {
  H100: {
    label: 'NVIDIA H100 SXM',
    peakBf16DenseTflops: 989,
    peakFp8DenseTflops: 1979,
    mfu: { low: 0.35, default: 0.4, high: 0.54 },
    mfuNote: 'Meta Llama 3 405B on 16k H100: ~41% BF16. SemiAnalysis tests on 576-2,304 H100: ~54% BF16, ~43% FP8 (measured against FP8 peak). Lambda: 35-45% typical for large runs.',
  },
  H200: {
    label: 'NVIDIA H200 SXM',
    peakBf16DenseTflops: 989, // NVIDIA lists 1,979 WITH sparsity; dense is half
    peakFp8DenseTflops: 1979,
    mfu: { low: 0.35, default: 0.4, high: 0.54 },
    mfuNote: 'Same compute as H100 (more memory and bandwidth), so same MFU evidence.',
  },
  B200: {
    label: 'NVIDIA B200 (HGX)',
    peakBf16DenseTflops: 2250, // NVIDIA HGX B200: 18 PFLOPS dense per 8 GPUs
    peakFp8DenseTflops: 4500,
    mfu: { low: 0.24, default: 0.45, high: 0.55 },
    mfuNote: 'Lambda: Llama 3.1 70B on 16 B200 went from ~24% (untuned) to ~50% (tuned); 8B reached ~55%. Treat as low confidence.',
  },
};

// ---------------- Nebius list prices (verified on nebius.com/prices) ----------------
export const PROVIDER_PRESETS = {
  asOf: DATA_AS_OF,
  source: 'https://nebius.com/prices',
  onDemandUsdPerGpuHour: { H100: 4.5, H200: 5.4, B200: 8.5 } as Record<ChipId, number>,
  b300UsdPerGpuHour: 9.5, // listed, but not supported in v1 (little public MFU / reliability data)
  maxCommitDiscountPct: 35, // "up to", for multi-month reservations of large clusters
  note: 'Prices may change at any time. The discount needs a multi-month commitment, so it will not apply to a one-week job.',
  storageUsdPerGiBMonth: { sharedFilesystem: 0.08, weka: 0.1, objectStandard: 0.0147 },
  objectStandardEgressUsdPerGiB: 0.015,
  networkEgressUsdPerGiB: 0, // listed as free
  managedKubernetesAndSlurmUsd: 0, // listed as free
};/** @deprecated old name, kept so older imports keep working */
export const NEBIUS_PRICING = PROVIDER_PRESETS;

// ---------------- Failure-rate presets (crashes per 1,000 node-days; 1 node = 8 GPUs) ----------------
export const FAILURE_PRESETS: { id: string; label: string; value: number; confidence: Confidence; source: string }[] = [
  { id: 'vendor-claim', label: 'Nebius cluster, 33 h at 3,000 GPUs (Nebius reported, 2025)', value: 1.94, confidence: 'vendor', source: 'Nebius, October 2025 (nebius.com): a crash about every 33 hours on its own 3,000-GPU cluster.' },
  { id: 'rsc2-a100', label: 'Meta RSC-2, A100 (Sivathanu et al., 2024)', value: 2.34, confidence: 'measured', source: 'Sivathanu et al. 2024, arXiv 2410.21680' },
  { id: 'llama3-h100', label: 'Meta Llama 3, H100, 16k GPUs (Meta, 2024)', value: 3.8, confidence: 'measured', source: '419 unexpected interruptions in 54 days across 2,048 nodes (Meta Llama 3 report), converted to a per-node-day rate' },
  { id: 'rsc1-a100', label: 'Meta RSC-1, A100 average (Sivathanu et al., 2024)', value: 6.5, confidence: 'measured', source: 'Sivathanu et al. 2024, arXiv 2410.21680. The rate varied from 2.5 to 17.5 over time; this is the average.' },
  { id: 'b200-small', label: 'Early B200 cluster, 504 GPUs (Lablup, 2026)', value: 7.1, confidence: 'measured', source: 'Lablup 2026, arXiv 2605.09370: 23 abnormal terminations in 1,294 training hours on 60 nodes (includes software faults), converted to a per-node-day rate' },
];

// ---------------- Recovery per failure (hours) ----------------
export const RECOVERY_PRESETS: { id: string; label: string; hours: number; confidence: Confidence; source: string }[] = [
  { id: 'auto-fast', label: 'Automated (detect + restart)', hours: 0.25, confidence: 'measured', source: 'Meta RSC restart overhead 5-20 min (Sivathanu 2024); ByteDance MegaScale: detect <10 min, catch up within 15 min' },
  { id: 'auto-small', label: 'Automatic retry, small cluster', hours: 1.9, confidence: 'measured', source: 'Lablup 2026 (504 B200): median downtime 1.9 h; includes ~31 min checkpoint loading' },
  { id: 'manual', label: 'Needs a human', hours: 3.3, confidence: 'measured', source: 'Lablup 2026: median downtime 3.3 h when manual' },
];

// ---------------- Checkpoints ----------------
export const CHECKPOINT = {
  bytesPerParam: 12, // fp32 weights + 2 Adam states (Epoch AI: 405B -> 4,860 GB)
  asyncStallSeconds: { low: 6, default: 20, high: 32 }, // PyTorch async: ~6 s (7B); Lablup 18-32 s; PyTorch says "often under 30 s"
  typicalIntervalHours: 'Sivathanu: hourly typical; NVIDIA: 15-30 min; VAST: 40 min (800B run); Lablup: 1.4-3.3 h',
  defaultInterval: 'auto' as const, // Young-Daly
};

// ---------------- Setup / spares ----------------
export const SETUP = {
  defaultHours: 4,
  confidence: 'assumption' as Confidence,
  note: 'No public benchmark found, so 3 to 5 hours is an assumption. Self-built clusters take far longer: Imbue saw ~10% of machines fail to boot at first and ~3% break every week.',
  sparePctManagedCloud: 0,
  sparePctSelfManaged: [10, 20], // Imbue kept 10-20% extra machines
};

export const PEOPLE = { defaultRatePerHour: 75, note: 'Illustrative rate for a US DevOps specialist. Hours depend on the job, so they start at zero.' };

// ---------------- Ready-made scenarios ----------------
// The community version ships one starting scenario. Edit any number in the app to see what it does.
// (The keys below are internal names. They are kept so the rest of the app keeps working.)
interface Scenario { label: string; description: string; job: JobInputs; rel: ReliabilityInputs; cost: CostInputs }

const sharedJob: JobInputs = { gpus: 3000, gpusPerNode: 8, idealHours: 72, mfu: 0.4 };
const sharedCost: CostInputs = {
  pricePerGpuHour: 5.4, discountPct: 0, billing: 'used', reservedHours: 0,
  // Optional extras start empty so the headline is GPU time only. Prices are prefilled for when you add a size.
  storageTB: 0, storagePricePerGiBMonth: 0.08, storageMonths: 1,
  egressGiB: 0, egressPricePerGiB: 0,
  peopleHours: 0, peopleRatePerHour: PEOPLE.defaultRatePerHour,
  contingencyPct: 0,
};
const sharedRel = { checkpointStallHours: 20 / 3600, checkpointIntervalHours: 'auto' as const, method: 'daly' as const };

export const SCENARIOS: Record<'evidenceBasedH200', Scenario> = {
  evidenceBasedH200: {
    label: 'A Neo Cloud (Mostly Measured Figures)',
    description: 'Based on published measurements: a crash rate measured on Meta\'s Llama 3 run and a 15-minute automated recovery. Setup time is an assumption.',
    job: { ...sharedJob },
    rel: { ...sharedRel, failuresPer1000NodeDays: 3.8, recoveryHours: 0.25, setupHours: 4 },
    cost: { ...sharedCost },
  },
};
