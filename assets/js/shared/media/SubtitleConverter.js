/**
 * Subtitle Converter Utility
 * Converts word-level JSON transcripts to WebVTT format.
 */

/**
 * Format seconds to VTT timestamp (HH:MM:SS.mmm)
 * @param {number} seconds 
 * @returns {string}
 */
function formatVTTTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
}

/**
 * Convert word-level JSON transcript to WebVTT format.
 * 
 * @param {Array<{word: string, start: number, end: number}>} words - Array of word objects
 * @param {Object} options - Configuration options
 * @param {number} [options.wordsPerCue=8] - Number of words per subtitle cue
 * @param {number} [options.maxCueDuration=5] - Maximum duration in seconds for a single cue
 * @returns {string} WebVTT formatted string
 * 
 * @example
 * const words = [
 *   { "word": "Hello", "start": 0.0, "end": 0.5 },
 *   { "word": "world", "start": 0.6, "end": 1.0 }
 * ];
 * const vtt = jsonToVTT(words);
 * // Returns: "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello world\n\n"
 */
export function jsonToVTT(words, options = {}) {
    const { wordsPerCue = 8, maxCueDuration = 5 } = options;

    if (!Array.isArray(words) || words.length === 0) {
        return 'WEBVTT\n\n';
    }

    let vtt = 'WEBVTT\n\n';
    let i = 0;

    while (i < words.length) {
        const chunk = [];
        const startWord = words[i];
        let endWord = startWord;

        // Build chunk respecting both word count and duration limits
        while (
            i < words.length &&
            chunk.length < wordsPerCue &&
            (words[i].end - startWord.start) <= maxCueDuration
        ) {
            chunk.push(words[i]);
            endWord = words[i];
            i++;
        }

        // Handle edge case: single word exceeds maxCueDuration
        if (chunk.length === 0 && i < words.length) {
            chunk.push(words[i]);
            endWord = words[i];
            i++;
        }

        if (chunk.length > 0) {
            const startTime = formatVTTTime(chunk[0].start);
            const endTime = formatVTTTime(endWord.end);
            const text = chunk.map(w => w.word).join(' ');

            vtt += `${startTime} --> ${endTime}\n`;
            vtt += `${text}\n\n`;
        }
    }

    return vtt;
}

/**
 * Group Whisper word-level chunks (return_timestamps: 'word') into short cues.
 *
 * Each input chunk is a single word `{ text, timestamp: [start, end] }`. Words
 * are packed into a cue until adding the next one would exceed the target pixel
 * width (`measure`/`maxWidth`) — so each cue fills the frame as much as allowed
 * and wide videos naturally get more words than narrow/portrait ones. When no
 * `measure` is supplied it falls back to a fixed `wordsPerCue`. Cues also break
 * early on a long silence (`maxGap`) or excessive duration (`maxCueDuration`).
 *
 * @param {Array<{text: string, timestamp: [number, number|null]}>} chunks
 * @param {Object} [options]
 * @param {(text:string)=>number} [options.measure]  text -> pixel width
 * @param {number} [options.maxWidth=0]   target width (same units as measure)
 * @param {number} [options.maxWords=16]  hard safety cap when measuring
 * @param {number} [options.wordsPerCue=4] used only when no measure is given
 * @param {number} [options.maxCueDuration=6]  seconds
 * @param {number} [options.maxGap=1.5]        seconds of silence that forces a break
 * @returns {string} WebVTT
 */
export function wordChunksToVTT(chunks, options = {}) {
    const {
        measure = null,
        maxWidth = 0,
        maxWords = 16,
        wordsPerCue = 4,
        maxCueDuration = 6,
        maxGap = 1.5,
    } = options;
    const useWidth = typeof measure === 'function' && maxWidth > 0;

    // Normalise to clean {text, start, end}, repairing missing/backwards stamps.
    const words = [];
    for (const c of Array.isArray(chunks) ? chunks : []) {
        const text = (c?.text || '').trim();
        if (!text) continue;
        let start = Number(c?.timestamp?.[0]);
        let end = Number(c?.timestamp?.[1]);
        if (!Number.isFinite(start)) start = words.length ? words[words.length - 1].end : 0;
        if (!Number.isFinite(end)) end = start + 0.3;
        if (end < start) end = start + 0.1;
        words.push({ text, start, end });
    }
    if (words.length === 0) return 'WEBVTT\n\n';

    let vtt = 'WEBVTT\n\n';
    let group = [];

    const flush = () => {
        if (group.length === 0) return;
        const start = group[0].start;
        const end = Math.max(group[group.length - 1].end, start + 0.1);
        const text = group.map(w => w.text).join(' ');
        vtt += `${formatVTTTime(start)} --> ${formatVTTTime(end)}\n${text}\n\n`;
        group = [];
    };

    for (const w of words) {
        if (group.length > 0) {
            const gap = w.start - group[group.length - 1].end;
            const dur = w.end - group[0].start;
            let brk = dur > maxCueDuration || gap > maxGap;
            if (!brk) {
                if (useWidth) {
                    const candidate = group.map(x => x.text).join(' ') + ' ' + w.text;
                    brk = group.length >= maxWords || measure(candidate) > maxWidth;
                } else {
                    brk = group.length >= wordsPerCue;
                }
            }
            if (brk) flush();
        }
        group.push(w);
    }
    flush();

    return vtt;
}

/**
 * Parse JSON string or file content to word array.
 * Handles both array format and object with words property.
 * 
 * @param {string} jsonContent - JSON string content
 * @returns {Array<{word: string, start: number, end: number}>}
 */
export function parseTranscriptJSON(jsonContent) {
    const data = JSON.parse(jsonContent);

    // Handle direct array format
    if (Array.isArray(data)) {
        return data;
    }

    // Handle object with words/segments property
    if (data.words) {
        return data.words;
    }
    if (data.segments) {
        // Flatten segments that contain words
        return data.segments.flatMap(seg => seg.words || []);
    }

    throw new Error('Invalid transcript format: expected array or object with words/segments property');
}

/** HH:MM:SS.mmm from whole milliseconds, so 59.9996s cannot become "60.000". */
function vttTimestamp(ms) {
    const total = Math.max(0, Math.round(ms));
    const h = Math.floor(total / 3_600_000);
    const m = Math.floor(total / 60_000) % 60;
    const s = Math.floor(total / 1000) % 60;
    const pad = (n, w) => String(n).padStart(w, '0');
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(total % 1000, 3)}`;
}

/**
 * Cues as a WebVTT file, for writing into an exported video.
 *
 * `start`/`end` cut the cues to a range of the source and move them so the
 * range begins at zero, which is where an exported range begins: a cue that
 * straddles an edge is clipped to it, one wholly outside is left out.
 * `align:center` is there because QuickTime does not show WebVTT cues
 * without alignment.
 *
 * @param {Array<{start: number, end: number, text: string}>} cues - seconds
 * @param {{ start?: number, end?: number }} [range] - seconds on the source
 * @returns {string|null} null when no cue falls in the range
 */
export function cuesToVTT(cues, { start = 0, end = Infinity } = {}) {
    const lines = ['WEBVTT', ''];
    let count = 0;
    for (const cue of [...cues].sort((a, b) => a.start - b.start)) {
        const from = Math.max(cue.start, start);
        const to = Math.min(cue.end, end);
        const text = (cue.text || '').trim();
        // A blank line would end the cue early in WebVTT.
        const body = text.split(/\r?\n/).filter(l => l.trim()).join('\n');
        if (!(to > from) || !body) continue;
        lines.push(`${vttTimestamp((from - start) * 1000)} --> ${vttTimestamp((to - start) * 1000)} align:center`, body, '');
        count++;
    }
    return count ? lines.join('\n') : null;
}
