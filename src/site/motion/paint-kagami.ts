// A painter worker for Kagami's places (the lake with its torii islet, the pine at dusk, the jetty at the bottom of
// the page): the jetty, the islets, the boat, the pine, the far karst, clouds, egrets. The heaviest painters, so it
// only starts when one of these places comes near.
import "../../tesu/art/library/opening/jetty.ts";
import "../../tesu/art/library/opening/islet.ts";
import "../../tesu/art/library/opening/props.ts";
import "../../tesu/art/library/opening/flora.ts";
import "../../tesu/art/library/opening/haze.ts";
import "../../tesu/art/library/opening/sky.ts";
import "../../tesu/art/library/opening/life.ts";
import { serve } from "./paint-core.ts";

serve();
