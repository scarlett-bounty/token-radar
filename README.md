# Token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/scarlett-bounty/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/scarlett-bounty/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar for [make.fun's "Build the best token launch radar" bounty](https://make.fun/bounty/token-radar-01). It reads a sealed snapshot of every protocol DefiLlama tracks, finds the ones that record no token, ranks them by an implied launch value, and hands in a web dashboard with a board, a detail view for each protocol, and the steps to farm it.

## How it works

- **Value model (radar-2)**: a peer-multiple model built only from the snapshot's own figures. Each protocol's implied value is its TVL times the median market-cap/TVL multiple of the live-token protocols in its category (shrunk toward the market-wide median when a category has fewer than 3 live peers), adjusted for 7-day TVL growth, for how long it has run with no token (maturity), and for chain breadth. No protocol name is ever special-cased.
- **Board**: 178 rows — all 40 protocols on the snapshot's watchlist, plus 138 pre-token protocols below the $50M floor the radar exists to find early. Ranks are 1–178 with implied values from $626M down to $846K.
- **Farm plans**: 6 concrete steps per protocol, each with what it costs and how long it takes, generated from the protocol's category, chains, TVL tier and age.
- **Dashboard**: a static, no-network page (board with sorting, search and category filter, a detail view per protocol with the model's four-factor breakdown and farm plan, a live-token tab kept apart from the ranked board, and a model lab that re-ranks live as you move the weights).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Reads the sealed snapshot (`/input/snapshot.json` in the grader, or `--input <file|dir>`), writes the ranked board to `/output/board.json`, the dashboard's data to `/output/data.js`, copies `dashboard/` and `screenshots/` to `/output`, and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-board.ts`. Node 22, standard library only, no network. Deterministic: two runs write byte-identical output.

## Verify

```sh
# board: 178 rows, watchlist 40/40, ranks 1–178, implied values non-increasing
node -e "const b=require('./out/board.json'); console.log(b.rows.length)"
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
