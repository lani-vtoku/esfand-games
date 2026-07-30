# Adding your own screenshots to WoW GeoGuessr

No coding needed. You'll edit one text file and use a point-and-click page.

## Add a zone screenshot

1. Take an in-game screenshot (any size; 16:9 looks best). Save it as a `.jpg`
   or `.png` in this folder, under `screenshots\`.
   Example: `screenshots\barrens-01.jpg`
2. Open `manifest.json` (this folder) in Notepad.
3. Find the `"locations": [` list and copy one existing block, e.g.:

   ```
   {
     "id": "barrens-01",
     "image": "screenshots/barrens-01.jpg",
     "zoneName": "The Barrens",
     "map": null,
     "difficulty": "easy"
   }
   ```

   Paste it before the closing `]`, and make sure there's a comma `,` between
   blocks. Set:
   - `id`: anything unique (zone + number is easy)
   - `image`: the file you saved in step 1 (use forward slashes `/`)
   - `zoneName`: shown to players after they guess
   - `map`: leave as `null` — you'll set it in the next step
4. Open the calibration page: `http://localhost:8080/games/geoguessr/calibrate.html`
   (or from the hub page). Your new screenshot appears at the top flagged
   **NEEDS COORDS**. Select it, click its true location on the map, nudge with
   arrow keys if needed.
5. Click **Download manifest.json**, then move the downloaded file into this
   folder, replacing the old `manifest.json`.
6. Refresh the game (F5). Done.

Uncalibrated screenshots (with `map: null`) are skipped by the game, so it's
safe to add several and calibrate later. The game needs at least 5 calibrated
locations to run.

## Replace the world map

1. Save your map image as `map\azeroth-map.png` (or any name).
2. In `manifest.json`, set `"map"` → `"image"` to that filename and set
   `"width"` and `"height"` to the image's real pixel size.
3. **Important:** changing the map image means all existing coordinates are
   wrong — re-do them on the calibrate page.

## Make scoring easier or harder

In `manifest.json` under `"game"`:
- `fullPointsRadiusPct` (default 3): bigger = more forgiving perfect-score zone.
- `decayPct` (default 12): bigger = points fall off more slowly with distance.
