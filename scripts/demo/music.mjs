/**
 * The demo's music: an original, light loop, synthesised here so it belongs
 * to the project. 96 BPM in C major (C, G, Am, F): a soft pad, a plucked
 * arpeggio with an echo, a round bass and gentle drums; it opens on the pad
 * and arpeggio, the drums come in on bar 3, and it fades out at the end.
 *
 *   node scripts/demo/music.mjs [seconds] [out.wav]
 *
 * Default: 62 s to scripts/demo/out/music.wav (16-bit stereo, 44.1 kHz).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SECONDS = Number(process.argv[2]) || 62;
const OUT = resolve(process.argv[3] || resolve(import.meta.dirname, 'out/music.wav'));
const RATE = 44100;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.ceil(SECONDS * RATE);
const left = new Float32Array(N);
const right = new Float32Array(N);

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// C, G, Am, F: root, third, fifth, octave (MIDI notes).
const CHORDS = [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65],
];

/** Add a mono sound at `start` seconds, panned (-1 left … 1 right). */
function add(start, samples, gain, pan = 0) {
    const at = Math.floor(start * RATE);
    const l = gain * Math.cos((pan + 1) * Math.PI / 4);
    const r = gain * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < samples.length && at + i < N; i++) {
        left[at + i] += samples[i] * l;
        right[at + i] += samples[i] * r;
    }
}

/** A plucked note: a triangle with a quick decay, slightly bright at first. */
function pluck(freq, seconds) {
    const n = Math.floor(seconds * RATE);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        phase = (phase + freq / RATE) % 1;
        const tri = 4 * Math.abs(phase - 0.5) - 1;
        const sine = Math.sin(2 * Math.PI * phase * 2) * 0.25 * Math.exp(-t * 18);
        out[i] = (tri + sine) * Math.exp(-t * 5.5) * Math.min(1, t * 400);
    }
    return out;
}

/** A pad chord: detuned saws through a soft low-pass, slow attack and release. */
function pad(notes, seconds) {
    const n = Math.floor(seconds * RATE);
    const out = new Float32Array(n);
    const voices = notes.flatMap((note) => [-0.08, 0.08].map((cents) => ({ f: midi(note - 12 + 12) * 2 ** (cents / 12), p: Math.random() })));
    let low = 0;
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        let s = 0;
        for (const v of voices) { v.p = (v.p + v.f / RATE) % 1; s += 2 * v.p - 1; }
        low += 0.035 * (s / voices.length - low);
        const env = Math.min(1, t / 0.6) * Math.min(1, (seconds - t) / 0.5);
        out[i] = low * env;
    }
    return out;
}

/** A round bass note: sine plus a little second harmonic. */
function bass(freq, seconds) {
    const n = Math.floor(seconds * RATE);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const env = Math.min(1, t * 200) * Math.exp(-t * 1.2) * Math.min(1, (seconds - t) * 20);
        out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(4 * Math.PI * freq * t)) * env;
    }
    return out;
}

function kick() {
    const n = Math.floor(0.35 * RATE);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
        const t = i / RATE;
        phase += (50 + 90 * Math.exp(-t * 30)) / RATE;
        out[i] = Math.sin(2 * Math.PI * phase) * Math.exp(-t * 9);
    }
    return out;
}

/** Noise through a high-pass, short: a soft hat, or a longer clap-like snare. */
function noise(seconds, decay) {
    const n = Math.floor(seconds * RATE);
    const out = new Float32Array(n);
    let prev = 0, x = 0, soft = 0;
    for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        x = 0.85 * (x + w - prev); prev = w;
        soft += 0.3 * (x - soft);   // and a gentle low-pass: brushed, not hissy
        out[i] = soft * Math.exp(-(i / RATE) * decay);
    }
    return out;
}

const bars = Math.ceil(SECONDS / BAR);
for (let b = 0; b < bars; b++) {
    const t0 = b * BAR;
    const chord = CHORDS[b % 4];
    add(t0, pad(chord, BAR + 0.4), 0.11);
    // Arpeggio in eighths: up the chord and back, an octave above.
    const order = [0, 1, 2, 3, 2, 1, 2, 3];
    order.forEach((k, i) => {
        const note = chord[k] + 12;
        const start = t0 + i * BEAT / 2;
        add(start, pluck(midi(note), 0.9), 0.16, i % 2 ? 0.35 : -0.35);
        add(start + BEAT * 0.75, pluck(midi(note), 0.9), 0.05, i % 2 ? -0.5 : 0.5);   // echo, the other side
    });
    if (b >= 1) {
        add(t0, bass(midi(chord[0] - 24), BEAT * 2), 0.3);
        add(t0 + BEAT * 2, bass(midi(chord[0] - 24), BEAT * 1.5), 0.25);
        add(t0 + BEAT * 3.5, bass(midi(chord[2] - 24), BEAT * 0.5), 0.18);
    }
    if (b >= 2) {
        for (let beat = 0; beat < 4; beat++) {
            if (beat % 2 === 0) add(t0 + beat * BEAT, kick(), 0.45);
            else add(t0 + beat * BEAT, noise(0.25, 16), 0.09);
            add(t0 + beat * BEAT + BEAT / 2, noise(0.06, 60), 0.04, 0.3);
        }
    }
}

// Fade in briefly, out over the last 3 s; then normalise to -1 dBFS.
const fadeOut = 3 * RATE;
let peak = 0;
for (let i = 0; i < N; i++) {
    const g = Math.min(1, i / (0.3 * RATE)) * Math.min(1, (N - i) / fadeOut);
    left[i] *= g; right[i] *= g;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const scale = peak > 0 ? 0.89 / peak : 1;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * scale)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * scale)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`${OUT}: ${SECONDS} s, ${bars} bars at ${BPM} BPM`);
