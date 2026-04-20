# Beacon Runner

Beacon Runner is a browser-based endless runner built with plain HTML, CSS, and canvas.

The current game ships as a single mode with:
- 3-lane infinite runner gameplay
- lives and score chasing
- coins, beacons, shield, magnet, and boost pickups
- extra lives every `100` coins
- tutorial flow
- attract-mode demo on the start screen
- local top-10 leaderboard with arcade-style name entry
- responsive desktop and mobile controls
- `Normal` and `Super` difficulty

## Play

Primary entry point:
- `index.html`

Also available:
- `wasteland-run.html`
  This mirrors `index.html` as a compatibility alias for older links and local previews.
- `scorecard.html`

## Controls

Keyboard:
- `Left / Right`: switch lanes
- `Up`: jump
- `Enter`: start / restart
- `Space`: pause / resume

Mobile:
- swipe `left / right / up`
- optional on-screen controls can be enabled from the top bar

## Pickups

- `Coin`: score and progress toward the next extra life
- `Beacon`: larger score bonus
- `Shield`: blocks one hit
- `Magnet`: pulls pickups toward the runner
- `Boost`: temporary speed burst

## Leaderboard

- Scores are stored locally in the browser with `localStorage`
- The board keeps the top 10 runs
- Name entry supports up to 6 letters
- The dedicated leaderboard lives at `scorecard.html`

## Local Development

This is a static project. Serve the folder with any simple local web server.

Example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
```

## Main Files

- [index.html](./index.html): main game page
- [game.js](./game.js): live gameplay, rendering, HUD, input, audio, and overlays
- [scorecard.html](./scorecard.html): dedicated leaderboard page
- [scorecard.js](./scorecard.js): leaderboard rendering and refresh
- [score-utils.js](./score-utils.js): score storage and leaderboard helpers
- [dom-utils.js](./dom-utils.js): safe DOM construction helpers
