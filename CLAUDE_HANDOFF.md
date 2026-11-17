# Sudogku — handoff notes (current build)

Ad-free, offline, dog-themed take on Meowdoku. Installable PWA. Single-file UI (`index.html`) + engine (`engine.js`, also runs in a Web Worker).

## Product decisions (from Mike)
- **3 uses per puzzle** for each tool: Find a Dog, Logic Hint, Sniff Out. Red badge counts down; button greys at 0. Restart refills. Undo does not refund a use.
- Single tap = ✕, tap again = clear, double tap = dog, drag = many ✕ (drag from a ✕ erases).
- Correct dogs lock in place. A wrong dog shakes, cracks a bone, then becomes a **locked red ✕**.
- Three golden bones. Out of bones: Try again, or Keep going with one extra bone for half points.
- Every puzzle starts with one locked **starter dog**.
- One long level track. **Daily puzzle** unlocks after level 20 (8×8, Hard), with streak and best time.
- **Mascot is Toby** (Mike's dog), from Mike's character sheet. Each sheet item is used where the sheet says (all in `toby/`, transparent PNGs):
  - In-Game Icon (Tile) → `tile.png`: every placed dog on the board.
  - App / Game Icon → `icon-180/192/512.png`.
  - Happy → Find a Dog button, help screen, rule cards, loading. Focused (Thinking) → hint card. Excited (Win) → daily-puzzle win. Sorry (Mistake) → "bone cracked" toast. Cheeky → "Found one!" toast.
  - Sniff Out action → Sniff Out button and toast. Hint action → Logic Hint button. Puzzle Complete → level win. Lost a Bone → out-of-bones screen.
  - Home screen uses `toby-full.png` (full-body Toby). The bone logo (`logo.png`) is unchanged; the sheet's purple Sudogku wordmark is not used yet.

## Difficulty (tier 1 Easy, 2 Medium, 3 Hard, 4 Expert, 5 Master)
- Mix per level range: 1–2 Easy 100%; 3–5 Easy 40 / Medium 60; 6–15 Medium 75 / Hard 25; 16–30 Medium 45 / Hard 45 / Expert 10; 31–50 Medium 20 / Hard 50 / Expert 30; 51+ Medium 10 / Hard 30 / Expert 50 / Master 10.
- Tiers are **dealt in exact quotas** within each range (51+ in blocks of 20), in a fixed shuffled order (`tierForLevel`). Rounding is the only deviation (e.g. 3 levels can't split 40/60 exactly).
- **Strict generation** (`generateLevel`): each candidate puzzle is graded with every possible starter dog; per-size try budgets; if the level's size can't deliver the tier, better-suited sizes are tried; last resort is the nearest tier, never Easy from level 6. Returns `requestedTier`, `tier`, `difficultyMatched`, `fallback`.
- Verified: levels 1–200 all matched their requested tier, 0 fallbacks, 0 Easy from level 6, all unique. Generation time median ~50 ms, p95 ~2 s, worst ~9 s (big boards); the next level is prefetched in the background.

## Sniff Out
- `sniffCells` in the engine: up to 3 empty non-solution squares, preferring ones not already ruled out by placed dogs, spread over different colours and rows. One undoable action. Own nose icon (not the Bichon).

## Screens
- Bichon **home screen** on launch (logo, score/solved, Play · Level N, Daily card, help, settings). Back arrow in the game header returns home.

## Tests
- `node tests/engine.test.js`: 11,436 checks — uniqueness, hint soundness, Apply exactness, starter correctness, Sniff Out safety/preferences, exact difficulty quotas, strict tier matching.
- UI checked in desktop Chrome with simulated touch at 390×844 and 375×667. **Still needs a check on a real iPhone in Safari** (double-tap timing, drag, safe areas, offline update).

## When changing files
Bump `CACHE` in `sw.js` (currently `sudogku-toby-v9`) so installed copies update.
