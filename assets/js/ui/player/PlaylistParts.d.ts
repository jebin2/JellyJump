// Types only: the playlist's parts are added to Playlist.prototype at run
// time (the end of Playlist.js), which the type checker cannot follow. This
// tells it that a Playlist has their methods, so `this.save()` in
// Playlist.js and `playlist.selectItem()` elsewhere are checked.
import type { PlaylistStore } from './PlaylistStore.js';
import type { PlaylistMetadata } from './PlaylistMetadata.js';
import type { PlaylistIngest } from './PlaylistIngest.js';
import type { PlaylistDiscovery } from './PlaylistDiscovery.js';
import type { PlaylistPlayback } from './PlaylistPlayback.js';

type PlaylistPartMethods = typeof PlaylistStore & typeof PlaylistMetadata
    & typeof PlaylistIngest & typeof PlaylistDiscovery & typeof PlaylistPlayback;

declare module './Playlist.js' {
    interface Playlist extends PlaylistPartMethods {}
}
