// The world's painters the page itself needs (engine, perf 10-19). The page leaves painting to the plate workers, but
// props.ts measures and breaks the world's props on the page (painter(kind) when the game starts and on a break):
// the opening's breakable props (op.*) and the rope bridge's lashing. main.ts loads this before the game starts;
// split.test.mjs checks the world's prop kinds against it. Side effects only (each module registers its painters),
// so the bundle needs no namespace objects for them (which dragged the 516 kB art chunk onto the page).

import "./painters/props.ts";
import "./painters/shanshui.ts";
import "./library/opening/props.ts";
