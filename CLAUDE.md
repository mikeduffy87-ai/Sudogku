# Sudogku — instructions for AI assistants

Read `CLAUDE_HANDOFF.md` first: it lists Mike's product decisions (tool limits, controls, mistakes, levels, difficulty mix, where each Toby image is used). Don't undo those decisions without Mike asking.

- Keep the puzzle engine (`engine.js`) and its tests passing: `node tests/engine.test.js`.
- Toby artwork comes only from Mike's designs in `design/` (`toby-character-sheet.png`, `home-screen.png`). Use the sheet's own assignments (tile icon for placed dogs, app icon, expressions, action poses). Don't invent or substitute other dog art.
- After changing any shipped file, bump `CACHE` in `sw.js` and add new files to its `FILES` list.
- The site is served from the repo root on GitHub Pages; keep paths relative.
- Test touch controls at phone sizes (390×844 and 375×667): tap = ✕, tap again = clear, double-tap = dog, drag = many ✕.
