# Sudogku

An ad-free, offline dog logic puzzle starring Toby. Place one dog in every row, every column and every colour, and don't let any two dogs touch, not even diagonally.

## Play it on an iPhone
1. In this repository on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, and save.
3. After a minute or two the game is live at `https://mikeduffy87-ai.github.io/Sudogku/`.
4. Open that link in **Safari**, tap **Share → Add to Home Screen**.

It then opens full-screen like an app, works offline, and keeps each person's levels and score on their own phone.

> GitHub Pages on a private repository needs a paid GitHub plan. On a free plan, make the repository public first (Settings → General → Danger Zone → Change visibility).

## What's where
- `index.html`: the whole game interface (art, gestures, hints, settings, sounds).
- `engine.js`: puzzle generator, uniqueness solver, logic-hint engine, difficulty grading, Sniff Out. Runs in a Web Worker.
- `sw.js`: service worker for offline play. **Bump `CACHE` whenever you change a file** so installed copies update.
- `toby/`: Toby artwork cut from `design/toby-character-sheet.png` (tile icon, expressions, action poses).
- `tools/cut_character_sheet.py`: re-cuts the artwork from the character sheet (`python3 tools/cut_character_sheet.py`, needs Pillow, NumPy, SciPy).
- `tests/engine.test.js`: `node tests/engine.test.js` checks puzzle uniqueness, hint soundness, difficulty rules and Sniff Out.
- `CLAUDE_HANDOFF.md`: product decisions and design notes for anyone (or any AI tool) picking this up.
