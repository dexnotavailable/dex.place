// The opening's beats (GDK 3.9, Appendix C), keyed to where she is, never to a clock:
// 0:00 she has just slapped the talisman on her hat (the close band on her face); control
// at 0:02; the camera pulls back as she walks (the reveal track in world/sections/opening.ts)
// and waits when she stands still; stepping onto the viewing terrace arms the drop, the music
// waits for its next bar line (at most about two seconds), and the widest frame, the drop and
// TESU land together; the widest frame holds until the drop has landed, then eases back in.
// A dashing player gets the same order of beats, faster.

import { TERRACE_X0, TERRACE_X1 } from "./world/sections/common.ts";

export type OpeningState = "off" | "close" | "walk" | "armed" | "drop" | "done";

export interface OpeningHost {
  playerX(): number;
  freeze(ticks: number): void;
  title(text: string, big: boolean): void;
  setFlag(f: string): void;
  /** Seconds until the music's next bar line (the sound lane's clock; 2 s bars until then). */
  nextBar(): number;
}

export class Opening {
  state: OpeningState = "off";
  t = 0;
  private dropAt = 0;
  private landedAt = 0;
  reducedMotion = false;

  constructor(private host: OpeningHost) {}

  start(): void {
    this.state = "close";
    this.t = 0;
    this.host.freeze(120);
  }

  /** The widest frame is held (she may already be in the tunnel at a full dash). */
  get holding(): boolean {
    return this.state === "armed" || (this.state === "drop" && this.t - this.landedAt < 1.6);
  }

  /** The reveal track applies (the opening is running and has not handed back yet). */
  get active(): boolean {
    return this.state !== "off" && this.state !== "done";
  }

  tick(dt: number): void {
    if (this.state === "off" || this.state === "done") return;
    this.t += dt;
    const x = this.host.playerX();
    switch (this.state) {
      case "close":
        if (this.t >= 2) this.state = "walk";
        break;
      case "walk":
        if (x >= TERRACE_X0) {
          this.state = "armed";
          this.dropAt = this.t + Math.min(2.2, Math.max(0.05, this.host.nextBar()));
        }
        break;
      case "armed":
        if (this.t >= this.dropAt) {
          this.state = "drop";
          this.landedAt = this.t;
          this.host.title("TESU", true);
          this.host.setFlag("title:tesu");
        }
        break;
      case "drop":
        // hand back once the drop has landed and she is past the terrace (or after a while)
        if (this.t - this.landedAt > 1.6 && (x > TERRACE_X1 || this.t - this.landedAt > 6)) this.state = "done";
        break;
    }
  }
}
