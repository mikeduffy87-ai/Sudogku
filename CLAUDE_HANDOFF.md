# Sudogku — handoff notes (current build)

Ad-free, offline, dog-themed take on Meowdoku. Installable PWA. Single-file UI (`index.html`) + engine (`engine.js`, also runs in a Web Worker).

## Product decisions (from Mike)
- **3 uses per puzzle** for each tool: Find a Dog, Logic Hint, Sniff Out. Small red badge on the button's top-right rim (must not cover the art) counts down; button greys at 0. Restart refills. Undo does not refund a use.
- Single tap = ✕, tap again = clear, double tap = dog, drag = many ✕ (drag from a ✕ erases).
- Correct dogs lock in place. A wrong dog shakes, cracks a bone, then becomes a **locked red ✕**.
- Three golden bones. Out of bones: Try again, or Keep going with one extra bone for half points.
- **Starter dog only when needed** (like Meowdoku): a puzzle with an easy opening (a one-square colour, or a colour sitting in a single row/column) starts blank; otherwise it gets one locked starter dog. About 1 level in 10 gets one. Difficulty is graded from the actual starting board.
- One long level track. **Daily puzzle** unlocks after level 20 (8×8, Hard), with streak and best time.
- **Toby is ivory/white** (Ivory Edition colour correction of all `toby/` art, Nov 2026). Home hero `toby-home.webp` and app icons are still the older cream colouring.
- **Mascot is Toby** (Mike's dog), from Mike's character sheet. Each sheet item is used where the sheet says (all in `toby/`, transparent PNGs). The expressions, action poses and tile head now come from Mike's clean separate render `design/toby-expressions.png` (transparent, row 1: sniff, hint, oops, happy, focused; row 2: excited, sorry, cheeky, tile head):
  - In-Game Icon (Tile) → `tile-head.png` (Toby's head lifted off the icon's lilac square): every placed dog, sitting on the square's own region colour.
  - Colour key above the board: each colour is a Toby-head silhouette (masked from `face-happy.png`) filled with that colour; when the colour has its dog it becomes the solid Happy face.
  - App / Game Icon → `icon-180/192/512.png`.
  - Happy → Find a Dog button, help screen, rule cards, loading. Focused (Thinking) → hint card. Excited (Win) → flashes for ~0.75 s on each correctly placed dog, then the normal tile head. Sorry (Mistake) → "bone cracked" toast. Cheeky → "Found one!" toast.
  - Sniff Out action → Sniff Out button and toast. Hint action → Logic Hint button. Puzzle Complete → level win (`act-complete.png`, cut from Mike's high-res render `design/toby-celebrate.png`). Lost a Bone → out-of-bones screen (`act-oops.png`, from Mike's render `design/toby-sad.png`). The Paw-some win screen always uses the full-body celebration, daily included.
  - Home screen follows Mike's home design (`design/home-screen.png`): the wordmark above `toby-home.webp` (sitting Toby with the lilac blob and paw prints, transparent background).
  - `logo.webp` is the purple Sudogku wordmark cut from `design/home-screen.png` (complete outline, no ribbon), used on the home screen and game header.

## Difficulty (tier 1 Easy, 2 Medium, 3 Hard, 4 Expert, 5 Master)
- Mix per level range: 1–2 Easy 100%; 3–5 Easy 40 / Medium 60; 6–15 Medium 75 / Hard 25; 16–30 Medium 45 / Hard 45 / Expert 10; 31–50 Medium 20 / Hard 50 / Expert 30; 51+ Medium 10 / Hard 30 / Expert 50 / Master 10.
- Tiers are **dealt in exact quotas** within each range (51+ in blocks of 20), in a fixed shuffled order (`tierForLevel`). Rounding is the only deviation (e.g. 3 levels can't split 40/60 exactly).
- **Strict generation** (`generateLevel`): each candidate is graded from its real starting board (with a starter dog only if it has no easy opening); cheap 'nudge' steps walk through nearby unique puzzles (one square moved to a neighbouring colour) so big boards aren't regenerated from scratch; per-size try budgets; if the level's size can't deliver the tier, better-suited sizes are tried; last resort is the nearest tier, never Easy from level 6. Returns `requestedTier`, `tier`, `difficultyMatched`, `fallback`.
- Verified: levels 1–200 all matched their requested tier, 0 fallbacks, 0 Easy from level 6, all unique. Generation time median ~50 ms, p95 ~2 s, worst ~9 s (big boards); the next level is prefetched in the background.

## Sniff Out
- `sniffCells` in the engine: up to 3 empty non-solution squares, preferring ones not already ruled out by placed dogs, spread over different colours and rows. One undoable action.
- Animation: Toby's Sniff Out pose pops onto the board and hops between the squares (nearest-first path), flipping to face his direction; each ✕ pops in with a sniff sound as he arrives. Skipped when Reduced motion is on.

## Screens
- Bichon **home screen** on launch (logo, score/solved, Play · Level N, Daily card, help, settings). Back arrow in the game header returns home.

## Tests
- `node tests/engine.test.js`: 11,436 checks — uniqueness, hint soundness, Apply exactness, starter correctness, Sniff Out safety/preferences, exact difficulty quotas, strict tier matching.
- UI checked in desktop Chrome with simulated touch at 390×844 and 375×667. **Still needs a check on a real iPhone in Safari** (double-tap timing, drag, safe areas, offline update).

## When changing files
Bump `CACHE` in `sw.js` (currently `sudogku-toby-v25`) so installed copies update.

## Performance notes (iPhone)
- Avoid CSS `filter` (drop-shadow etc.) on anything that animates or repeats on the board; Safari redraws it every frame. Shadows are baked into the art (`toby/tile-head.png`) and into the ✕ symbol.
- The placed dog is a CSS background on one shared, pre-decoded image, not a new `<img>` per square.
- `paint()` only touches squares whose look changed; saves are batched (`saveGame` → `flushSave` after ~250 ms, and when the app is hidden); sounds play just after the frame is drawn (`afterPaint`).

## Game screen layout
- Meowdoku-style (Mike's picks): logo kept in the header; Level and Score centred together; bones on their own centred row; colour heads in a tab joined to the top of the board (curved fillets); board nearly edge to edge (6px side padding).
- Header, scores and rule cards sit low, right above the board; the whole stack is centred vertically on tall phones (`header{margin-top:auto}` + `.tools{margin-bottom:auto}`). `layout()` sizes the board from the height left after the other rows, so there's no gap above or below it.
- `sw.js` fetches the site's own files with `cache:'no-cache'` and is registered with `updateViaCache:'none'`, so merged updates reach phones on the next open instead of after GitHub Pages' ~10-minute HTTP cache.

## Splash screen
- On each launch a Big Dave Gaming splash (Mike's own character) shows for ~1.8 s, tap to skip: `splash/background.jpg` (from `design/splash-background.png`) with `splash/big-dave.webp` centred (720px WebP, ~100 KB, preloaded so it beats the fog) (from Mike's transparent badge `design/big-dave-badge.png`).
- Load order: the splash badge is preloaded first; home-screen images use `data-src` and the Toby warm-up waits for the `splashready` event, so the badge isn't slowed down on a cold start.
