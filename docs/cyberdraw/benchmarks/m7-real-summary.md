# M7 Real-Environment Runtime Snapshot Benchmark Summary

Generated: 2026-07-17T11:28:00.000Z

## Environment

- Node: v24.18.0
- pnpm: 10.8.1
- OS: Linux
- Architecture: x64
- Commit: bbd4b81eeb14
- draw.io runtime: 30.3.12
- Transport: http-ws
- HTTPS/Caddy suite: failed in this environment during preflight
- Seed: 424242

## Results

| Fixture | Scenario | Scope | Bytes p50 | Plugin p50 ms | WS p50 ms | Server validation p50 ms | Adapter p50 ms | Normalize p50 ms | Total p50 ms | Total p95 ms | Main-thread drift p50 ms | Payload reduction | Outcome | UI preserved |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| small | document | document | 91764 | 106.20 | 116.79 | 0.19 | 4.18 | 7.93 | 252.03 | 267.72 | 108.30 | n/a | within-limit | yes |
| small | pages-visible | pages | 46807 | 13.10 | 19.07 | 0.09 | 1.38 | 2.48 | 51.88 | 59.51 | 13.30 | 49.0% | within-limit | yes |
| small | pages-background | pages | 46807 | 81.00 | 88.18 | 0.13 | 1.77 | 3.26 | 194.80 | 201.07 | 81.20 | 49.0% | within-limit | yes |
| small | pages-two | pages | 92039 | 89.80 | 99.45 | 0.11 | 2.54 | 4.65 | 223.42 | 229.93 | 91.80 | -0.3% | within-limit | yes |
| small | pages-missing | pages | 1775 | 0.40 | 3.04 | 0.08 | 0.01 | 0.07 | 13.44 | 13.84 | 0.50 | 98.1% | soft-limit | yes |
| small | layers-small | layers | 22411 | 4.40 | 8.49 | 0.09 | 0.43 | 0.75 | 26.24 | 26.53 | 4.60 | 75.6% | within-limit | yes |
| small | layers-many | layers | 40242 | 8.10 | 12.85 | 0.11 | 0.80 | 1.41 | 36.00 | 36.53 | 8.20 | 56.1% | within-limit | yes |
| small | layers-hidden | layers | 22430 | 4.20 | 8.66 | 0.17 | 0.45 | 0.83 | 29.51 | 54.51 | 4.30 | 75.6% | within-limit | yes |
| small | layers-context-only | layers | 21530 | 4.00 | 8.41 | 0.09 | 0.44 | 0.68 | 25.81 | 26.47 | 4.20 | 76.5% | within-limit | yes |
| small | layers-cross-layer-edge | layers | 23472 | 4.50 | 8.51 | 0.09 | 0.40 | 0.71 | 25.88 | 25.98 | 4.70 | 74.4% | within-limit | yes |
| small | layers-external-references | layers | 21530 | 4.10 | 8.05 | 0.08 | 0.36 | 0.65 | 23.91 | 24.29 | 4.30 | 76.5% | within-limit | yes |
| small | selection-empty | selection | 2713 | 0.80 | 4.04 | 0.06 | 0.02 | 0.05 | 15.51 | 15.52 | 0.90 | 97.0% | within-limit | yes |
| small | selection-one | selection | 3470 | 3.10 | 20.21 | 0.07 | 0.08 | 0.12 | 62.78 | 69.41 | 3.30 | 96.2% | within-limit | yes |
| small | selection-multiple | selection | 5405 | 5.00 | 17.88 | 0.06 | 0.13 | 0.18 | 58.06 | 58.83 | 5.20 | 94.1% | within-limit | yes |
| small | selection-group | selection | 3343 | 2.60 | 18.73 | 0.06 | 0.06 | 0.10 | 55.78 | 57.50 | 2.90 | 96.4% | within-limit | yes |
| small | selection-edge | selection | 3966 | 3.00 | 18.73 | 0.07 | 0.08 | 0.11 | 59.47 | 64.79 | 3.30 | 95.7% | within-limit | yes |
| small | selection-external-terminals | selection | 3969 | 3.00 | 21.93 | 0.07 | 0.07 | 0.11 | 73.83 | 96.22 | 3.30 | 95.7% | within-limit | yes |
| small | freshness-no-change | pages | 46807 | 12.10 | 17.48 | 0.09 | 1.47 | 2.75 | 47.83 | 50.43 | 12.40 | 49.0% | within-limit | yes |
| small | freshness-inside-scope | pages | 46744 | 12.20 | 18.47 | 0.10 | 1.35 | 2.42 | 79.42 | 83.71 | 12.40 | 49.1% | within-limit | yes |
| small | freshness-outside-scope | pages | 46744 | 12.20 | 17.40 | 0.08 | 1.31 | 2.42 | 229.88 | 230.44 | 12.50 | 49.1% | within-limit | yes |
| small | freshness-selection-only | selection | 3407 | 2.70 | 16.77 | 0.06 | 0.07 | 0.10 | 47.68 | 53.12 | 2.90 | 96.3% | within-limit | yes |
| medium | document | document | 612655 | 797.40 | 857.28 | 0.31 | 22.46 | 46.71 | 1805.70 | 1815.83 | 800.50 | n/a | within-limit | yes |
| medium | pages-visible | pages | 205400 | 52.40 | 74.08 | 0.14 | 7.32 | 13.97 | 185.83 | 191.22 | 52.50 | 66.5% | within-limit | yes |
| medium | pages-background | pages | 205400 | 350.00 | 379.93 | 0.16 | 5.00 | 11.42 | 804.35 | 915.88 | 352.60 | 66.5% | within-limit | yes |
| medium | layers-small | layers | 72607 | 15.80 | 23.91 | 0.11 | 1.27 | 2.53 | 60.41 | 61.25 | 16.10 | 88.1% | within-limit | yes |
| medium | selection-empty | selection | 2836 | 0.90 | 4.82 | 0.07 | 0.02 | 0.07 | 17.15 | 18.00 | 1.00 | 99.5% | within-limit | yes |
| medium | selection-multiple | selection | 5664 | 5.10 | 19.40 | 0.07 | 0.11 | 0.20 | 62.99 | 65.72 | 5.20 | 99.1% | within-limit | yes |
| medium | freshness-inside-scope | pages | 205269 | 52.60 | 72.23 | 0.17 | 5.35 | 10.71 | 284.28 | 287.73 | 52.90 | 66.5% | within-limit | yes |
| medium | freshness-outside-scope | pages | 205269 | 50.40 | 69.86 | 0.11 | 4.99 | 11.09 | 1138.65 | 1170.22 | 50.50 | 66.5% | within-limit | yes |
| soft-limit | document | document | 16770151 | 2977.00 | 3781.64 | 1.84 | 30.40 | 53.62 | 7885.04 | 7885.04 | 2986.40 | n/a | hard-limit-error | yes |
| soft-limit | pages-visible | pages | 10236553 | 1186.60 | 1655.63 | 0.54 | 13.88 | 27.41 | 3353.74 | 3353.74 | 1187.40 | 39.0% | within-limit | yes |
| soft-limit | layers-small | layers | 2106636 | 316.80 | 418.23 | 0.23 | 2.98 | 6.56 | 858.36 | 858.36 | 317.10 | 87.4% | within-limit | yes |
| soft-limit | selection-multiple | selection | 38469 | 8.60 | 294.23 | 0.13 | 0.19 | 2.68 | 581.79 | 581.79 | 8.80 | 99.8% | within-limit | yes |
| hard-limit | document | document | 16775207 | 2795.70 | 3722.05 | 0.43 | 21.73 | 51.65 | 7246.51 | 7246.51 | 2816.10 | n/a | hard-limit-error | yes |
| hard-limit | pages-visible | pages | 14539296 | 1501.10 | 2217.69 | 0.32 | 20.10 | 43.33 | 4325.95 | 4325.95 | 1501.80 | 13.3% | soft-limit | yes |
| hard-limit | layers-small | layers | 2973456 | 285.90 | 413.07 | 0.19 | 3.60 | 6.14 | 864.77 | 864.77 | 286.40 | 82.3% | within-limit | yes |
| hard-limit | selection-multiple | selection | 38557 | 9.00 | 447.39 | 4.18 | 0.12 | 0.26 | 868.50 | 868.50 | 9.20 | 99.8% | within-limit | yes |

Memory values are Node process heap deltas around each iteration and are approximate, not peak memory. Main-thread values are timer/RAF drift approximations observed in the browser.
