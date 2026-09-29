// Travel-time logger (WORLD-PLAN section 6): when you entered each room and
// area, when a ride started and ended, and the first time you reached each
// destination, in seconds of play since the Enter action (simulation time,
// so it is the same in real time and in automated runs). A destination
// counts as reached when you stand within reach of its prop (a placement
// with params.dest): downloads (the terminal), donate (a donation box),
// illustrations (an artwork frame), documentation (the archive door or
// lectern), account (the counter), map (the map banner).
//
// ?travel shows it in the debug overlay; window.__world.state().travel has it.

export type Dest = "downloads" | "donate" | "illustrations" | "documentation" | "account" | "map";
export const DESTS: Dest[] = ["downloads", "donate", "illustrations", "documentation", "account", "map"];

export interface TravelEvent {
  t: number;
  kind: "room" | "area" | "ride" | "dest" | "flag";
  id: string;
}

export class Travel {
  events: TravelEvent[] = [];
  /** First arrival at each destination, seconds since the Enter action. */
  reached: Partial<Record<Dest, number>> = {};
  /** Seconds since the Enter action (sim ticks / 60). */
  t = 0;
  running = false;

  begin(): void {
    this.running = true;
  }

  /** One simulation tick. */
  tick(): void {
    if (this.running) this.t += 1 / 60;
  }

  mark(kind: TravelEvent["kind"], id: string): void {
    if (!this.running) return;
    this.events.push({ t: +this.t.toFixed(2), kind, id });
    if (this.events.length > 600) this.events.shift();
  }

  dest(d: Dest): void {
    if (!this.running || this.reached[d] !== undefined) return;
    this.reached[d] = +this.t.toFixed(2);
    this.mark("dest", d);
  }

  /** Start a fresh measurement (a returning-visitor run starts from the dock again). */
  reset(): void {
    this.events = [];
    this.reached = {};
    this.t = 0;
  }

  summary(): string {
    const f = (s: number | undefined): string => (s === undefined ? "-" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
    return `travel ${f(this.t)}  ${DESTS.map((d) => `${d} ${f(this.reached[d])}`).join("  ")}`;
  }
}
