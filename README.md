# voidrunner

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/0xdopeserver-maker/voidrunner/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/0xdopeserver-maker/voidrunner/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

VOIDRUNNER is a top-down space shooter. You fly one fighter in the Outer Rim and hold a line that never stops coming. WASD moves, Space fires, the mouse aims. Each trigger pull is a single aimed round from the nose, so every shot is a decision rather than a spray.

Four enemy kinds apply different pressure: grunts drift straight down, weavers slide a sine path, brutes soak damage and hit hard on contact, and snipers hold range and fire aimed bolts at you. A kill without taking a hit builds a combo that multiplies the score, and roughly one kill in six drops a shield or hull pickup. The shield sits above a 100-point hull and regenerates, so a run is lost by attrition, not by one mistake.

Waves scale their mix and their count. The sector is scored, the best score is kept, and a run ends on a hull-breach card showing waves survived, kills, combo, the score and the best, with Enter to redeploy. Every projectile draws a trail along its real travel direction, kills throw a shockwave ring plus fast sparks and slower embers, and the whole scene renders at device pixel ratio up to 2 so a still frame reads as action.

Plain canvas 2D, no libraries, no network, no build step. Screenshot-stable composition at 1280×720 whatever the window size.

## Run it

```sh
node serve.ts --port 8080
# then open http://localhost:8080
```

To build the submission output (game/, screenshots/ and dossier.json):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Controls: WASD or arrows to move, Space to fire, mouse to aim, Enter to launch and to redeploy.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
