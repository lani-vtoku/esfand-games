# Esfand Games

Browser-based kiosk games for a WoW-themed event. No internet needed at
runtime, no build step, no dependencies — just Node (preinstalled) and Edge.

## Games

| Game | URL | Kiosk launcher |
|---|---|---|
| Onyxia Run (Flappy Bird re-skin, all-night leaderboard) | `http://localhost:8080/games/onyxia-run/` | `kiosk-onyxia.bat` |
| WoW GeoGuessr (guess the zone, 5 rounds) | `http://localhost:8080/games/geoguessr/` | `kiosk-geoguessr.bat` |

More stations (Darkmoon Fortune, Deathroll, Trivia, Photobooth) can be added
later: copy a folder under `games/`, add an entry to `games.json`.

## Running

- **Development**: double-click `start-server.bat` (or `node server.mjs`), then
  open `http://localhost:8080` for the hub page.
- **Event kiosk**: double-click `kiosk-onyxia.bat` or `kiosk-geoguessr.bat` on
  each station PC. It starts the server if needed and opens Edge in kiosk
  (fullscreen, locked-down) mode with an isolated browser profile.
- **Tests**: `node --test tests/*.test.mjs`
- **Regenerate placeholder art**: `node tools/make-placeholders.mjs`

## Adding real WoW art

Each game's assets folder has a plain-English guide for non-devs:

- `games/geoguessr/assets/ASSETS-README.md` — adding zone screenshots and
  setting their map coordinates with the point-and-click calibrate page
  (`http://localhost:8080/games/geoguessr/calibrate.html`).
- `games/onyxia-run/assets/ASSETS-README.md` — swapping sprites, backgrounds,
  and flavor text.

Everything works with placeholder art out of the box; swap images one at a
time whenever they're ready.

## Admin controls (on any game screen)

Tap the **top-left corner 5 times within 3 seconds** (or press
**Ctrl+Shift+A**) to open the admin overlay: reset game, export/clear
leaderboard, exit fullscreen.

## Leaderboard safety (Onyxia Run)

Scores are stored in the browser's localStorage **and** mirrored to
`data/onyxia-leaderboard… .json` on disk via the local server. On boot the two
are merged, so a cleared browser profile or swapped browser doesn't lose the
night's scores. Use admin → **Export leaderboard** at close to save a JSON
file for prize verification.

## Event-day checklist

Before doors:
1. On each station PC, copy this whole folder locally (don't run off a USB
   stick or network share).
2. Double-click the station's `kiosk-*.bat`. Verify: fullscreen, game
   playable, attract screen appears after ~75s idle.
3. Onyxia station: play one throwaway run, enter initials, press F5 —
   score must still be on the leaderboard. Then admin → Clear leaderboard.
4. GeoGuessr station: play one full 5-round game to confirm all screenshots
   load and scoring looks sane.

If something breaks mid-event:
- **Game frozen / weird state** → admin gesture → Reset game. If that fails,
  Alt+F4 and double-click the kiosk `.bat` again (leaderboard survives).
- **Blank page** → the server died. Double-click the kiosk `.bat` (it
  restarts the server automatically), or `start-server.bat`.
- **"Asset problem" screen** → someone edited a manifest.json and broke the
  JSON. The screen names the file and problem; fix it in Notepad, press F5.

At close:
- Onyxia station: admin gesture → **Export leaderboard** → the JSON download
  is the official standings for the prize. `data/esfand.onyxia.leaderboard.v1.json`
  on disk is the backup copy.

## Layout

```
server.mjs            static server + POST /api/save/<key> (port 8080)
games.json            game registry for the hub page
index.html            hub page
shared/               theme.css + kiosk/storage/manifest/ui JS modules
games/<game>/         one self-contained folder per game (+ assets/manifest.json)
tools/                placeholder art generator
tests/                node --test unit tests (pure logic modules)
data/                 runtime leaderboard backups (created by the server)
```
