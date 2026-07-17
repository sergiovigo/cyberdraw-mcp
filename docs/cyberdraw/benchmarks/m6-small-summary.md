# M6 Runtime Snapshot Benchmark Summary

Generated: 2026-07-16T17:50:26.765Z

## Environment

- Node: v24.18.0
- pnpm: 10.8.1
- OS: Linux
- Architecture: x64
- Commit: b5700560cdb1
- Iterations: 3
- Warmup: 1
- Seed: 424242

## Results

| Fixture | Scenario | Scope | Bytes p50 | Total p50 ms | Total p95 ms | Adapter p50 ms | Normalize p50 ms | Payload reduction | Time reduction | Outcome |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| small | document | document | 176098 | 232.92 | 280.44 | 21.63 | 30.91 | n/a | n/a | within-limit |
| small | pages-visible | pages | 88927 | 101.00 | 128.10 | 4.30 | 11.86 | 49.5% | 56.6% | within-limit |
| small | layers-small | layers | 26645 | 35.77 | 77.08 | 0.86 | 1.60 | 84.9% | 84.6% | within-limit |
| small | selection-multiple | selection | 3930 | 5.46 | 9.97 | 0.11 | 0.18 | 97.8% | 97.7% | within-limit |

Memory values are process heap deltas observed around each iteration and are approximate, not peak heap measurements.
