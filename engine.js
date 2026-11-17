/* Sudogku engine: puzzle generation, uniqueness solver, logical hint engine and difficulty grading.
   Works as a browser global (SudogkuEngine), a Web Worker, or a Node module (for tests). */
(function (root) {
  'use strict';

  // ---------- helpers ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function hashSeed(...parts) {
    let h = 2166136261;
    const s = parts.join('|');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function nbrs4(n, i) {
    const y = Math.floor(i / n), x = i % n, o = [];
    if (y > 0) o.push(i - n); if (y < n - 1) o.push(i + n);
    if (x > 0) o.push(i - 1); if (x < n - 1) o.push(i + 1);
    return o;
  }

  // ---------- generation ----------
  function makeSol(n, r) {
    const s = [], used = new Array(n).fill(false);
    (function go(row) {
      if (row === n) return true;
      for (const c of shuffle([...Array(n).keys()], r)) {
        if (used[c] || (row > 0 && Math.abs(c - s[row - 1]) < 2)) continue;
        used[c] = true; s[row] = c;
        if (go(row + 1)) return true;
        used[c] = false;
      }
      return false;
    })(0);
    return s;
  }
  function makeRegions(n, sol, r) {
    const g = new Array(n * n).fill(-1);
    for (let i = 0; i < n; i++) g[i * n + sol[i]] = i;
    let left = n * n - n;
    while (left > 0) {
      const cand = [];
      for (let i = 0; i < n * n; i++) if (g[i] < 0 && nbrs4(n, i).some(j => g[j] >= 0)) cand.push(i);
      const i = cand[Math.floor(r() * cand.length)];
      const ns = nbrs4(n, i).filter(j => g[j] >= 0);
      g[i] = g[ns[Math.floor(r() * ns.length)]];
      left--;
    }
    return g;
  }
  // Counts solutions (up to limit). Returns one solution that differs from `sol`, if found.
  function solveCount(n, g, sol, limit) {
    limit = limit || 2;
    let cnt = 0, alt = null;
    const s = [], usedC = new Array(n).fill(false), usedR = new Array(n).fill(false);
    (function go(row) {
      if (row === n) { cnt++; if (!alt && (!sol || s.some((c, i) => c !== sol[i]))) alt = s.slice(); return; }
      for (let c = 0; c < n; c++) {
        if (usedC[c] || (row > 0 && Math.abs(c - s[row - 1]) < 2)) continue;
        const rg = g[row * n + c];
        if (usedR[rg]) continue;
        usedC[c] = usedR[rg] = true; s[row] = c;
        go(row + 1);
        usedC[c] = usedR[rg] = false;
        if (cnt >= limit) return;
      }
    })(0);
    return { count: cnt, alt };
  }
  function connectedWithout(n, g, reg, skip) {
    const cells = [];
    for (let i = 0; i < n * n; i++) if (g[i] === reg && i !== skip) cells.push(i);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), st = [cells[0]];
    while (st.length) {
      const c = st.pop();
      for (const j of nbrs4(n, c)) if (j !== skip && g[j] === reg && !seen.has(j)) { seen.add(j); st.push(j); }
    }
    return seen.size === cells.length;
  }
  function generateUnique(n, r) {
    for (let t = 0; t < 500; t++) {
      const sol = makeSol(n, r), g = makeRegions(n, sol, r);
      const dogCells = new Set(sol.map((c, i) => i * n + c));
      for (let k = 0; k < 600; k++) {
        const res = solveCount(n, g, sol, 2);
        if (res.count === 1) return { sol, regions: g };
        // Break the rival solution: move one of its cells into a neighbouring region.
        const opts = [];
        res.alt.forEach((c, i) => {
          const cell = i * n + c;
          if (dogCells.has(cell)) return;
          for (const j of nbrs4(n, cell)) if (g[j] !== g[cell] && connectedWithout(n, g, g[cell], cell)) opts.push([cell, g[j]]);
        });
        if (!opts.length) break;
        const [cell, to] = opts[Math.floor(r() * opts.length)];
        g[cell] = to;
      }
    }
    return null;
  }

  // ---------- colours ----------
  // 11 palette slots; pairs that look alike are kept apart where possible.
  const SIMILAR = [[0, 6], [0, 7], [0, 9], [1, 7], [1, 10], [2, 8], [2, 10], [3, 4], [4, 5], [5, 8], [6, 9], [1, 2]];
  function assignColours(n, regions, r) {
    const adj = new Set();
    for (let i = 0; i < n * n; i++) for (const j of nbrs4(n, i)) if (regions[i] !== regions[j]) {
      const a = Math.min(regions[i], regions[j]), b = Math.max(regions[i], regions[j]); adj.add(a * 100 + b);
    }
    const sim = new Set(SIMILAR.map(([a, b]) => a * 100 + b).concat(SIMILAR.map(([a, b]) => b * 100 + a)));
    let best = null, bestCost = 1e9;
    for (let t = 0; t < 400 && bestCost > 0; t++) {
      const perm = shuffle([...Array(11).keys()], r).slice(0, n);
      let cost = 0;
      for (const k of adj) { const a = perm[Math.floor(k / 100)], b = perm[k % 100]; if (sim.has(a * 100 + b)) cost++; }
      if (cost < bestCost) { bestCost = cost; best = perm; }
    }
    return best;
  }

  // ---------- geometry ----------
  function geometry(n, regions) {
    const rows = [], cols = [], regs = [];
    for (let k = 0; k < n; k++) { rows.push([]); cols.push([]); regs.push([]); }
    for (let i = 0; i < n * n; i++) { rows[Math.floor(i / n)].push(i); cols[i % n].push(i); regs[regions[i]].push(i); }
    const attack = [];
    for (let i = 0; i < n * n; i++) {
      const y = Math.floor(i / n), x = i % n, s = [];
      for (let j = 0; j < n * n; j++) {
        if (j === i) continue;
        const yy = Math.floor(j / n), xx = j % n;
        if (yy === y || xx === x || regions[j] === regions[i] || (Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1)) s.push(j);
      }
      attack.push(s);
    }
    const unitOf = { R: i => regions[i], r: i => Math.floor(i / n), c: i => i % n };
    return { n, regions, rows, cols, regs, attack, units: { R: regs, r: rows, c: cols }, unitOf };
  }

  // ---------- logical hint engine ----------
  // marks: 0 empty, 1 cross, 2 dog.  Returns a hint or null.
  // Hint: {tier, kind, action:'x'|'dog'|'clear', targets:[cells], premise:[cells], text}
  // Text tokens: {R:i} colour name, {r:i} "row i+1", {c:i} "column i+1", list forms {RL:..} {rL:..} {cL:..}
  function analyse(G, marks) {
    const n = G.n, N = n * n;
    const hasDog = { R: new Array(n).fill(false), r: new Array(n).fill(false), c: new Array(n).fill(false) };
    const dogs = [];
    for (let i = 0; i < N; i++) if (marks[i] === 2) {
      dogs.push(i);
      hasDog.R[G.regions[i]] = true; hasDog.r[Math.floor(i / n)] = true; hasDog.c[i % n] = true;
    }
    return { dogs, hasDog };
  }

  const TYPE_WORD = { R: 'colour', r: 'row', c: 'column' };
  const TYPE_PLURAL = { R: 'colours', r: 'rows', c: 'columns' };

  function logicHint(G, marks, maxTier) {
    maxTier = maxTier || 5;
    const n = G.n, N = n * n;
    const { dogs, hasDog } = analyse(G, marks);

    // Tier 1a: a placed dog rules out its row, column, colour and neighbours.
    for (const d of dogs) {
      const t = G.attack[d].filter(j => marks[j] === 0);
      if (t.length) return {
        tier: 1, kind: 'claim', action: 'x', targets: t, premise: [d],
        text: 'This dog has its row, column and {R:' + G.regions[d] + '} all to itself, and no other dog may touch it. Cross out the squares it rules out.'
      };
    }
    const cand = i => marks[i] === 0;
    const unitCands = (type, k) => G.units[type][k].filter(cand);

    // Tier 1b: only one free square left in a colour, row or column.
    for (const type of ['R', 'r', 'c']) for (let k = 0; k < n; k++) {
      if (hasDog[type][k]) continue;
      const cs = unitCands(type, k);
      if (cs.length === 0) return { tier: 0, kind: 'stuck', action: 'none', targets: [], premise: G.units[type][k].slice(), text: '{' + type + ':' + k + '} has no free squares left, so something has gone wrong.' };
      if (cs.length === 1) return {
        tier: 1, kind: 'single', action: 'dog', targets: cs, premise: G.units[type][k].slice(),
        text: '{' + type + ':' + k + '} has only one free square left, so its dog goes there.'
      };
    }
    if (maxTier < 2) return null;

    // Tier 2 (k=1) and tier 4 (k=2..4): locked sets.
    const lockPairs = [['R', 'r'], ['R', 'c'], ['r', 'R'], ['c', 'R']];
    function locked(k) {
      for (const [A, B] of lockPairs) {
        const avail = [];
        for (let a = 0; a < n; a++) if (!hasDog[A][a]) {
          const cs = unitCands(A, a);
          if (cs.length) avail.push({ a, cs, bs: [...new Set(cs.map(G.unitOf[B]))] });
        }
        const chosen = [];
        let found = null;
        (function rec(start, bset) {
          if (found) return;
          if (chosen.length === k) {
            if (bset.size !== k) return;
            const inA = new Set();
            for (const u of chosen) for (const c of G.units[A][u.a]) inA.add(c);
            const targets = [];
            for (const b of bset) for (const c of G.units[B][b]) if (cand(c) && !inA.has(c)) targets.push(c);
            if (targets.length) {
              const premise = [];
              for (const u of chosen) premise.push(...u.cs);
              found = { A, B, as: chosen.map(u => u.a), bs: [...bset].sort((x, y) => x - y), targets, premise };
            }
            return;
          }
          for (let i = start; i < avail.length; i++) {
            const nb = new Set(bset); for (const b of avail[i].bs) nb.add(b);
            if (nb.size > k) continue;
            chosen.push(avail[i]); rec(i + 1, nb); chosen.pop();
            if (found) return;
          }
        })(0, new Set());
        if (found) return found;
      }
      return null;
    }
    function lockText(f, k) {
      const a = f.A, b = f.B;
      if (k === 1) {
        const A = '{' + a + ':' + f.as[0] + '}', B = '{' + b + ':' + f.bs[0] + '}';
        if (a === 'R') return 'Every free square of ' + A + ' is in ' + B + ', so the dog for ' + B + ' must be the ' + A + ' dog. Cross out the rest of ' + B + '.';
        return 'Every free square in ' + A + ' is ' + B + ', so the ' + B + ' dog lives in ' + A + '. Cross out the other ' + B + ' squares.';
      }
      const AL = '{' + a + 'L:' + f.as.join(',') + '}', BL = '{' + b + 'L:' + f.bs.join(',') + '}';
      if (a === 'R') return k + ' colours share ' + k + ' ' + TYPE_PLURAL[b] + ': ' + AL + ' only have free squares in ' + BL + '. Those ' + TYPE_PLURAL[b] + ' must hold these colours’ dogs, so cross out everything else in them.';
      return k + ' ' + TYPE_PLURAL[a] + ' share ' + k + ' colours: ' + AL + ' only have free squares in ' + BL + '. Those colours’ dogs must all be in these ' + TYPE_PLURAL[a] + ', so cross out the rest of those colours.';
    }
    let f = locked(1);
    if (f) return { tier: 2, kind: 'lock1', action: 'x', targets: f.targets, premise: f.premise, text: lockText(f, 1) };
    if (maxTier < 3) return null;

    // Tier 3: a dog here would leave some colour/row/column with nowhere to go.
    {
      let best = null;
      const done = new Set();
      const inAtk = new Uint8Array(N);
      for (let c = 0; c < N; c++) {
        if (!cand(c)) continue;
        inAtk.fill(0); for (const j of G.attack[c]) inAtk[j] = 1;
        for (const type of ['R', 'r', 'c']) for (let k = 0; k < n; k++) {
          if (hasDog[type][k] || G.unitOf[type](c) === k) continue;
          const cs = unitCands(type, k);
          if (cs.every(j => inAtk[j])) {
            const key = type + k;
            if (!done.has(key)) {
              done.add(key);
              // collect all starving cells for this unit
              const t = [];
              for (let c2 = 0; c2 < N; c2++) {
                if (!cand(c2) || G.unitOf[type](c2) === k) continue;
                const s2 = new Set(G.attack[c2]);
                if (cs.every(j => s2.has(j))) t.push(c2);
              }
              if (!best || t.length > best.targets.length) best = { key, type, k, targets: t, premise: cs };
            }
          }
        }
      }
      if (best) return {
        tier: 3, kind: 'starve', action: 'x', targets: best.targets, premise: best.premise,
        text: (best.targets.length > 1 ? 'A dog on any highlighted square' : 'A dog on the highlighted square') + ' would rule out every free square of {' + best.type + ':' + best.k + '}, leaving it nowhere to go. Cross ' + (best.targets.length > 1 ? 'them' : 'it') + ' out.'
      };
    }
    if (maxTier < 4) return null;

    for (let k = 2; k <= 4; k++) {
      f = locked(k);
      if (f) return { tier: 4, kind: 'lock' + k, action: 'x', targets: f.targets, premise: f.premise, text: lockText(f, k) };
    }
    if (maxTier < 5) return null;

    // Tier 5: try a dog, follow forced moves, find a contradiction.
    for (let c = 0; c < N; c++) {
      if (!cand(c)) continue;
      const m = marks.slice(); m[c] = 2;
      const res = propagate(G, m, 4);
      if (res.contradiction) return {
        tier: 5, kind: 'chain', action: 'x', targets: [c], premise: res.unit ? G.units[res.unit.type][res.unit.k].slice() : [],
        text: 'Imagine a dog here: following the forced moves, ' + (res.unit ? '{' + res.unit.type + ':' + res.unit.k + '}' : 'the board') + ' soon has nowhere left for its dog. So this square can’t have one.'
      };
    }
    return null;
  }

  function applyHint(marks, h) {
    const v = h.action === 'x' ? 1 : h.action === 'dog' ? 2 : 0;
    for (const t of h.targets) marks[t] = v;
  }

  // Apply logic up to maxTier until solved, stuck or contradiction.
  function propagate(G, marks, maxTier) {
    for (let step = 0; step < 500; step++) {
      // contradiction checks: dogs clashing, or units with no dog and no candidates
      const n = G.n;
      const { dogs, hasDog } = analyse(G, marks);
      for (const d of dogs) for (const j of G.attack[d]) if (marks[j] === 2) return { contradiction: true, unit: null };
      for (const type of ['R', 'r', 'c']) for (let k = 0; k < n; k++)
        if (!hasDog[type][k] && !G.units[type][k].some(i => marks[i] === 0)) return { contradiction: true, unit: { type, k } };
      if (dogs.length === n) return { solved: true };
      const h = logicHint(G, marks, maxTier);
      if (!h) return { stuck: true };
      if (h.kind === 'stuck') return { contradiction: true, unit: null };
      applyHint(marks, h);
    }
    return { stuck: true };
  }

  // Hardest tier needed to solve from empty with simplest-first logic. 99 = not solvable by the engine.
  function grade(n, regions, starters) {
    const G = geometry(n, regions);
    const marks = new Array(n * n).fill(0);
    (starters || []).forEach(i => { marks[i] = 2; });
    let maxT = 0;
    for (let step = 0; step < 2000; step++) {
      if (marks.filter(v => v === 2).length === n) return maxT;
      const h = logicHint(G, marks, 5);
      if (!h || h.kind === 'stuck') return 99;
      maxT = Math.max(maxT, h.tier);
      applyHint(marks, h);
    }
    return 99;
  }

  // Full hint for the player: first spots mistakes (using the known solution), then pure logic.
  function playerHint(n, regions, sol, marks) {
    const G = geometry(n, regions);
    const isSol = i => sol[Math.floor(i / n)] === i % n;
    const wrongDogs = [], wrongX = [];
    for (let i = 0; i < n * n; i++) {
      if (marks[i] === 2 && !isSol(i)) wrongDogs.push(i);
      if (marks[i] === 1 && isSol(i)) wrongX.push(i);
    }
    if (wrongDogs.length) return { tier: 0, kind: 'mistake', action: 'clear', targets: wrongDogs, premise: [], text: (wrongDogs.length > 1 ? 'These dogs aren’t' : 'This dog isn’t') + ' in the right spot, so no logic can work around ' + (wrongDogs.length > 1 ? 'them' : 'it') + '. Apply takes ' + (wrongDogs.length > 1 ? 'them' : 'it') + ' off.' };
    if (wrongX.length) return { tier: 0, kind: 'mistake', action: 'clear', targets: wrongX, premise: [], text: (wrongX.length > 1 ? 'These ✕ marks are' : 'This ✕ is') + ' covering a square where a dog actually belongs. Apply clears ' + (wrongX.length > 1 ? 'them' : 'it') + '.' };
    return logicHint(G, marks, 5);
  }

  // ---------- Sniff Out ----------
  // Picks up to k empty squares that can't hold a dog. Prefers squares the player can't already
  // rule out from placed dogs, spread over different colours and rows. Never picks a solution square.
  function sniffCells(n, regions, sol, marks, k, seed) {
    k = k || 3;
    const G = geometry(n, regions), r = rng(seed >>> 0);
    const isSol = i => sol[Math.floor(i / n)] === i % n;
    const ruledOut = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) if (marks[i] === 2) for (const j of G.attack[i]) ruledOut[j] = 1;
    const pool = [];
    for (let i = 0; i < n * n; i++) if (marks[i] === 0 && !isSol(i)) pool.push(i);
    const fresh = shuffle(pool.filter(i => !ruledOut[i]), r), obvious = shuffle(pool.filter(i => ruledOut[i]), r);
    const chosen = [], usedReg = new Set(), usedRow = new Set();
    const take = (list, needNewReg, needNewRow) => {
      for (const i of list) {
        if (chosen.length >= k) return;
        if (chosen.includes(i)) continue;
        if (needNewReg && usedReg.has(regions[i])) continue;
        if (needNewRow && usedRow.has(Math.floor(i / n))) continue;
        chosen.push(i); usedReg.add(regions[i]); usedRow.add(Math.floor(i / n));
      }
    };
    take(fresh, true, true); take(fresh, true, false); take(fresh, false, false);
    take(obvious, false, false);
    return chosen;
  }

  // ---------- levels ----------
  // One long level track like the original: boards and logic grow as you go.
  // Weighted, deterministic tier selection. Tier 1 Easy, 2 Medium, 3 Hard,
  // 4 Expert, 5 Master. No tier 1 is requested from level 6 onwards.
  // Difficulty mix per level range (tier: 1 Easy, 2 Medium, 3 Hard, 4 Expert, 5 Master).
  // Tiers are dealt out in exact proportions within each range (open-ended range in blocks of 20),
  // in a fixed shuffled order, so the same level is always the same puzzle and the mix is exact.
  const BANDS = [
    [1, 2, [[1, 100]]],
    [3, 5, [[1, 40], [2, 60]]],
    [6, 15, [[2, 75], [3, 25]]],
    [16, 30, [[2, 45], [3, 45], [4, 10]]],
    [31, 50, [[2, 20], [3, 50], [4, 30]]],
    [51, Infinity, [[2, 10], [3, 30], [4, 50], [5, 10]]]
  ];
  function quota(len, weights) { // largest-remainder rounding
    const raw = weights.map(([t, w]) => [t, w * len / 100]);
    const out = raw.map(([t, x]) => [t, Math.floor(x), x - Math.floor(x)]);
    let left = len - out.reduce((a, o) => a + o[1], 0);
    out.slice().sort((x, y) => y[2] - x[2]).forEach(o => { if (left > 0) { o[1]++; left--; } });
    const list = [];
    out.forEach(([t, c]) => { for (let k = 0; k < c; k++) list.push(t); });
    return list;
  }
  function tierForLevel(level) {
    const [a, b, weights] = BANDS.find(([a, b]) => level >= a && level <= b);
    let start = a, len = b - a + 1;
    if (b === Infinity) { start = a + Math.floor((level - a) / 20) * 20; len = 20; }
    const list = shuffle(quota(len, weights), rng(hashSeed('tiers-v3', start)));
    return list[level - start];
  }
  function levelSpec(level) {
    const tier = tierForLevel(level);
    const sizes = level <= 5 ? [5] : level <= 15 ? [6] : level <= 30 ? [6, 7] :
      level <= 50 ? [7, 8] : level <= 100 ? [8, 9] : level <= 150 ? [9, 10] : [10, 11];
    const n = sizes[Math.floor(rng(hashSeed('size-v3', level))() * sizes.length)];
    return { n, minTier: tier, maxTier: tier, targetTier: tier };
  }
  function dailySpec() { return { n: 8, minTier: 3, maxTier: 3, targetTier: 3 }; }

  // kind: 'level' (key = level number) or 'daily' (key = yyyymmdd)
  // Strict generation: search until the puzzle's grade equals the requested tier.
  // Every candidate puzzle is tried with each possible starter dog (the starter changes the grade).
  // Budgets are per board size; if a size can't deliver the tier, the next better-suited size is tried.
  const TRY_BUDGET = { 5: 4000, 6: 4000, 7: 3000, 8: 2000, 9: 500, 10: 80, 11: 30 };
  // Sizes that tend to produce each tier (used when the level's own sizes can't).
  const TIER_SIZES = { 1: [5, 6, 7], 2: [6, 7, 8, 10], 3: [7, 8, 9, 10], 4: [8, 9, 11, 10, 7], 5: [9, 8, 10, 11] };
  function searchSize(n, tier, r, budget, near) {
    for (let t = 0; t < budget; t++) {
      const p = generateUnique(n, r);
      if (!p) continue;
      const rows = shuffle([...Array(n).keys()], r);
      for (const sr of rows) {
        const starter = sr * n + p.sol[sr];
        const g = grade(n, p.regions, [starter]);
        if (g === tier) return { n, sol: p.sol, regions: p.regions, tier: g, starters: [starter], tries: t + 1 };
        if (near && g < 99 && g >= near.minOk && (!near.best || Math.abs(g - tier) < Math.abs(near.best.tier - tier)))
          near.best = { n, sol: p.sol, regions: p.regions, tier: g, starters: [starter] };
      }
    }
    return null;
  }
  function generateLevel(kind, key) {
    const spec = kind === 'daily' ? dailySpec() : levelSpec(key);
    const tier = spec.targetTier || spec.minTier;
    const minOk = kind === 'level' && key >= 6 ? 2 : 1; // hard rule: never Easy from level 6
    const r = rng(hashSeed('sudogku', kind, key));
    const sizes = [spec.n].concat(TIER_SIZES[tier].filter(s => s !== spec.n));
    const near = { minOk, best: null };
    let best = null, fallback = null;
    for (const n of sizes) {
      best = searchSize(n, tier, r, TRY_BUDGET[n], near);
      if (best) { if (n !== spec.n) fallback = 'size'; break; }
    }
    if (!best && near.best) { best = near.best; fallback = 'nearest-tier'; }
    while (!best) { // practically unreachable: keep going until the hard rule is satisfied
      const n = spec.n, p = generateUnique(n, r), sr = Math.floor(r() * n), st = sr * n + p.sol[sr], g = grade(n, p.regions, [st]);
      if (g >= minOk && g < 99) { best = { n, sol: p.sol, regions: p.regions, tier: g, starters: [st] }; fallback = 'any-allowed'; }
    }
    best.colours = assignColours(best.n, best.regions, r);
    best.kind = kind; best.key = key;
    best.requestedTier = tier;
    best.difficultyMatched = best.tier === tier;
    best.fallback = fallback;
    return best;
  }

  const API = { sniffCells, tierForLevel, rng, hashSeed, generateUnique, solveCount, geometry, logicHint, playerHint, applyHint, grade, generateLevel, levelSpec, dailySpec, assignColours };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.SudogkuEngine = API;

  // Web Worker mode
  if (typeof window === 'undefined' && typeof importScripts === 'function') {
    self.onmessage = function (e) {
      const { id, cmd, args } = e.data;
      try { self.postMessage({ id, res: API[cmd].apply(null, args) }); }
      catch (err) { self.postMessage({ id, error: String(err) }); }
    };
  }
})(typeof self !== 'undefined' ? self : this);
