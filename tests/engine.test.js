// Run: node tests/engine.test.js
const E = require('../engine.js');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.error('FAIL', msg); } };
const isSol = (n, sol, i) => sol[Math.floor(i / n)] === i % n;

// 1. Uniqueness + rule validity of generated solutions
for (const n of [5, 6, 7, 8, 9, 10, 11]) {
  const r = E.rng(n * 77);
  for (let k = 0; k < (n >= 10 ? 4 : 12); k++) {
    const p = E.generateUnique(n, r);
    ok(E.solveCount(n, p.regions, null, 2).count === 1, `unique ${n}`);
    ok(new Set(p.sol).size === n, `one per column ${n}`);
    ok(p.sol.every((c, i) => i === 0 || Math.abs(c - p.sol[i - 1]) > 1), `no touching ${n}`);
    const regs = new Set(p.sol.map((c, i) => p.regions[i * n + c]));
    ok(regs.size === n, `one per region ${n}`);
  }
}

// 2. Hint soundness: from empty, and from random correct partial boards with injected mistakes
function checkHint(n, p, marks, label) {
  const h = E.playerHint(n, p.regions, p.sol, marks);
  if (!h) { ok(false, `no hint found ${label}`); return null; }
  ok(h.kind !== 'stuck', `stuck ${label}`);
  ok(h.targets.length > 0, `empty targets ${label}`);
  ok(!/undefined|NaN/.test(h.text), `bad text ${label}: ${h.text}`);
  for (const t of h.targets) {
    if (h.action === 'x') ok(!isSol(n, p.sol, t) && marks[t] === 0, `bad cross ${label} ${h.kind}`);
    if (h.action === 'dog') ok(isSol(n, p.sol, t), `bad dog ${label} ${h.kind}`);
    if (h.action === 'clear') ok((marks[t] === 2 && !isSol(n, p.sol, t)) || (marks[t] === 1 && isSol(n, p.sol, t)), `bad clear ${label}`);
  }
  return h;
}
const kinds = {};
for (const n of [5, 6, 7, 8, 9, 10, 11]) {
  const r = E.rng(n * 991);
  for (let k = 0; k < (n >= 10 ? 3 : 10); k++) {
    const p = E.generateUnique(n, r);
    // full solve by hints from empty; Apply must change exactly the target cells
    let marks = new Array(n * n).fill(0), steps = 0;
    while (marks.filter(v => v === 2).length < n && steps++ < 3000) {
      const h = checkHint(n, p, marks, `solve n=${n}`); if (!h) break;
      kinds[h.kind] = (kinds[h.kind] || 0) + 1;
      const before = marks.slice(); E.applyHint(marks, h);
      const changed = before.map((v, i) => v !== marks[i] ? i : -1).filter(i => i >= 0);
      ok(changed.length === h.targets.length && changed.every(i => h.targets.includes(i)), 'apply changes exactly targets');
    }
    ok(p.sol.every((c, i) => marks[i * n + c] === 2), `solved by hints n=${n}`);
    // random partial states with mistakes
    for (let t = 0; t < 6; t++) {
      const m = new Array(n * n).fill(0);
      for (let i = 0; i < n * n; i++) {
        const x = r();
        if (isSol(n, p.sol, i)) m[i] = x < 0.3 ? 2 : (t % 3 === 0 && x > 0.95 ? 1 : 0);
        else m[i] = x < 0.35 ? 1 : (t % 2 === 0 && x > 0.98 ? 2 : 0);
      }
      checkHint(n, p, m, `partial n=${n}`);
    }
  }
}

// 3. Level generation: deterministic, starter dog is a solution cell, difficulty band respected
for (const [kind, key] of [['level', 1], ['level', 15], ['level', 40], ['level', 80], ['level', 120], ['level', 185], ['daily', 20261117]]) {
  const a = E.generateLevel(kind, key), b = E.generateLevel(kind, key);
  ok(JSON.stringify(a.regions) === JSON.stringify(b.regions), `deterministic ${kind} ${key}`);
  ok(a.starters.every(i => a.sol[Math.floor(i / a.n)] === i % a.n), `starter is correct ${kind} ${key}`);
  ok(new Set(a.colours).size === a.n, `distinct colours ${kind} ${key}`);
  const spec = kind === 'daily' ? E.dailySpec() : E.levelSpec(key);
  console.log(`  ${kind} ${key}: ${a.n}x${a.n}, tier ${a.tier} (want ${spec.minTier}-${spec.maxTier})`);
}

// 4. Sniff Out: never a dog square, only empty squares, at most 3, prefers squares not already ruled out
{
  const r = E.rng(5150);
  for (const n of [5, 6, 7, 8, 9, 10]) for (let k = 0; k < 15; k++) {
    const p = E.generateUnique(n, r), G = E.geometry(n, p.regions);
    const m = new Array(n * n).fill(0);
    for (let i = 0; i < n * n; i++) { const x = r(); if (isSol(n, p.sol, i)) m[i] = x < 0.3 ? 2 : 0; else m[i] = x < 0.3 ? 1 : 0; }
    const picks = E.sniffCells(n, p.regions, p.sol, m, 3, k + n * 100);
    ok(picks.length <= 3 && new Set(picks).size === picks.length, `sniff count n=${n}`);
    ok(picks.every(i => m[i] === 0 && !isSol(n, p.sol, i)), `sniff safe n=${n}`);
    const ruled = new Set(); m.forEach((v, i) => { if (v === 2) G.attack[i].forEach(j => ruled.add(j)); });
    const freshAvail = m.filter((v, i) => v === 0 && !isSol(n, p.sol, i) && !ruled.has(i)).length;
    const freshPicked = picks.filter(i => !ruled.has(i)).length;
    ok(freshPicked === Math.min(3, freshAvail), `sniff prefers fresh squares n=${n}`);
    const avail = m.filter((v, i) => v === 0 && !isSol(n, p.sol, i)).length;
    ok(picks.length === Math.min(3, avail), `sniff fills up to 3 n=${n}`);
  }
  // nothing left to sniff
  const p = E.generateUnique(5, r), m = new Array(25).fill(1); p.sol.forEach((c, y) => { m[y * 5 + c] = 0; });
  ok(E.sniffCells(5, p.regions, p.sol, m, 3, 1).length === 0, 'sniff empty when nothing left');
}

// 5. Difficulty mix: exact quotas per range and never Easy from level 6
{
  let easy = 0; for (let L = 6; L <= 600; L++) if (E.tierForLevel(L) === 1) easy++;
  ok(easy === 0, 'no Easy from level 6');
  const count = (a, b) => { const c = {}; for (let L = a; L <= b; L++) { const t = E.tierForLevel(L); c[t] = (c[t] || 0) + 1; } return c; };
  const c1 = count(6, 15); ok(c1[2] === 8 && c1[3] === 2, 'levels 6-15 mix');
  const c2 = count(31, 50); ok(c2[2] === 4 && c2[3] === 10 && c2[4] === 6, 'levels 31-50 mix');
  const c3 = count(51, 70); ok(c3[2] === 2 && c3[3] === 6 && c3[4] === 10 && c3[5] === 2, 'levels 51-70 mix');
  for (const L of [6, 9, 12, 33, 58]) { const p = E.generateLevel('level', L); ok(p.tier === p.requestedTier && p.tier >= 2, `strict tier L${L}`); }
}

console.log('hint kinds used:', JSON.stringify(kinds));
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
