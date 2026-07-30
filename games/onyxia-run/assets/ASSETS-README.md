# Adding your own art to Onyxia Run

No coding needed. The game works with the built-in placeholder art; every image
below is optional and can be swapped one at a time.

## Swap any sprite

1. Save your image in the `sprites\` folder, e.g. `sprites\whelp-1.png`.
2. Open `manifest.json` (this folder) in Notepad.
3. Change the matching filename, e.g. `"sprites/whelp-1.svg"` →
   `"sprites/whelp-1.png"` (keep forward slashes `/`).
4. Refresh the game (F5).

If an image file is missing or the name is wrong, the game still runs — it
draws simple colored shapes instead, so a typo never breaks the kiosk.

## What each image is

| Manifest field | What it is | Notes |
|---|---|---|
| `player.frames` | The flying character, 2+ flap frames | Square images, drawn ~53px tall. Facing right. |
| `obstacles.top` / `bottom` | The pillars | Tall images (~110×800). `top` hangs from the ceiling, `bottom` rises from the floor. |
| `background.layers` | Parallax backgrounds, far → near | 1280×720. Must tile horizontally (left edge matches right edge). `speedFactor`: 0 = still, 1 = full scroll speed. |
| `floor.image` | Scrolling lava strip | 256 wide, tiles horizontally. |

## Tuning

- `player.hitboxRadius` (default 22): smaller = more forgiving collisions.
- `player.frameMs` (default 120): flap animation speed.
- `text.title`, `text.prizeLine`, `text.deathLines`: all the on-screen flavor
  text — add as many death lines as you like, one is picked at random.
