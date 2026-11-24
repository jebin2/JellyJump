/**
 * The playlist's public members (the class and its parts, whose methods are
 * the playlist's own) are the ones ARCHITECTURE_PLAN.md §4.2 lists, each with
 * a JSDoc comment, in type-checked files (plan T6). The checks:
 * scripts/lib/api-listing.mjs.
 *
 *   node scripts/playlist-api-test.mjs
 */
import { checkApiListing } from './lib/api-listing.mjs';

const part = (name) => ({ path: `assets/js/ui/player/${name}.js`, start: `export const ${name} = {` });
const failed = await checkApiListing({
    title: 'Playlist',
    heading: '### 4.2 `Playlist`',
    minMembers: 20,
    files: [
        { path: 'assets/js/ui/player/Playlist.js', start: 'export class Playlist' },
        part('PlaylistIngest'), part('PlaylistPlayback'), part('PlaylistMetadata'),
        part('PlaylistStore'), part('PlaylistDiscovery'),
    ],
});
process.exit(failed ? 1 : 0);
