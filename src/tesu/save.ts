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

// --- Hanko's ledger slip: progress as a short text code, to carry to another device -------

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad)));
}

function sum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(-4).padStart(4, "0");
}

/** The slip for a save (flags only: a slip carries progress, not where she stands). */
export function slipFor(d: TesuSave): string {
  const body = b64url(JSON.stringify({ f: d.flags }));
  return `TESU1-${body}-${sum(body)}`;
}

/** Reads a slip into a save, or returns why it can't be read. */
export function readSlipInto(d: TesuSave, code: string): string | null {
  const m = /^TESU1-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/.exec(code.trim());
  if (!m) return "That isn't one of Hanko's slips.";
  if (sum(m[1]!) !== m[2]) return "The slip is smudged: a letter is wrong somewhere.";
  try {
    const v = JSON.parse(unb64url(m[1]!)) as { f?: unknown };
    if (!Array.isArray(v.f) || !v.f.every((x) => typeof x === "string")) return "The slip is blank.";
    d.flags = [...new Set([...d.flags, ...(v.f as string[])])];
    writeSave(d);
    return null;
  } catch {
    return "The slip is smudged.";
  }
}
