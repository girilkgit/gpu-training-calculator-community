# Sources

This page lists every default value in the calculator, where it comes from, and how far to trust it.

Each value carries one of three labels:

- **vendor**: published by the company that sells the product, such as a price list or the provider's own reliability figures.
- **measured**: a published measurement from a real system, such as a research paper or a training report.
- **assumption**: no public figure was found, so the value is an estimate. Change it to match your own situation.

All data as of 2026-10-17.

## Chips

| Default | Value | Confidence | Source |
|---|---|---|---|
| H100 SXM peak BF16 dense | 989 TFLOPS/GPU | vendor | NVIDIA H100 product page (1,979 with sparsity; dense = half). |
| H100 SXM peak FP8 dense | 1,979 TFLOPS/GPU | vendor | NVIDIA H100 product page. |
| H100 MFU | 35% / 40% / 54% (low / default / high) | measured | Meta Llama 3 405B on 16k H100: ~41% BF16. SemiAnalysis on 576–2,304 H100: ~54% BF16, ~43% FP8. Lambda: 35–45% typical. |
| H200 SXM peak BF16 dense | 989 TFLOPS/GPU | vendor | Same compute as H100 (more memory/bandwidth). |
| H200 MFU | same as H100 | measured | Same compute as H100 → same MFU evidence. |
| B200 (HGX) peak BF16 dense | 2,250 TFLOPS/GPU | vendor | NVIDIA HGX B200: 18 PFLOPS dense per 8 GPUs. |
| B200 MFU | 24% / 45% / 55% (low / default / high) | measured | Lambda: Llama 3.1 70B on 16 B200 went from ~24% (untuned) to ~50% (tuned); 8B reached ~55%. Low confidence. |

## Pricing (Nebius)

| Default | Value | Confidence | Source |
|---|---|---|---|
| H100 on-demand | $4.50 / GPU-h | vendor | https://nebius.com/prices |
| H200 on-demand | $5.40 / GPU-h | vendor | https://nebius.com/prices |
| B200 on-demand | $8.50 / GPU-h | vendor | https://nebius.com/prices |
| Max commitment discount | up to 35% | vendor | Nebius: multi-month reservations of large clusters. Does not apply to one-week jobs. |
| Shared filesystem | $0.080 / GiB-month | vendor | https://nebius.com/prices |
| Weka | $0.100 / GiB-month | vendor | https://nebius.com/prices |
| Object storage (standard) | $0.0147 / GiB-month | vendor | https://nebius.com/prices |
| Object-storage egress | $0.015 / GiB | vendor | https://nebius.com/prices |
| Network egress | $0 / GiB | vendor | Listed as free. |
| Managed Kubernetes / Slurm | $0 | vendor | Listed as free. |

## Failure rates (crashes per 1,000 node-days; 1 node = 8 GPUs)

| Preset | Value | Confidence | Source |
|---|---|---|---|
| Nebius cluster (33 h at 3,000 GPUs) | 1.94 | vendor | Nebius, October 2025 (nebius.com): a crash about every 33 hours on its own 3,000-GPU cluster. Provider-reported. |
| Meta RSC-2 (A100) | 2.34 | measured | Sivathanu et al. 2024, arXiv 2410.21680. |
| Meta Llama 3 (H100, 16k GPUs) | 3.8 | measured | 419 unexpected interruptions / 54 days / 2,048 nodes (Meta Llama 3 report). |
| Meta RSC-1 (A100) average | 6.5 | measured | Sivathanu et al. 2024; varied 2.5–17.5 over time. |
| Early B200 cluster (504 GPUs) | 7.1 | measured | Lablup 2026, arXiv 2605.09370: 23 abnormal terminations in 1,294 training hours on 60 nodes (includes software faults). |

## Recovery per failure

| Preset | Value | Confidence | Source |
|---|---|---|---|
| Automated (detect + restart) | 0.25 h | measured | Meta RSC restart overhead 5–20 min (Sivathanu 2024); ByteDance MegaScale: detect <10 min, catch up within 15 min. |
| Automatic retry, small cluster | 1.9 h | measured | Lablup 2026 (504 B200): median downtime 1.9 h; includes ~31 min checkpoint loading. |
| Needs a human | 3.3 h | measured | Lablup 2026: median downtime 3.3 h when manual. |

## Checkpoints

| Default | Value | Confidence | Source |
|---|---|---|---|
| Bytes per parameter | 12 B | measured | fp32 weights + 2 Adam states (Epoch AI: 405B → 4,860 GB). |
| Async stall (default) | 20 s | measured | PyTorch async: ~6 s (7B); Lablup 18–32 s; PyTorch "often under 30 s". |
| Typical interval | 15 min – 3.3 h | measured | Sivathanu: hourly typical; NVIDIA: 15–30 min; VAST: 40 min (800B run); Lablup: 1.4–3.3 h. |
| Default interval | Auto (Young-Daly) | assumption | Young-Daly rule: sqrt(2 × stall × MTBF). |

## Setup / spares / people

| Default | Value | Confidence | Source |
|---|---|---|---|
| Setup hours (default) | 4 h | assumption | No public benchmark. Illustrative values of 3 to 5 h are used. Imbue: ~10% of machines failed to boot at first, ~3% break every week. |
| Spares (managed cloud) | 0% | assumption | Included by the provider. |
| Spares (self-managed) | 10–20% | measured | Imbue kept 10–20% extra machines. |
| People rate | $75 / h | assumption | Illustrative US DevOps specialist rate. |

## Method

| Model | Confidence | Source |
|---|---|---|
| Daly (2006) | measured | Daly 2006 — accounts for failures during checkpoints, recovery and re-done work. Cross-checked against a Monte Carlo simulation in the test suite. |

## Conversion constants

| Constant | Value | Source |
|---|---|---|
| 6ND rule (ideal hours) | 6 × params × tokens / (GPUs × peak TFLOPS) | Standard dense-model FLOPs rule of thumb. |
| TB → GiB | 1 TB = 931.32 GiB | 1e12 bytes / 2^30. |
