import source from './art-content.json';
/** Exact display-only metadata from public/content/illustrations/manifest.json.
 * Kept separate so arrival does not parse the 1.4MB historical document edition.
 * The runtime verification checks parity with that source manifest. */
export const illustrations=source;
