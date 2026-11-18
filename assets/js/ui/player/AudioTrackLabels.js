/**
 * AudioTrackLabels - names for the audio track menu that tell tracks apart.
 *
 * The menu used to show each track's language code and nothing else, so a
 * film with English audio and an English commentary offered "eng" twice. A
 * file says much more than that, and Mediabunny reads all of it: the track's
 * own name ("Director's Commentary"), what it is for (commentary, audio
 * description, hearing impaired), and how many channels it has (stereo,
 * 5.1). A label is built from whichever of those the file provides:
 *
 *   English · 5.1
 *   English · Commentary · Stereo
 *   Director's Commentary (English, Stereo)
 *
 * and if two tracks would still read the same, the codec and then a number
 * are added until they do not.
 */

/** ISO 639-2 'undetermined': the file does not say. */
const UNKNOWN_LANGUAGE = 'und';

const PURPOSES = [
    ['commentary', 'Commentary'],
    ['visuallyImpaired', 'Audio description'],
    ['hearingImpaired', 'Hearing impaired'],
];

let displayNames = null;

/** A language code as a name in the viewer's language, or null if unknown. */
export function languageName(code) {
    if (!code || code === UNKNOWN_LANGUAGE) return null;
    try {
        displayNames ??= new Intl.DisplayNames(
            [globalThis.navigator?.language || 'en', 'en'], { type: 'language' });
        const name = displayNames.of(code);
        // Codes Intl does not know come back unchanged.
        return name && name !== code ? name : code;
    } catch {
        return code;
    }
}

/** A channel count the way people say it. */
export function channelLayout(count) {
    switch (count) {
        case 1: return 'Mono';
        case 2: return 'Stereo';
        case 6: return '5.1';
        case 8: return '7.1';
        default: return count > 0 ? `${count} ch` : null;
    }
}

/** What the file says about one track; a getter that fails is just absent. */
async function readTrack(track) {
    const ask = async (fn) => { try { return await fn(); } catch { return null; } };
    const [name, language, disposition, channels, codec] = await Promise.all([
        ask(() => track.getName?.()),
        ask(() => track.getLanguageCode?.()),
        ask(() => track.getDisposition?.()),
        ask(() => track.getNumberOfChannels?.()),
        ask(() => track.getCodec?.()),
    ]);
    return { name: name?.trim() || null, language, disposition: disposition || {}, channels, codec };
}

/** One label, before any de-duplication. */
export function describe({ name, language, disposition, channels }, index) {
    const lang = languageName(language);
    const layout = channelLayout(channels);
    const purposes = PURPOSES.filter(([flag]) => disposition[flag]).map(([, text]) => text);

    if (name) {
        // The file's own name leads; anything it does not already say follows.
        const lower = name.toLowerCase();
        const extra = [lang, ...purposes, layout]
            .filter(part => part && !lower.includes(part.toLowerCase()));
        return extra.length ? `${name} (${extra.join(', ')})` : name;
    }
    return [lang || `Track ${index + 1}`, ...purposes, layout].filter(Boolean).join(' · ');
}

/**
 * Labels for a set of audio tracks, in order, each one distinct.
 * @param {Object[]} tracks - Mediabunny InputAudioTracks
 * @returns {Promise<string[]>}
 */
export async function labelAudioTracks(tracks) {
    const infos = await Promise.all(tracks.map(readTrack));
    const labels = infos.map(describe);

    const repeated = () => labels.filter((l, i) => labels.indexOf(l) !== i);
    // Still alike: the codec usually tells them apart (an AC-3 and an AAC
    // mix of the same audio), and failing that, a number does.
    if (repeated().length) {
        const clash = new Set(labels.filter((l, i) => labels.indexOf(l) !== i));
        labels.forEach((label, i) => {
            if (clash.has(label) && infos[i].codec) labels[i] = `${label} · ${infos[i].codec.toUpperCase()}`;
        });
    }
    if (repeated().length) {
        const seen = new Map();
        const clash = new Set(repeated());
        labels.forEach((label, i) => {
            if (!clash.has(label)) return;
            const n = (seen.get(label) || 0) + 1;
            seen.set(label, n);
            labels[i] = `${label} (${n})`;
        });
    }
    return labels;
}
