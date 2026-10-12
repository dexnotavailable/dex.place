// What Tesu keeps on this device (GDK 6.7). Progress always keeps; you never choose to
// save. A reload in the world goes straight back to where she stood while the distance
// countdown lasts (about the walk back from the catch: at least 20 s, at most 10 min);
// after it, a reload is a fresh visit.

import { H, WALK_H_PER_S } from "./config.ts";

const KEY = "dex.tesu.v1";

export interface Place {
  x: number;
  y: number;
  facing: 1 | -1;
  /** When she last stood here (ms since epoch). */
  at: number;
}

export interface TesuSave {
  v: 1;
  flags: string[];
  place: Place | null;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): TesuSave {
  const s = storage();
  try {
    const raw = s?.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<TesuSave>;
      if (d && d.v === 1) return { v: 1, flags: Array.isArray(d.flags) ? d.flags.filter((f) => typeof f === "string") : [], place: d.place ?? null };
    }
  } catch {
    /* a broken save is a fresh visit */
  }
  return { v: 1, flags: [], place: null };
}

export function writeSave(d: TesuSave): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(d));
  } catch {
    /* private mode or full: nothing is lost but the resume */
  }
}

/** The countdown for a place: the walk back from the catch, 20 s to 10 min. */
export function countdownMs(place: Place, catchX: number): number {
  const secs = Math.abs(place.x - catchX) / (WALK_H_PER_S * H);
  return Math.min(600, Math.max(20, secs)) * 1000;
}

/** Was this page load a reload (not a fresh visit or a link)? */
export function isReload(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "reload";
  } catch {
    return false;
  }
}

/** Where a reload resumes, or null for a fresh start. */
export function resumePlace(d: TesuSave, now: number, catchX: number, reload: boolean): Place | null {
  const p = d.place;
  if (!reload || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return now - p.at <= countdownMs(p, catchX) ? p : null;
}
