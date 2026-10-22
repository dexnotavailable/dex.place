/**
 * The chop's floor splash at the floor's end (Dex 10-21: "make sure these effects actually react and know where the
 * ground and stuff is"; feel.json m1_4 dive.slots splash). Her m1_4 chop drawings carry the blade's floor splash in
 * their bottom rows, at her sole row; where the floor under it ends (the court's open edge, a wall, a step up or down)
 * that band is not drawn past the floor's end, as it never sat on anything there. A slope carries it on (the floor
 * under it changes a little a probe, as under her own feet). Her own extent in the band (boots, the blade's tip:
 * `keep`) is never cut. The part above the band (the tall chop crescent) stays: a slash in the air.
 */

/** Where the floor her splash lies on ends, art px from her pivot (facing right), each way; null: it carries on. */
export interface Lip {
  ahead: number | null;
  behind: number | null;
}

/**
 * Walks the floor out from her pivot (art px, facing right) to `to` ahead and `from` behind, `step` art px a probe:
 * `floorY(d, near)` is the floor's y at d (world px, null: none there) looked for near the probe before it (`near`;
 * null: her own floor). The floor ends at the first probe with none, or one more than `tol` world px off the probe
 * before it (a drop, a wall, a step; a slope's few px a probe carry on). The cut starts there, never inside `keep`.
 */
export function lipAt(floorY: (d: number, near: number | null) => number | null, from: number, to: number, keep: readonly [number, number], tol: number, step = 2): Lip {
  const walk = (dir: 1 | -1, end: number): number | null => {
    let prev = floorY(0, null);
    if (prev === null) return null;
    for (let d = dir * step; dir > 0 ? d <= end : d >= end; d += dir * step) {
      const g = floorY(d, prev);
      if (g === null || Math.abs(g - prev) > tol) return d;
      prev = g;
    }
    return null;
  };
  const a = walk(1, to), b = walk(-1, from);
  const ahead = a === null ? null : Math.max(a, keep[1] + 1), behind = b === null ? null : Math.min(b, keep[0] - 1);
  return { ahead: ahead !== null && ahead <= to ? ahead : null, behind: behind !== null && behind >= from ? behind : null };
}

/** The cut's ragged edge: 0-3 more rows off, by 2-column groups (no ruled line across the crescent's foot). */
export function lipJag(x: number): number {
  const g = Math.floor(x / 2);
  return (Math.imul(g ^ 0x5bd1e995, 0x9e3779b1) >>> 29) & 3;
}

/**
 * A drawing (`sw` x `sh` px from its rect, its top-left `off` art px from the pivot) as column strips: the columns
 * past a lip keep only the rows above the band (less the jag), the rest all `sh` rows. Runs of equal height merge.
 */
export function lipStrips(sw: number, sh: number, off: readonly [number, number], lip: Lip, band: number): { c0: number; c1: number; rows: number }[] {
  const out: { c0: number; c1: number; rows: number }[] = [];
  const top = Math.floor(-band - off[1]);
  for (let c = 0; c < sw; c++) {
    const x = off[0] + c;
    const cut = (lip.ahead !== null && x >= lip.ahead) || (lip.behind !== null && x <= lip.behind);
    const rows = cut ? Math.max(0, Math.min(sh, top - lipJag(x))) : sh;
    const last = out[out.length - 1];
    if (last && last.c1 === c && last.rows === rows) last.c1 = c + 1;
    else out.push({ c0: c, c1: c + 1, rows });
  }
  return out;
}
