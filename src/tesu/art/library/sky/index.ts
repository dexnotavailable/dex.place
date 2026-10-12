// The env-sky library: sky, clouds, mist, far karst and the light and water keys.
// Importing this module registers its painters (all named "sky.*"). The manifest says,
// for every asset, which plane it lives on and how it moves, reflects, shows through and
// glows; the world builder places them (lanes/ART-BIBLE.md, lanes/ART-REQUESTS.md).

import "./karst.ts";
import "./clouds.ts";
import "./mist.ts";
import "./water.ts";

export { SKY_MANIFEST, type SkyAsset } from "./manifest.ts";
export { KEYS, MORNING, DAY, DUSK, NIGHT, type SkyKey } from "./keys.ts";
