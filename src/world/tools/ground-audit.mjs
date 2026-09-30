// Grounding audit: loads every room of the round (headless: no GPU, no browser) and reports
// anything whose base is not on the terrain surface.
//
//   node src/world/tools/ground-audit.mjs [--room A1,B2] [--tol 1] [--raw] [--json out.json] [--verbose]
//
// It runs through vite's SSR loader so the rooms, the pixel-matter recipes and the stub recipes
// are the real ones, and it builds every placement the way Room.build() does (the shared settle()
// pass from src/world/room/ground.ts, then the pixel world with the room's ground for cover).
// `--raw` skips settle() to show the placements as authored. For every placement it finds the
// surface under it:
//   float    base above the nearest surface (gap px)
//   sunk     base inside a solid below its top (px)
//   void     nothing to stand on under it at all
//   edge     a wide rigid prop hangs past the end of its surface or straddles a step
//   blade    grass / reeds: blades whose base is not on the ground under THEIR x (slopes handled:
//            each blade is tested against the terrain top at its own x); blades the room grew no
//            blade for (over a drop, inside a wall) are counted as trimmed, not as errors
// Support = a solid top, a one-way top, or (for rigid props) a collider of another prop (a deck,
// a crate, a stair). Recipes that hang, mount on walls, float, span or ARE the surface are exempt
// (ANCHORS in ground.ts lists them with the reason), as are invisible stub props.
// Exit code 1 when anything is reported.
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

globalThis.window ??= globalThis;
globalThis.addEventListener ??= () => {};
globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, getElementById: () => null };

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : (args[i + 1] ?? true);
};
const TOL = Number(opt("tol", 1));
const only = opt("room", "") ? String(opt("room")).split(",") : null;
const verbose = args.includes("--verbose");
const raw = args.includes("--raw");

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
});

const T = { rooms: 0, props: 0, checked: 0, exempt: 0, moved: 0, float: 0, lifted: 0, sunk: 0, void: 0, edge: 0, blade: 0, bladesTotal: 0, trimmed: 0, buildErrors: 0 };
const report = { tol: TOL, raw, rooms: {}, totals: T, exempt: {} };

try {
  const { discoverRooms } = await server.ssrLoadModule("/src/world/rooms/registry.ts");
  const { PixelRoom, resolveRecipe } = await server.ssrLoadModule("/src/world/pixel/adapter.ts");
  const { StubEngine } = await server.ssrLoadModule("/src/world/props/stub.ts");
  const { registerStubRecipes } = await server.ssrLoadModule("/src/world/props/recipes.ts");
  const { registerKit } = await server.ssrLoadModule("/src/world/props/kit.ts");
  const { SCALE } = await server.ssrLoadModule("/src/world/config.ts");
  const G = await server.ssrLoadModule("/src/world/room/ground.ts");
  const H = SCALE.H;

  const engine = new StubEngine((t) => ({ w: t.w, h: t.h, handle: { albedo: {}, normal: {}, keyInfluence: 0.6 } }));
  registerStubRecipes(engine);
  registerKit(engine);
  const set = discoverRooms();
  for (const r of set.recipes) engine.register(r);

  for (const [id, def] of [...set.rooms].sort(([a], [b]) => a.localeCompare(b))) {
    if (only && !only.includes(id)) continue;
    const room = { id, issues: [], props: 0, checked: 0, exempt: 0, moved: [], bladesTotal: 0, trimmed: 0 };
    const solids = def.terrain.filter((t) => !t.oneWay);
    const ones = def.terrain.filter((t) => t.oneWay);
    const ground = (x, y) => solids.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) || ones.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + 2);
    const stand = G.plantStand(def);
    const pr = new PixelRoom(def.w, def.h, H, {}, ground, { gate: () => true, reduced: () => false }, stand);
    const settled = raw ? { props: def.props, moved: [] } : G.settle({ terrain: def.terrain, props: def.props, w: def.w, waterline: def.waterline, water: def.water });
    room.moved = settled.moved;
    T.moved += settled.moved.length;
    const live = [];
    for (const pl of settled.props) {
      const how = resolveRecipe(pl.recipe, pl.engine, (n) => engine.has(n));
      if (!how) { room.issues.push({ id: pl.id, recipe: pl.recipe, kind: "missing-recipe" }); continue; }
      try {
        if (how.engine === "pixel") {
          live.push({ pl, engine: "pixel", prop: pr.add(how.recipe, pl.id, pl.x, pl.y, { seed: 1, ...(pl.params ?? {}) }, !!pl.flip) });
        } else {
          live.push({ pl, engine: "stub", prop: engine.create(pl.recipe, { id: pl.id, x: pl.x, y: pl.y, H, seed: 1, cut: false, ...(pl.params ?? {}) }) });
        }
      } catch (e) {
        T.buildErrors++;
        room.issues.push({ id: pl.id, recipe: pl.recipe, kind: "build-error", msg: String(e.message ?? e).slice(0, 100), x: pl.x, y: pl.y });
      }
    }
    room.props = live.length;
    T.props += live.length;

    const terrain = G.terrainTops(def);
    const water = G.waterTops(def);
    /** Terrain plus what other props offer to stand on (decks, stairs, crates, benches). */
    const topsWithProps = (except) => {
      const out = [...terrain];
      for (const l of live) {
        if (l.pl.id === except) continue;
        if (l.engine === "pixel") {
          for (const c of l.prop.parts) {
            if (c.collide === "none" || !c.visible) continue;
            const b = c.grid.bounds();
            if (!b) continue;
            const a = c.toWorld(b.x0, b.y0), d = c.toWorld(b.x1 + 1, b.y1 + 1);
            out.push({ x0: Math.min(a[0], d[0]), x1: Math.max(a[0], d[0]), y: Math.min(a[1], d[1]), inside: Math.abs(d[1] - a[1]), src: `prop:${l.pl.id}` });
          }
        } else if (l.prop.collision !== "none" && l.prop.collision !== "trigger") {
          for (const b of l.prop.solids()) out.push({ x0: b.x, x1: b.x + b.w, y: b.y, inside: Math.max(2, b.h), src: `prop:${l.pl.id}` });
        }
      }
      return out;
    };

    for (const l of live) {
      const { pl, prop } = l;
      const key = G.normRecipe(pl.recipe);
      const anchor = G.anchorOf(pl.recipe);
      const invisible = l.engine === "stub" && prop.layers.length === 0;
      if (anchor && anchor.kind === "water" && water.length) {
        // stands in the lake: its base is on the water's surface
        room.checked++;
        T.checked++;
        const w = G.offsetAt(water, pl.x, pl.y);
        if (!w || Math.abs(w.d) > TOL) {
          room.issues.push({ id: pl.id, recipe: pl.recipe, x: pl.x, y: pl.y, kind: w && w.d > 0 ? "float" : "sunk", gap: w ? +w.d.toFixed(1) : null, depth: w ? +(-w.d).toFixed(1) : null, on: "water" });
          T[w && w.d > 0 ? "float" : "sunk"]++;
        }
        continue;
      }
      if (anchor || invisible) {
        room.exempt++;
        T.exempt++;
        report.exempt[pl.recipe] = anchor ? `${anchor.kind}: ${anchor.why}` : "invisible controller";
        continue;
      }
      room.checked++;
      T.checked++;
      const rec = { id: pl.id, recipe: pl.recipe, x: pl.x, y: pl.y };
      const cover = l.engine === "pixel" ? (prop.refs?.blades ?? prop.refs?.stems) : null;
      if (G.COVER.has(key) && cover) {
        // blade by blade against the terrain (and water surface) under each blade's own x
        const planned = Math.max(3, Math.round((prop.params.width * H / 10) * (prop.params.density ?? 6)));
        let bad = 0, worst = 0;
        const blades = cover;
        for (const b of blades) {
          const wx = pl.x + (pl.flip ? -1 : 1) * (b.x + 0.5);
          const baseY = pl.y - (b.gy ?? 0);
          // the ground under this blade: terrain top or the water surface, within tolerance of its base
          const by = Math.round(baseY);
          let ok = false;
          for (let yy = by - TOL; yy <= by + TOL; yy++) if (stand(wx, yy) && !stand(wx, yy - 1)) ok = true;
          if (!ok) {
            bad++;
            let d = 99;
            for (let k = 1; k <= 2 * H; k++) if ((stand(wx, by + k) && !stand(wx, by + k - 1)) || (stand(wx, by - k) && !stand(wx, by - k - 1))) { d = k; break; }
            worst = Math.max(worst, d);
          }
        }
        room.bladesTotal += blades.length;
        T.bladesTotal += blades.length;
        const trimmed = Math.max(0, planned - blades.length);
        room.trimmed += trimmed;
        T.trimmed += trimmed;
        if (blades.length === 0) {
          rec.kind = "void";
          room.issues.push(rec);
          T.void++;
        } else if (bad) {
          rec.kind = "blade";
          rec.bad = bad;
          rec.of = blades.length;
          rec.worst = worst;
          room.issues.push(rec);
          T.blade += bad;
        }
        continue;
      }
      const tops = topsWithProps(pl.id);
      const base = G.offsetAt(tops, pl.x, pl.y);
      // footprint of what is drawn
      let x0 = Infinity, x1 = -Infinity, low = -Infinity;
      if (l.engine === "pixel") {
        for (const c of prop.parts) {
          if (c.worldSpace && (c.dynamic || c.name.startsWith("chunk"))) continue;
          const b = c.grid.bounds();
          if (!b) continue;
          const a = c.toWorld(b.x0, b.y0), d = c.toWorld(b.x1 + 1, b.y1 + 1);
          x0 = Math.min(x0, a[0], d[0]);
          x1 = Math.max(x1, a[0], d[0]);
          if (!c.dynamic && c.visible) low = Math.max(low, a[1], d[1]);
        }
      } else {
        const b = prop.bounds();
        x0 = b.x;
        x1 = b.x + b.w;
      }
      rec.low = isFinite(low) ? +(low - pl.y).toFixed(1) : null;
      if (rec.low !== null) (room.lows ??= []).push({ id: pl.id, recipe: pl.recipe, low: rec.low });
      if (!isFinite(x0)) { x0 = pl.x; x1 = pl.x; }
      // what hangs past the room's own edge is not seen
      x0 = Math.max(0, x0);
      x1 = Math.min(def.w, x1);
      rec.w = Math.round(x1 - x0);
      if (base === null) { rec.kind = "void"; room.issues.push(rec); T.void++; continue; }
      // the drawing itself must reach its base: art that stops short of the anchor floats whatever the anchor says
      if (rec.low !== null && rec.low < -3 && !G.COVER.has(key)) { rec.kind = "lifted"; rec.gap = -rec.low; rec.on = "own art"; room.issues.push(rec); T.lifted++; continue; }
      if (base.d > TOL) { rec.kind = "float"; rec.gap = +base.d.toFixed(1); rec.on = base.src; room.issues.push(rec); T.float++; continue; }
      if (-base.d > TOL) { rec.kind = "sunk"; rec.depth = +(-base.d).toFixed(1); rec.on = base.src; room.issues.push(rec); T.sunk++; continue; }
      if (x1 - x0 > H * 0.9) {
        // a wide rigid prop: both ends need a surface at about the same height
        const eL = G.offsetAt(tops, x0 + 2, pl.y), eR = G.offsetAt(tops, x1 - 2, pl.y);
        const miss = (e) => e === null || Math.abs(e.d) > H * 0.12;
        if (miss(eL) || miss(eR)) {
          rec.kind = "edge";
          rec.left = eL ? +eL.d.toFixed(1) : null;
          rec.right = eR ? +eR.d.toFixed(1) : null;
          room.issues.push(rec);
          T.edge++;
        }
      }
    }
    report.rooms[id] = room;
    T.rooms++;
  }
} finally {
  await server.close();
}

const lines = [];
for (const [id, r] of Object.entries(report.rooms)) {
  lines.push(`${id.padEnd(8)} props ${String(r.props).padStart(3)}  checked ${String(r.checked).padStart(3)}  exempt ${String(r.exempt).padStart(2)}  snapped ${r.moved.length}  trimmed blades ${r.trimmed}  issues ${r.issues.length}`);
  if (verbose) for (const m of r.moved) lines.push(`    snapped ${String(m.recipe).padEnd(16)} ${String(m.id).padEnd(24)} y ${Math.round(m.from)} -> ${Math.round(m.to)}`);
  for (const i of r.issues) {
    const d = i.kind === "float" || i.kind === "lifted" ? `gap ${i.gap}px over ${i.on}` : i.kind === "sunk" ? `${i.depth}px into ${i.on}` : i.kind === "blade" ? `${i.bad}/${i.of} blades off, worst ${i.worst}px` : i.kind === "edge" ? `ends ${i.left}/${i.right}px` : (i.msg ?? "");
    lines.push(`    ${i.kind.padEnd(7)} ${String(i.recipe).padEnd(18)} ${String(i.id).padEnd(24)} @${Math.round(i.x ?? 0)},${Math.round(i.y ?? 0)}  ${d}`);
  }
}
lines.push("");
lines.push(`TOTAL  rooms ${T.rooms}  props ${T.props}  checked ${T.checked}  exempt ${T.exempt} (${Object.keys(report.exempt).length} recipes)  ${raw ? "AS AUTHORED" : `snapped by settle() ${T.moved}`}`);
lines.push(`       float ${T.float}  lifted ${T.lifted}  sunk ${T.sunk}  void ${T.void}  edge ${T.edge}  blades off ${T.blade} of ${T.bladesTotal} (trimmed ${T.trimmed})  build errors ${T.buildErrors}`);
const issues = T.float + T.lifted + T.sunk + T.void + T.edge + T.blade;
lines.push(issues === 0 ? "       GROUNDED: 0 issues" : `       ${issues} issues`);
console.log(lines.join("\n"));
const jsonOut = opt("json", "");
if (jsonOut) writeFileSync(String(jsonOut), JSON.stringify(report, null, 1));
process.exit(issues ? 1 : 0);
