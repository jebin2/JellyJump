/**
 * Labels in the audio track menu.
 *
 * The menu showed each track's language code and nothing else, so a film
 * with English audio and an English commentary offered "eng" twice. These
 * check that the labels now tell tracks apart from what the file says, and
 * stay distinct when the file says too little.
 *
 *   node scripts/audio-track-label-test.mjs
 */
import { labelAudioTracks, languageName, channelLayout } from '../assets/js/ui/player/AudioTrackLabels.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

/** A stand-in for a Mediabunny InputAudioTrack. */
const track = ({ name = null, language = 'und', disposition = {}, channels = 2, codec = 'aac' } = {}) => ({
    getName: async () => name,
    getLanguageCode: async () => language,
    getDisposition: async () => ({ default: false, primary: false, forced: false, original: false,
        commentary: false, hearingImpaired: false, visuallyImpaired: false, ...disposition }),
    getNumberOfChannels: async () => channels,
    getCodec: async () => codec,
});

console.log('\nthe parts');
check(languageName('eng') === 'English', `a language code becomes its name (${languageName('eng')})`);
check(languageName('und') === null, 'an undetermined language is left out, not shown as "und"');
check(languageName('qaa') === 'qaa', 'a code with no name is shown as it is');
check(channelLayout(6) === '5.1' && channelLayout(2) === 'Stereo' && channelLayout(1) === 'Mono', 'channel counts read the way people say them');
check(channelLayout(0) === null, 'an unknown channel count is left out');

console.log('\nthe case that was broken');
{
    const labels = await labelAudioTracks([
        track({ language: 'eng', channels: 6 }),
        track({ language: 'eng', channels: 2, disposition: { commentary: true } }),
    ]);
    check(labels[0] !== labels[1], `two English tracks no longer read the same (${labels.join(' | ')})`);
    check(labels[0] === 'English · 5.1', `the main mix says its language and layout (${labels[0]})`);
    check(labels[1] === 'English · Commentary · Stereo', `the commentary says what it is (${labels[1]})`);
}

console.log('\nthe file\'s own name leads');
{
    const [named, repeat] = await labelAudioTracks([
        track({ name: "Director's Commentary", language: 'eng', disposition: { commentary: true } }),
        track({ name: 'English 5.1', language: 'eng', channels: 6 }),
    ]);
    check(named === "Director's Commentary (English, Stereo)", `the name, then what it does not already say (${named})`);
    check(repeat === 'English 5.1', `nothing is repeated that the name already says (${repeat})`);
}

console.log('\nother purposes');
{
    const [ad, hi] = await labelAudioTracks([
        track({ language: 'fra', disposition: { visuallyImpaired: true } }),
        track({ language: 'fra', disposition: { hearingImpaired: true } }),
    ]);
    check(ad === 'French · Audio description · Stereo', `audio description is named (${ad})`);
    check(hi === 'French · Hearing impaired · Stereo', `a hearing-impaired mix is named (${hi})`);
}

console.log('\nlabels stay distinct when the file says too little');
{
    const byCodec = await labelAudioTracks([
        track({ language: 'eng', codec: 'ac3' }),
        track({ language: 'eng', codec: 'aac' }),
    ]);
    check(byCodec[0] === 'English · Stereo · AC3' && byCodec[1] === 'English · Stereo · AAC',
        `the codec tells two otherwise identical mixes apart (${byCodec.join(' | ')})`);
    const bare = await labelAudioTracks([track(), track()]);
    check(bare[0] === 'Track 1 · Stereo' && bare[1] === 'Track 2 · Stereo', `with no language, the track number does (${bare.join(' | ')})`);
    const same = await labelAudioTracks([track({ language: 'eng' }), track({ language: 'eng' })]);
    check(new Set(same).size === 2, `and when even the codec matches, a number does (${same.join(' | ')})`);
}

console.log('\nthings that must not throw');
{
    const broken = { getName: async () => { throw new Error('x'); }, getLanguageCode: async () => 'deu' };
    const [label] = await labelAudioTracks([broken]);
    check(label === 'German', `a track whose getters fail still gets a label (${label})`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
