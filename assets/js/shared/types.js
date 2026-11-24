// @ts-check
/**
 * The shapes that travel between the playlist, the jobs and the edit panel,
 * and the settings' values, in one place (ARCHITECTURE_PLAN.md L3). Types
 * only: nothing here runs. A file uses one through a typedef that imports it
 * by name, `import('…/shared/types.js').PlaylistItem`.
 *
 * An item is a plain object, saved as it is (IndexedDB in the browser, a file
 * on the desktop), so every field but a few is optional: each source of items
 * sets the ones it knows. When code starts putting a new field on items, add
 * it here.
 */

/**
 * One entry in the playlist.
 *
 * @typedef {Object} PlaylistItem
 * @property {string} id - unique, from generateId()
 * @property {string} title - what the list shows, usually the file name
 * @property {string} [path] - where it sits in the list's folders,
 *   `folder/sub/name`; the title when it is at the top
 * @property {string} [url] - what the player opens: a blob URL, a remote or
 *   stream address; empty for a local file until it is opened
 * @property {string|null} [duration] - shown as text: "1:23", "" when
 *   unknown, "Loading..." while it is read
 * @property {string} [thumbnail] - an image URL, or ""
 * @property {boolean} [isLocal] - a file on this device, not a remote address
 * @property {File|null} [file] - the file itself, while it is held in memory;
 *   null once stored, read back on demand
 * @property {string|null} [blob_url] - the blob URL made for `file`, revoked
 *   when the item goes
 * @property {string} [localPath] - desktop: the file's path on disk
 * @property {string} [mimeType] - "video/mp4"
 * @property {string} [fileType] - the same as mimeType (older saved items)
 * @property {number} [fileSize] - in bytes
 * @property {string} [type] - "video" or "audio", for items a tool made
 * @property {boolean} [isAudio] - an audio file
 * @property {boolean} [needsReload] - saved without its file, to be read again
 * @property {number} [originalIndex] - its place before the list was shuffled
 *
 * Made by a tool:
 * @property {boolean} [madeByTool] - a result, not the user's own file (the
 *   desktop keeps it in its copies folder)
 * @property {boolean} [isNew] - just added, highlighted in the list
 *
 * Streams, YouTube, other sources:
 * @property {boolean} [isStream] - a live or HLS stream (no metadata probe)
 * @property {boolean} [isLive] - found to be live once opened
 * @property {boolean} [isWebcam] - the camera
 * @property {boolean} [isYouTube]
 * @property {string} [youtubeId]
 * @property {number} [youtubeStart] - seconds
 * @property {boolean} [isRemoteLibrary] - from another machine's shared library
 * @property {string} [remoteId] - its id in that library
 * @property {string} [remoteSource] - the library's link, for a refresh
 * @property {string} [remoteServer] - the library's name
 * @property {boolean} [isDiscovered] - found by the folder scan; not saved
 * @property {string} [linkListFolder] - the folder of the link list it came from
 * @property {boolean} [needsTitle] - a link with no name yet; titled once read
 *
 * Subtitles that came with it:
 * @property {File} [subtitleFile] - a subtitle file picked with the video
 * @property {string} [subtitlePath] - desktop: its path on disk
 * @property {string|null} [subtitleUrl] - a blob URL made from subtitleFile
 * @property {string[]} [subtitleUrls] - a remote library's subtitle addresses
 *
 * Learned by reading it (MediaMetadata):
 * @property {VideoInfo|null} [videoInfo]
 * @property {AudioInfo|null} [audioInfo]
 * @property {Array<Object>|null} [videoTracks]
 * @property {Array<Object>|null} [audioTracks]
 * @property {boolean} [isBroken] - a stream that could not be opened
 * @property {string} [errorMessage] - why
 * @property {boolean} [optimizeDeclined] - the user said no to optimizing it
 */

/**
 * @typedef {Object} VideoInfo
 * @property {number} width
 * @property {number} height
 * @property {number} [displayWidth]
 * @property {number} [displayHeight]
 * @property {number} [codedWidth]
 * @property {number} [codedHeight]
 * @property {string|null} codec - null when the track will not say
 * @property {number} rotation
 * @property {boolean} hasHDR
 * @property {boolean} decodable - this browser can decode it
 * @property {number} [fps]
 * @property {number} [bitrate] - bits per second
 */

/**
 * @typedef {Object} AudioInfo
 * @property {string} codec
 * @property {number} channels
 * @property {number} sampleRate
 * @property {string} [languageCode]
 * @property {boolean} decodable
 */

// --- jobs (shared/services/JobQueue.js) ---------------------------------------

/**
 * @typedef {'queued'|'running'|'done'|'failed'|'cancelled'} JobStatus
 */

/**
 * @typedef {Object} JobResult
 * @property {PlaylistItem} item - the playlist item the job added
 * @property {string} url - its blob URL, for Download
 * @property {string} filename
 * @property {File} [file] - its file as made; the playlist lets go of the
 *   item's own once the file is stored
 */

/**
 * @typedef {Object} Job
 * @property {number} id
 * @property {string} name - what the job does: "Cut", "Convert"
 * @property {string} subject - what it does it to, usually the item's title
 * @property {JobStatus} status
 * @property {number} progress - 0 to 1
 * @property {string} [label] - the work's own word for where it is
 * @property {string} [error]
 * @property {string} [errorCode] - the AppError code of the failure (shared/errors/codes.js)
 * @property {JobResult[]} results
 * @property {number} [startedAt] - performance.now() when it started running
 * @property {number} [finishedAt] - and when it stopped, however it ended
 * @property {() => void} cancel
 */

/**
 * @typedef {Object} JobSpec
 * @property {string} name
 * @property {string} subject
 * @property {(api: {signal: AbortSignal, onProgress: (fraction: number, label?: string) => void}) => Promise<*>} work
 * @property {(result: *) => (void|Promise<void>)} [done] - adds the result to the playlist
 * @property {(error: Error) => string} [failureText]
 */

// --- the edit panel's Undo history (ui/player/EditPanel.js) -------------------

/**
 * One saved step: the copy an edit made, without its file (kept in storage
 * under its id).
 * @typedef {Pick<PlaylistItem, 'id'|'title'|'duration'|'path'|'type'|'mimeType'|'fileType'|'fileSize'>
 *   & { name: string }} EditStepRecord
 */

/**
 * @typedef {{ originalId: string, steps: EditStepRecord[] }} EditHistoryRecord
 */

// --- settings (shared/settings/Settings.js) -----------------------------------

/**
 * Each preference's value, by name. `Settings.get(name)` returns this type
 * for its name; a name not here is a mistake (Settings throws for it).
 *
 * @typedef {Object} SettingsValues
 * @property {number} speed - playback speed, 0.25–2
 * @property {'overlay'|'fixed'} controlBarMode
 * @property {boolean} debug - logging outside localhost
 * @property {Record<string, EditHistoryRecord>} editHistory - by working copy id
 * @property {string[]} remoteLibraries - shared-library links to open again
 * @property {{ id: string, at: number }} loadGuard - the item being loaded
 * @property {Record<string, { time: number, at: number }>} progress - where
 *   each video was left, by item id
 */

/** @typedef {keyof SettingsValues} SettingName */

export {};
