/**
 * CorePlayer's public members are the ones ARCHITECTURE_PLAN.md §4.1 lists,
 * each with a JSDoc comment, in a type-checked file (plan I2, T6). The
 * checks: scripts/lib/api-listing.mjs.
 *
 *   node scripts/player-api-test.mjs
 */
import { checkApiListing } from './lib/api-listing.mjs';

const failed = await checkApiListing({
    title: 'CorePlayer',
    heading: '### 4.1 `CorePlayer`',
    minMembers: 30,
    files: [{ path: 'assets/js/core/Player.js', start: 'export class CorePlayer' }],
});
process.exit(failed ? 1 : 0);
