# SIGNAL — Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Adesudu/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Adesudu/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Every pre-token protocol in the snapshot, ranked by what its token would be worth — and what to do about it before it launches.

## The model (signal-1)

Implied value = TVL × category multiple × growth multiplier × maturity multiplier × breadth multiplier × size taper.

- **Category multiple** — what the market pays for that kind of protocol's TVL (perps 0.60, prediction markets 0.50, DEXs 0.45, lending 0.35, bridges 0.15).
- **Growth** — the 7-day TVL change, clamped to −40%…+100%, weighted 0.6.
- **Maturity** — 0.70 + up to 0.30 for up to 4 years running with no token.
- **Breadth** — +3% per extra chain, up to 8.
- **Taper** — above $1B TVL, a mild trim for mercenary capital.

No protocol name is special-cased: the same arithmetic scores every row. The board ranks all 226 rankable pre-token protocols in the snapshot — the 40-protocol watchlist is the floor, never the ceiling.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=qq4pkark&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
