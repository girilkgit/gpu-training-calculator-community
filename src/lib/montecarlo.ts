// src/lib/montecarlo.ts
// Simulates random failures to show a range (P10/P50/P90) instead of one number.
// Also used in tests to cross-check the closed-form Daly formula in model.ts.

export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimOptions {
  trainHours: number;
  intervalHours: number;
  stallHours: number;
  recoveryHours: number;
  mtbfHours: number;
  trials?: number;
  seed?: number;
}

export interface SimResult { mean: number; p10: number; p50: number; p90: number }

export function simulateWallHours(o: SimOptions): SimResult {
  const trials = o.trials ?? 2000;
  const rand = mulberry32(o.seed ?? 42);
  const expo = () => -o.mtbfHours * Math.log(1 - rand());
  const totals: number[] = [];
  for (let k = 0; k < trials; k++) {
    let t = 0;
    let remaining = o.trainHours;
    while (remaining > 1e-9) {
      const seg = Math.min(o.intervalHours, remaining);
      for (;;) {
        const x = expo();
        if (x >= seg + o.stallHours) { t += seg + o.stallHours; break; } // segment + checkpoint finished
        t += x; // crashed: progress since last checkpoint is lost
        for (;;) { // restart (can itself be interrupted)
          const y = expo();
          if (y >= o.recoveryHours) { t += o.recoveryHours; break; }
          t += y;
        }
      }
      remaining -= seg;
    }
    totals.push(t);
  }
  totals.sort((a, b) => a - b);
  const q = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
  return { mean: totals.reduce((s, v) => s + v, 0) / totals.length, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}
