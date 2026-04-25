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
    let cueIndex = 1;
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

/**
 * Load and convert a JSON transcript file to VTT.
 * 
 * @param {string} url - URL to the JSON transcript file
 * @param {Object} options - Options for jsonToVTT
 * @returns {Promise<string>} WebVTT formatted string
 */
export async function loadJSONTranscript(url, options = {}) {
    const response = await fetch(url);
    const jsonContent = await response.text();
    const words = parseTranscriptJSON(jsonContent);
    return jsonToVTT(words, options);
}
